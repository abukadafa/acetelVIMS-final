import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import Student from '../models/Student.model';
import User from '../models/User.model';
import Programme from '../models/Programme.model';
import Logbook from '../models/Logbook.model';
import NotificationModel from '../models/notification.model';
import { autoAllocateStudent } from '../utils/allocation.service';
import logger from '../utils/logger';
import { z } from 'zod';
import AuditLog from '../models/AuditLog.model';
import Company from '../models/Company.model';
import { sendApprovedPostingNotifications } from '../services/placementNotification.service';
import { maskCompanyForStudentView } from '../utils/studentView.util';

const STATE_COORDS: Record<string, { lat: number; lng: number }> = {
  fct: { lat: 9.0765, lng: 7.3986 },
  lagos: { lat: 6.5244, lng: 3.3792 },
  kano: { lat: 12.0022, lng: 8.5920 },
  kaduna: { lat: 10.5105, lng: 7.4165 },
  rivers: { lat: 4.8156, lng: 7.0498 },
  oyo: { lat: 7.3775, lng: 3.9470 },
  enugu: { lat: 6.4584, lng: 7.5464 },
  ogun: { lat: 7.1608, lng: 3.3487 },
  anambra: { lat: 6.2209, lng: 6.9369 },
  akwaibom: { lat: 5.0077, lng: 7.8497 },
  abia: { lat: 5.4527, lng: 7.5248 },
  bauchi: { lat: 10.3158, lng: 9.8442 },
  benue: { lat: 7.1906, lng: 8.1292 },
  borno: { lat: 11.8846, lng: 13.1519 },
  crossriver: { lat: 5.8702, lng: 8.5988 },
  delta: { lat: 5.7040, lng: 5.9339 },
  ebonyi: { lat: 6.2649, lng: 8.0137 },
  edo: { lat: 6.6342, lng: 5.9304 },
  ekiti: { lat: 7.7190, lng: 5.3110 },
  gombe: { lat: 10.2897, lng: 11.1673 },
  imo: { lat: 5.5720, lng: 7.0588 },
  jigawa: { lat: 12.2280, lng: 9.5616 },
  katsina: { lat: 12.9886, lng: 7.6006 },
  kebbi: { lat: 12.4539, lng: 4.1975 },
  kogi: { lat: 7.8020, lng: 6.7333 },
  kwara: { lat: 8.9669, lng: 4.3874 },
  nasarawa: { lat: 8.5378, lng: 8.3220 },
  niger: { lat: 9.9309, lng: 5.5983 },
  ondo: { lat: 7.2508, lng: 5.2103 },
  osun: { lat: 7.5629, lng: 4.5199 },
  plateau: { lat: 9.2182, lng: 9.5179 },
  sokoto: { lat: 13.0059, lng: 5.2476 },
  taraba: { lat: 8.8932, lng: 11.3604 },
  yobe: { lat: 12.2939, lng: 11.4390 },
  zamfara: { lat: 12.1222, lng: 6.2236 },
  adamawa: { lat: 9.3265, lng: 12.3984 },
  bayelsa: { lat: 4.7719, lng: 6.0699 },
};

function stateKey(state?: string): string {
  return String(state || '').toLowerCase().replace(/[^a-z]/g, '');
}

const studentQuerySchema = z.object({
  programme: z.string().optional(),
  status: z.enum(['pending', 'active', 'completed', 'withdrawn', 'suspended']).optional(),
  company: z.string().optional(),
  session: z.string().optional(),
  search: z.string().optional(),
});

const studentUpdateSchema = z.object({
  matricNumber: z.string().min(5).optional(),
  programme: z.string().optional(),
  academicSession: z.string().optional(),
  level: z.string().optional(),
  status: z.enum(['pending', 'active', 'completed', 'withdrawn', 'suspended']).optional(),
  personalEmail: z.string().email().optional(),
  gender: z.enum(['Male', 'Female', 'Other']).optional(),
  stateOfOrigin: z.string().optional(),
  lga: z.string().optional(),
  address: z.string().optional(),
  company: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid company ID').optional(),
  postingApproved: z.boolean().optional(),
});

const locationUpdateSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

const idParamSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID format'),
});

export async function getAllStudents(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { programme, status, company, session, search } = studentQuerySchema.parse(req.query);
    const { role: userRole, programme: userProg, tenant: userTenant } = req.user!;
    
    let query: any = { tenant: userTenant };

    if (programme) query.programme = programme;
    if (status) query.status = status;
    if (company) query.company = company;
    if (session) query.academicSession = session;

    // Programme Isolation for non-admins
    if (userRole !== 'admin') {
      query.programme = userProg;
    }

    if (search) {
      // Escape special regex characters to prevent ReDoS attacks
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const rx = new RegExp(escaped, 'i');
      // Search matching User fields (firstName, lastName, email) + Student fields
      const matchedUsers = await User.find({
        tenant: userTenant,
        $or: [
          { firstName: rx },
          { lastName:  rx },
          { email:     rx },
        ],
      }).distinct('_id');

      query.$or = [
        { matricNumber:    rx },
        { academicSession: rx },
        ...(matchedUsers.length ? [{ user: { $in: matchedUsers } }] : []),
      ];
    }

    const students = await Student.find(query)
      .populate('user', '-password')
      .populate('programme')
      .populate('company')
      .populate('supervisor', 'firstName lastName');

    res.json({ students, total: students.length });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    logger.error('Error in getAllStudents: %s', (err as Error).message);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function getStudentById(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = idParamSchema.parse(req.params);
    const { role: userRole, tenant: userTenant, id: userId } = req.user!;

    const student = await Student.findOne({ _id: id, tenant: userTenant })
      .populate('user', '-password')
      .populate('programme')
      .populate('company')
      .populate('supervisor', 'firstName lastName email phone');

    if (!student) {
      res.status(404).json({ error: 'Student not found in your institution' });
      return;
    }

    // RBAC: If not admin/coordinator, check if it's their own profile or their student
    const privilegedRoles = ['admin', 'prog_coordinator', 'internship_coordinator', 'ict_support'];
    if (!privilegedRoles.includes(userRole)) {
      const isOwner = student.user?._id.toString() === userId;
      const isSupervisor = student.supervisor?._id.toString() === userId;
      
      if (!isOwner && !isSupervisor) {
        logger.warn('IDOR Attempt: User %s tried to access student %s', userId, id);
        res.status(403).json({ error: 'Access denied' });
        return;
      }
    }

    const logbookSummary = {
      totalEntries: await Logbook.countDocuments({ student: student._id, tenant: userTenant }),
      approved: await Logbook.countDocuments({ student: student._id, tenant: userTenant, status: 'approved' }),
      pending: await Logbook.countDocuments({ student: student._id, tenant: userTenant, status: 'submitted' })
    };

    res.json({ student: maskCompanyForStudentView(student, userRole), logbookSummary });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    logger.error('Error in getStudentById: %s', (err as Error).message);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function updateStudent(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = idParamSchema.parse(req.params);
    const data = studentUpdateSchema.parse(req.body);
    const { tenant: userTenant, role: userRole, id: userId } = req.user!;

    const student = await Student.findOne({ _id: id, tenant: userTenant });
    if (!student) {
      res.status(404).json({ error: 'Student not found or access denied' });
      return;
    }

    // RBAC: Only admin/coordinators can update someone else's profile. Students can only update their own.
    const privilegedRoles = ['admin', 'prog_coordinator', 'internship_coordinator'];
    if (!privilegedRoles.includes(userRole) && student.user?.toString() !== userId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const prevCompanyId = student.company?.toString() || null;
    const wasPostingApproved = student.postingApproved;

    if (data.company !== undefined && data.company !== prevCompanyId) {
      student.postingApproved = false;
      student.postingApprovedAt = undefined;
      student.postingApprovedBy = undefined;
      if (data.company) student.status = 'pending';
    }

    if (data.postingApproved === true && !student.company) {
      res.status(400).json({ error: 'Assign a company before approving the posting' });
      return;
    }

    const { postingApproved, ...rest } = data;
    Object.assign(student, rest);
    if (postingApproved === true) {
      student.postingApproved = true;
      student.postingApprovedAt = new Date();
      student.postingApprovedBy = userId as any;
      student.status = 'active';
    } else if (postingApproved === false) {
      student.postingApproved = false;
    }

    await student.save();

    // Audit (admin/coordinators updating student profile)
    if (userRole !== 'student') {
      await AuditLog.create({
        tenant: userTenant,
        user: userId as any,
        action: 'UPDATE_STUDENT',
        module: 'STUDENT_MANAGEMENT',
        targetId: student._id,
        details: `Updated student profile: ${student.matricNumber}`,
        ipAddress: (req as any).ip,
      }).catch(() => {});
    }

    let notifyResult = null;
    if (student.postingApproved && student.company && (!wasPostingApproved || data.company !== undefined)) {
      notifyResult = await sendApprovedPostingNotifications(student._id.toString(), userId);
    }

    res.json({ message: 'Student updated successfully', student, postingNotifications: notifyResult });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    logger.error('Error in updateStudent: %s', (err as Error).message);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function approvePosting(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = idParamSchema.parse(req.params);
    const { tenant: userTenant, id: userId, role: userRole } = req.user!;
    const approverRoles = ['admin', 'prog_coordinator', 'internship_coordinator'];
    if (!approverRoles.includes(userRole)) {
      res.status(403).json({ error: 'Only coordinators can approve postings' });
      return;
    }

    const student = await Student.findOne({ _id: id, tenant: userTenant });
    if (!student) {
      res.status(404).json({ error: 'Student not found' });
      return;
    }
    if (!student.company) {
      res.status(400).json({ error: 'Student has no company assignment to approve' });
      return;
    }

    student.postingApproved = true;
    student.postingApprovedAt = new Date();
    student.postingApprovedBy = userId as any;
    student.status = 'active';
    await student.save();

    const notifyResult = await sendApprovedPostingNotifications(student._id.toString(), userId);

    await AuditLog.create({
      tenant: userTenant,
      user: userId as any,
      action: 'APPROVE_POSTING',
      module: 'STUDENT_MANAGEMENT',
      targetId: student._id,
      details: `Approved internship posting for ${student.matricNumber}`,
      ipAddress: (req as any).ip,
    }).catch(() => {});

    res.json({
      message: 'Posting approved. Student and partner notified by email when delivery is configured.',
      student,
      postingNotifications: notifyResult,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    logger.error('approvePosting: %s', (err as Error).message);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function requestAllocation(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = idParamSchema.parse(req.params);
    const { tenant: userTenant } = req.user!;
    const student = await Student.findOne({ _id: id, tenant: userTenant });
    
    if (!student) {
      res.status(404).json({ error: 'Student not found' });
      return;
    }

    const result = await autoAllocateStudent(id);
    if (!result.success) {
      res.status(400).json({ error: result.message });
      return;
    }
    res.json({
      message: result.message || 'Student allocated successfully',
      allocation: result,
      pendingApproval: result.pendingApproval,
      company: result.company,
      success: result.success,
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    logger.error('Allocation Error: %s', err.message);
    res.status(500).json({ error: err.message || 'Allocation failed' });
  }
}

export async function getStudentDashboard(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id: userId, tenant: userTenant } = req.user!;
    const student = await Student.findOne({ user: userId, tenant: userTenant })
      .populate('user', '-password')
      .populate('programme')
      .populate('company')
      .populate('supervisor', 'firstName lastName email');

    if (!student) {
      res.status(404).json({ error: 'Student profile not found' });
      return;
    }

    const stats = {
      totalLogbooks: await Logbook.countDocuments({ student: student._id, tenant: userTenant }),
      approvedLogbooks: await Logbook.countDocuments({ student: student._id, tenant: userTenant, status: 'approved' }),
      attendanceDays: 0 // Placeholder
    };

    const notifications = await NotificationModel.find({ user: userId, tenant: userTenant, isRead: false })
      .sort({ createdAt: -1 })
      .limit(5);

    const recentLogbook = await Logbook.find({ student: student._id, tenant: userTenant })
      .sort({ entryDate: -1 })
      .limit(5);

    res.json({
      student: maskCompanyForStudentView(student, 'student'),
      stats,
      notifications,
      recentLogbook,
    });
  } catch (err) {
    logger.error('Dashboard Error: %s', (err as Error).message);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function deleteStudent(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = idParamSchema.parse(req.params);
    const { tenant: userTenant } = req.user!;
    const reason = String((req.body as any)?.reason || '').trim();
    if (!reason || reason.length < 5) {
      res.status(400).json({ error: 'A reason is required' });
      return;
    }

    const student = await Student.findOne({ _id: id, tenant: userTenant });
    if (!student) {
      res.status(404).json({ error: 'Student not found' });
      return;
    }
    
    // Soft delete linked user and student
    await User.findOneAndUpdate({ _id: student.user, tenant: userTenant }, { isDeleted: true, isActive: false });
    await Student.findOneAndUpdate({ _id: id, tenant: userTenant }, { isDeleted: true, status: 'withdrawn' });

    await AuditLog.create({
      tenant: userTenant,
      user: req.user!.id as any,
      action: 'DELETE_STUDENT',
      module: 'STUDENT_MANAGEMENT',
      targetId: student._id,
      reason,
      details: `Deactivated student: ${student.matricNumber}`,
      ipAddress: req.ip,
    }).catch(() => {});
    
    res.json({ message: 'Student record deactivated' });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    logger.error('Delete Error: %s', (err as Error).message);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function getProgrammes(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { tenant: userTenant } = req.user!;
    const programmes = await Programme.find({ tenant: userTenant, isActive: true }).sort({ level: 1, name: 1 });
    res.json({ programmes });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
}

export async function updateStudentLocation(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { lat, lng } = locationUpdateSchema.parse(req.body);
    const { id: userId, tenant: userTenant } = req.user!;

    let student = await Student.findOneAndUpdate(
      { user: userId, tenant: userTenant },
      { $set: { lat, lng, lastSeen: new Date() } },
      { new: true }
    );

    if (!student) {
      res.status(404).json({ error: 'Student not found' });
      return;
    }

    if (!student.company) {
      try {
        await autoAllocateStudent((student._id as any).toString());
        student = await Student.findById(student._id).populate('company') as any;
      } catch (allocErr) {
        logger.error('Auto-allocation failed during location update: %s', (allocErr as Error).message);
      }
    }

    res.json({ message: 'Location updated', student });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    logger.error('Location Update Error: %s', (err as Error).message);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function getAllStudentsForMap(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { tenant: userTenant } = req.user!;
    const students = await Student.find({
      tenant: userTenant,
      status: { $in: ['active', 'pending'] }
    })
      .populate('user', 'firstName lastName')
      .populate('programme', 'name level')
      .populate('company', 'name lat lng state');

    const mapped = students.map((s: any) => {
      const studentState = s.stateOfOrigin;
      const studentFallback = STATE_COORDS[stateKey(studentState)];
      const companyState = s.company?.state;
      const companyFallback = STATE_COORDS[stateKey(companyState)];

      const lat = s.lat ?? s.company?.lat ?? studentFallback?.lat;
      const lng = s.lng ?? s.company?.lng ?? studentFallback?.lng;

      const company = s.company ? {
        ...(s.company.toObject?.() ?? s.company),
        lat: s.company.lat ?? companyFallback?.lat,
        lng: s.company.lng ?? companyFallback?.lng,
      } : s.company;

      return {
        ...(s.toObject?.() ?? s),
        lat,
        lng,
        company,
      };
    });

    res.json({ students: mapped });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
}

export async function exportStudents(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { role: userRole, programme: userProg, tenant: userTenant } = req.user!;
    let query: any = { tenant: userTenant };
    if (userRole !== 'admin') {
      query.programme = userProg;
    }

    const students = await Student.find(query)
      .populate('user', 'firstName lastName email phone')
      .populate('programme', 'name code level')
      .populate('company', 'name')
      .populate('supervisor', 'firstName lastName')
      .sort({ createdAt: -1 });

    const q = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;

    let csv = 'Matric,First Name,Last Name,Email,Phone,Programme,Level,Company,Supervisor,Progress,Status\n';

    for (const s of students) {
      const u = s.user as any;
      const prog = s.programme as any;
      const comp = s.company as any;
      const sup = s.supervisor as any;

      const logCount = await Logbook.countDocuments({ student: s._id, tenant: userTenant, status: 'approved' });
      const progress = `${logCount} logs approved`;

      csv += [
        q(s.matricNumber),
        q(u?.firstName),
        q(u?.lastName),
        q(u?.email),
        q(u?.phone),
        q(prog?.name),
        q(prog?.level),
        q(comp?.name || 'Unassigned'),
        q(sup ? `${sup.firstName} ${sup.lastName}` : 'N/A'),
        q(progress),
        q(s.status),
      ].join(',') + '\n';
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=Students_${new Date().toISOString().split('T')[0]}.csv`);
    res.status(200).send(csv);
  } catch (err) {
    logger.error('Export Error: %s', (err as Error).message);
    res.status(500).json({ error: 'Data export failed' });
  }
}

