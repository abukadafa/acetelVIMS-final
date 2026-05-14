import mongoose from 'mongoose';
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import Logbook from '../models/Logbook.model';
import Student from '../models/Student.model';
import Notification from '../models/notification.model';
import { io } from '../index';
import logger from '../utils/logger';
import { z } from 'zod';

const logbookQuerySchema = z.object({
  studentId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID format').optional(),
  status: z.enum(['submitted', 'approved', 'rejected']).optional(),
  week: z.preprocess((val) => Number(val), z.number().min(1).max(52)).optional(),
});

const logbookEntrySchema = z.object({
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  activities: z.string().min(10).max(5000),
  toolsUsed: z.string().max(500).optional(),
  skillsLearned: z.string().max(1000).optional(),
  challenges: z.string().max(1000).optional(),
  solutions: z.string().max(1000).optional(),
  weekNumber: z.number().min(1).max(52).optional(), // auto-calculated if not provided
  isOfflineSync: z.boolean().optional(),
});

const reviewSchema = z.object({
  supervisorComment: z.string().max(1000).optional(),
  supervisorRating: z.number().min(1).max(5).optional(),
  status: z.enum(['approved', 'rejected', 'revision_requested']).optional().default('approved'),
});

const idParamSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID format'),
});

export async function getLogbookEntries(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { studentId, status, week } = logbookQuerySchema.parse(req.query);
    const { role: userRole, id: userId, tenant: userTenant } = req.user!;
    let targetStudentId = studentId;

    let query: any = { tenant: userTenant };

    if (userRole === 'student') {
      const student = await Student.findOne({ user: userId, tenant: userTenant });
      if (!student) {
        res.status(404).json({ error: 'Student profile not found' });
        return;
      }
      targetStudentId = student._id.toString();
    }

    if (targetStudentId) {
      const targetStudent = await Student.findOne({ _id: targetStudentId, tenant: userTenant });
      if (!targetStudent) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }

      if (userRole === 'supervisor' && targetStudent.supervisor?.toString() !== userId) {
        logger.warn('Supervisor %s tried to access logs for unassigned student %s', userId, targetStudentId);
        res.status(403).json({ error: 'Access denied' });
        return;
      }

      query.student = targetStudentId;
    }

    if (status) query.status = status;
    if (week) query.weekNumber = week;

    const entries = await Logbook.find(query)
      .populate({
        path: 'student',
        populate: { path: 'user', select: 'firstName lastName' }
      })
      .sort({ entryDate: -1 });

    res.json({ entries });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    logger.error('Error in getLogbookEntries: %s', (err as Error).message);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function createLogbookEntry(req: AuthRequest, res: Response): Promise<void> {
  try {
    const data = logbookEntrySchema.parse(req.body);
    const { id: userId, tenant: userTenant } = req.user!;
    
    const student = await Student.findOne({ user: userId, tenant: userTenant });
    if (!student) {
      res.status(404).json({ error: 'Student profile not found' });
      return;
    }

    const existing = await Logbook.findOne({ student: student._id, entryDate: data.entryDate, tenant: userTenant });
    if (existing) {
      res.status(409).json({ error: 'Entry already exists for this date' });
      return;
    }

    const attachments = (req.files as Express.Multer.File[])?.map(f => `/uploads/logbooks/${f.filename}`) || [];

    // Auto-calculate weekNumber from entryDate if not provided
    const entryDateObj = new Date(data.entryDate);
    const startOfYear = new Date(entryDateObj.getFullYear(), 0, 1);
    const calculatedWeek = Math.ceil(((entryDateObj.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7);
    const weekNumber = data.weekNumber || Math.max(1, Math.min(52, calculatedWeek));

    const entry = new Logbook({
      ...data,
      weekNumber,
      student: student._id,
      tenant: userTenant,
      status: 'submitted',
      attachments
    });

    await entry.save();

    if (student.supervisor) {
      const notification = new Notification({
        user: student.supervisor,
        tenant: userTenant,
        title: 'New Logbook Entry',
        message: `Student ${student.matricNumber} submitted a logbook entry for ${new Date(data.entryDate).toLocaleDateString()}`,
        type: 'info'
      });
      await notification.save();
      io.to(`user:${student.supervisor}`).emit('notification', { 
        title: notification.title, 
        message: notification.message 
      });
    }

    res.status(201).json({ message: 'Logbook entry submitted', id: entry._id });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    logger.error('Error in createLogbookEntry: %s', (err as Error).message);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function reviewLogbookEntry(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = idParamSchema.parse(req.params);
    const { supervisorComment, supervisorRating, status } = reviewSchema.parse(req.body);
    const { id: userId, tenant: userTenant } = req.user!;

    const entry = await Logbook.findOne({ _id: id, tenant: userTenant }).populate('student');
    if (!entry) {
      res.status(404).json({ error: 'Entry not found' });
      return;
    }

    const student = entry.student as any;
    if (student.supervisor?.toString() !== userId && req.user!.role !== 'admin') {
      logger.warn('User %s tried to review logbook for student %s without permission', userId, student._id);
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    entry.supervisorComment = supervisorComment || entry.supervisorComment;
    entry.supervisorRating = supervisorRating || entry.supervisorRating;
    entry.status = status;
    entry.isSupervisorSigned = true;
    entry.supervisorSignedAt = new Date();
    
    await entry.save();

    const notification = new Notification({
      user: student.user,
      tenant: userTenant,
      title: 'Logbook Update',
      message: entry.status === 'approved' 
        ? 'Your logbook entry was approved' 
        : `Management requested a revision on your ${new Date(entry.entryDate).toLocaleDateString()} entry.`,
      type: entry.status === 'approved' ? 'success' : 'warning'
    });
    await notification.save();
    
    io.to(`user:${student.user}`).emit('notification', { 
      title: notification.title, 
      message: notification.message 
    });

    res.json({ message: 'Logbook entry reviewed', entry });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    logger.error('Error in reviewLogbookEntry: %s', (err as Error).message);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function updateLogbookEntry(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = idParamSchema.parse(req.params);
    const data = logbookEntrySchema.partial().parse(req.body);
    const { id: userId, tenant: userTenant } = req.user!;

    const entry = await Logbook.findOne({ _id: id, tenant: userTenant });
    if (!entry) {
      res.status(404).json({ error: 'Entry not found' });
      return;
    }

    const student = await Student.findOne({ user: userId, tenant: userTenant });
    if (!student || entry.student.toString() !== student._id.toString()) {
      res.status(403).json({ error: 'Permission denied' });
      return;
    }

    if (entry.status === 'approved') {
      res.status(400).json({ error: 'Approved entries cannot be edited' });
      return;
    }

    Object.assign(entry, data);
    entry.status = 'submitted';
    
    await entry.save();
    res.json({ message: 'Logbook entry updated successfully', entry });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    logger.error('Error in updateLogbookEntry: %s', (err as Error).message);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function syncOfflineEntries(req: AuthRequest, res: Response): Promise<void> {
  try {
    const entriesSchema = z.object({ entries: z.array(logbookEntrySchema) });
    const { entries } = entriesSchema.parse(req.body);
    const { id: userId, tenant: userTenant } = req.user!;

    const student = await Student.findOne({ user: userId, tenant: userTenant });
    if (!student) {
      res.status(404).json({ error: 'Student not found' });
      return;
    }

    let synced = 0, skipped = 0;
    for (const e of entries) {
      const existing = await Logbook.findOne({ 
        student: student._id, 
        entryDate: e.entryDate,
        tenant: userTenant
      });

      if (!existing) {
        const newEntry = new Logbook({
          ...e,
          student: student._id,
          tenant: userTenant,
          status: 'submitted',
          isOfflineSync: true
        });
        await newEntry.save();
        synced++;
      } else {
        skipped++;
      }
    }

    res.json({ message: `Synced ${synced} entries, skipped ${skipped} duplicates`, synced, skipped });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    logger.error('Error in syncOfflineEntries: %s', (err as Error).message);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function deleteLogbookEntry(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = idParamSchema.parse(req.params);
    const { id: userId, tenant: userTenant } = req.user!;
    const student = await Student.findOne({ user: userId, tenant: userTenant });
    
    const entry = await Logbook.findOneAndDelete({ 
      _id: id, 
      student: student?._id,
      tenant: userTenant,
      status: { $ne: 'approved' }
    });

    if (!entry) {
      res.status(400).json({ error: 'Entry not found or cannot be deleted' });
      return;
    }
    res.json({ message: 'Entry deleted' });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    logger.error('Error in deleteLogbookEntry: %s', (err as Error).message);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function getSupervisorStudents(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id: supervisorId, tenant: userTenant } = req.user!;
    
    // Find students assigned to this supervisor
    const students = await Student.find({ 
      supervisor: supervisorId, 
      tenant: userTenant,
      isDeleted: false 
    })
    .populate('user', 'firstName lastName email avatar')
    .populate('programme', 'name code level')
    .sort({ 'user.lastName': 1 });

    const studentsWithSummary = await Promise.all(students.map(async (s) => {
      const logs = await Logbook.find({ student: s._id, tenant: userTenant });
      return {
        ...s.toObject(),
        logCount: logs.length,
        pendingCount: logs.filter(l => l.status === 'submitted').length,
        lastActivity: logs.length > 0 ? logs.sort((a,b) => b.entryDate.getTime() - a.entryDate.getTime())[0].entryDate : null
      };
    }));

    res.json({ students: studentsWithSummary });
  } catch (err) {
    logger.error('Error fetching supervisor students: %s', (err as Error).message);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function getWeeklyPerformance(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { studentId } = req.query;
    const { id: userId, role: userRole, tenant: userTenant } = req.user!;
    
    let targetId = studentId as string;
    if (userRole === 'student') {
      const student = await Student.findOne({ user: userId, tenant: userTenant });
      targetId = student?._id.toString() || '';
    }

    if (!targetId) {
      res.status(400).json({ error: 'Student ID required' });
      return;
    }

    // Aggregate logbooks by week
    const performance = await Logbook.aggregate([
      { $match: { student: new mongoose.Types.ObjectId(targetId), tenant: new mongoose.Types.ObjectId(userTenant) } },
      { $group: {
          _id: "$weekNumber",
          entries: { $sum: 1 },
          avgRating: { $avg: "$supervisorRating" },
          lastEntry: { $max: "$entryDate" }
      }},
      { $sort: { _id: 1 } }
    ]);

    res.json({ performance });
  } catch (err) {
    logger.error('Error fetching weekly performance: %s', (err as Error).message);
    res.status(500).json({ error: 'Server error' });
  }
}

/** PUT /api/logbook/:id/industry-review — Industry supervisor signs off */
export async function industryReviewLogbook(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = idParamSchema.parse(req.params);
    const { comment, rating } = z.object({
      comment: z.string().min(5).max(2000),
      rating:  z.number().min(1).max(5),
    }).parse(req.body);
    const { id: userId, tenant: userTenant, role } = req.user!;

    if (role !== 'industry_supervisor' && role !== 'admin') {
      res.status(403).json({ error: 'Only industry supervisors can perform this action' });
      return;
    }

    const entry = await Logbook.findOne({ _id: id, tenant: userTenant }).populate('student');
    if (!entry) { res.status(404).json({ error: 'Logbook entry not found' }); return; }

    (entry as any).industrySupervisorId      = userId;
    (entry as any).industrySupervisorComment = comment;
    (entry as any).industrySupervisorRating  = rating;
    (entry as any).isIndustrySigned          = true;
    (entry as any).industrySignedAt          = new Date();
    entry.status = 'industry_reviewed' as any;
    await entry.save();

    const student = entry.student as any;
    if (student?.user) {
      await Notification.create({
        user: student.user, tenant: userTenant,
        title: 'Industry Supervisor Reviewed Your Logbook',
        message: `Your logbook for ${new Date(entry.entryDate).toLocaleDateString()} has been reviewed. You may now submit it to the school.`,
        type: 'success',
      });
      io.to(`user:${student.user}`).emit('notification', { title: 'Logbook Reviewed', message: 'You can now make final submission.' });
    }
    res.json({ message: 'Industry review submitted. Student can now make final submission.', entry });
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: 'Validation failed', details: err.errors }); return; }
    logger.error('industryReviewLogbook error: %s', (err as Error).message);
    res.status(500).json({ error: 'Server error' });
  }
}

/** POST /api/logbook/:id/final-submit — Student final submission after industry sign-off */
export async function finalSubmitLogbook(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = idParamSchema.parse(req.params);
    const { id: userId, tenant: userTenant } = req.user!;

    const student = await Student.findOne({ user: userId, tenant: userTenant });
    if (!student) { res.status(404).json({ error: 'Student profile not found' }); return; }

    const entry = await Logbook.findOne({ _id: id, tenant: userTenant, student: student._id });
    if (!entry) { res.status(404).json({ error: 'Logbook entry not found' }); return; }

    if (!(entry as any).isIndustrySigned) {
      res.status(400).json({ error: 'Your industry supervisor must review this entry before final submission.' });
      return;
    }
    if (entry.status === ('final_submitted' as any)) {
      res.status(400).json({ error: 'Already finally submitted.' });
      return;
    }

    entry.status = 'final_submitted' as any;
    (entry as any).finalSubmittedAt = new Date();
    (entry as any).finalSubmittedBy = userId;
    await entry.save();

    if (student.supervisor) {
      await Notification.create({
        user: student.supervisor, tenant: userTenant,
        title: 'Final Logbook Submission',
        message: `Student ${student.matricNumber} made a final logbook submission for ${new Date(entry.entryDate).toLocaleDateString()}.`,
        type: 'info',
      });
      io.to(`user:${student.supervisor}`).emit('notification', { title: 'Final Logbook', message: `${student.matricNumber} submitted final logbook.` });
    }
    res.json({ message: 'Logbook finally submitted to school successfully.', entry });
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: 'Validation failed', details: err.errors }); return; }
    logger.error('finalSubmitLogbook error: %s', (err as Error).message);
    res.status(500).json({ error: 'Server error' });
  }
}

/** GET /api/logbook/industry — Industry supervisor's assigned students' logbooks */
export async function getIndustryLogbooks(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id: userId, tenant: userTenant } = req.user!;
    const { status } = logbookQuerySchema.parse(req.query);

    const students = await Student.find({ supervisor: userId, tenant: userTenant });
    const studentIds = students.map(s => s._id);
    const filter: any = { student: { $in: studentIds }, tenant: userTenant };
    if (status) filter.status = status;

    const entries = await Logbook.find(filter)
      .populate({ path: 'student', populate: { path: 'user', select: 'firstName lastName email' } })
      .sort({ entryDate: -1 });

    res.json({ entries, studentCount: students.length });
  } catch (err) {
    logger.error('getIndustryLogbooks error: %s', (err as Error).message);
    res.status(500).json({ error: 'Server error' });
  }
}
