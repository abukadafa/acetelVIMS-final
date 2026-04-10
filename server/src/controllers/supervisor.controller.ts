import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import User from '../models/User.model';
import Student from '../models/Student.model';
import Logbook from '../models/Logbook.model';
import Assessment from '../models/Assessment.model';
import Notification from '../models/notification.model';
import { io } from '../index';
import logger from '../utils/logger';
import { z } from 'zod';

const supervisorQuerySchema = z.object({
  supervisorId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID format').optional(),
});

const assessmentSchema = z.object({
  studentId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID format'),
  type: z.enum(['monthly', 'final']),
  period: z.string().min(3),
  punctuality: z.number().min(1).max(5),
  attitude: z.number().min(1).max(5),
  technicalSkills: z.number().min(1).max(5),
  communication: z.number().min(1).max(5),
  initiative: z.number().min(1).max(5),
  comments: z.string().max(1000).optional(),
});

const createSupervisorSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(2),
  lastName: z.string().min(2),
  phone: z.string().optional(),
  username: z.string().optional(),
});

const messageSchema = z.object({
  recipientId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID format').optional(),
  programmeId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID format').optional(),
  subject: z.string().min(3).max(100),
  body: z.string().min(10).max(2000),
  isBulk: z.boolean().optional(),
});

export async function getSupervisorStudents(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { supervisorId: querySupId } = supervisorQuerySchema.parse(req.query);
    const { role: userRole, id: userId, tenant: userTenant } = req.user!;
    const supervisorId = userRole === 'supervisor' ? userId : querySupId;
    
    if (!supervisorId) {
      res.status(400).json({ error: 'Supervisor ID is required' });
      return;
    }

    let query: any = { supervisor: supervisorId, tenant: userTenant, isDeleted: false };
    
    const students = await Student.find(query)
      .populate('user', '-password')
      .populate('programme')
      .populate('company');

    const studentsWithStats = await Promise.all(
      students.map(async (s) => {
        const logbookCount = await Logbook.countDocuments({ student: s._id, tenant: userTenant });
        const pendingReviews = await Logbook.countDocuments({ student: s._id, tenant: userTenant, status: 'submitted' });
        return { 
          ...s.toObject(), 
          logbookCount, 
          pendingReviews,
          attendanceDays: 0 
        };
      })
    );

    res.json({ students: studentsWithStats });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    logger.error('Error in getSupervisorStudents: %s', (err as Error).message);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function getPendingReviews(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id: supervisorId, tenant: userTenant } = req.user!;
    
    const studentIds = await Student.find({ supervisor: supervisorId, tenant: userTenant }).distinct('_id');

    const entries = await Logbook.find({ 
      student: { $in: studentIds },
      tenant: userTenant,
      status: 'submitted'
    })
    .populate({
      path: 'student',
      populate: [
        { path: 'user', select: 'firstName lastName' },
        { path: 'programme', select: 'name' },
        { path: 'company', select: 'name' }
      ]
    })
    .sort({ entryDate: 1 });

    res.json({ entries, count: entries.length });
  } catch (err) {
    logger.error('Error in getPendingReviews: %s', (err as Error).message);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function submitAssessment(req: AuthRequest, res: Response): Promise<void> {
  try {
    const data = assessmentSchema.parse(req.body);
    const { id: supervisorId, tenant: userTenant } = req.user!;
    
    const student = await Student.findOne({ _id: data.studentId, tenant: userTenant, supervisor: supervisorId });
    if (!student) {
      res.status(403).json({ error: 'Access denied or student not assigned to you' });
      return;
    }

    const assessment = new Assessment({
      ...data,
      supervisor: supervisorId,
      tenant: userTenant,
    });

    await assessment.save();

    student.overallScore = assessment.overallScore;
    await student.save();

    const notification = new Notification({
      user: student.user,
      tenant: userTenant,
      title: 'Assessment Completed',
      message: `Your ${data.type.replace('_',' ')} assessment has been submitted. Score: ${assessment.overallScore?.toFixed(1)}/20`,
      type: 'success'
    });
    await notification.save();
    
    io.to(`user:${student.user}`).emit('notification', { 
      title: notification.title, 
      score: assessment.overallScore 
    });

    logger.info('Assessment submitted for student %s by supervisor %s', data.studentId, supervisorId);
    res.status(201).json({ message: 'Assessment submitted', assessment });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    logger.error('Error in submitAssessment: %s', (err as Error).message);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function getAllSupervisors(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { tenant: userTenant } = req.user!;
    
    const supervisors = await User.find({ role: 'supervisor', tenant: userTenant, isDeleted: false })
      .select('-password')
      .sort({ lastName: 1 });
    
    const supervisorsWithCount = await Promise.all(
      supervisors.map(async (u) => {
        const assignedCount = await Student.countDocuments({ supervisor: u._id, tenant: userTenant, isDeleted: false });
        return { ...u.toObject(), assignedStudents: assignedCount };
      })
    );

    res.json({ supervisors: supervisorsWithCount });
  } catch (err) {
    logger.error('Error in getAllSupervisors: %s', (err as Error).message);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function createSupervisor(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { email, firstName, lastName, phone, username } = createSupervisorSchema.parse(req.body);
    const { tenant: userTenant } = req.user!;
    
    const existing = await User.findOne({ 
      tenant: userTenant,
      $or: [{ email: email.toLowerCase() }, { username: (username || email).toLowerCase() }] 
    });
    if (existing) {
      res.status(409).json({ error: 'Email or username already exists in your institution' });
      return;
    }

    const supervisor = new User({
      email: email.toLowerCase(),
      username: (username || email).toLowerCase(),
      password: 'StaffPassword@123', // Admin will need to reset this or use flow
      role: 'supervisor',
      tenant: userTenant,
      firstName,
      lastName,
      phone
    });

    await supervisor.save();
    
    logger.info('Supervisor created: %s by user %s', supervisor._id, req.user!.id);
    res.status(201).json({ message: 'Supervisor created successfully', id: supervisor._id });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    logger.error('Error in createSupervisor: %s', (err as Error).message);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function sendMessage(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { recipientId, programmeId, subject, body, isBulk } = messageSchema.parse(req.body);
    const { tenant: userTenant } = req.user!;
    
    if (isBulk && programmeId) {
      const studentUsers = await Student.find({ programme: programmeId, tenant: userTenant }).distinct('user');
      
      for (const userId of studentUsers) {
        const notification = new Notification({
          user: userId,
          tenant: userTenant,
          title: subject,
          message: body,
          type: 'info'
        });
        await notification.save();
        io.to(`user:${userId}`).emit('notification', { title: subject });
      }
    } else if (recipientId) {
      const recipient = await User.findOne({ _id: recipientId, tenant: userTenant });
      if (!recipient) {
        res.status(403).json({ error: 'Recipient not found in your institution' });
        return;
      }

      const notification = new Notification({
        user: recipientId,
        tenant: userTenant,
        title: subject,
        message: body,
        type: 'info'
      });
      await notification.save();
      io.to(`user:${recipientId}`).emit('notification', { title: subject });
    }

    res.status(201).json({ message: 'Message sent' });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    logger.error('Error in sendMessage: %s', (err as Error).message);
    res.status(500).json({ error: 'Server error' });
  }
}
