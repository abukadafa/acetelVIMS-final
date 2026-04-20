import mongoose from 'mongoose';
import { Response } from 'express';
import User from '../models/User.model';
import Programme from '../models/Programme.model';
import { AuthRequest } from '../middleware/auth.middleware';
import bcrypt from 'bcryptjs';
import AuditLog from '../models/AuditLog.model';
import Student from '../models/Student.model';
import Company from '../models/Company.model';
import { z } from 'zod';

const STAFF_ROLES = ['admin', 'prog_coordinator', 'internship_coordinator', 'ict_support', 'supervisor'];

const userListQuerySchema = z.object({
  role: z.enum(['admin', 'prog_coordinator', 'internship_coordinator', 'ict_support', 'supervisor']).optional(),
  programme: z.string().optional(),
  search: z.string().optional(),
  page: z.preprocess((val) => Number(val) || 1, z.number().min(1).default(1)),
  limit: z.preprocess((val) => Number(val) || 50, z.number().min(1).max(100).default(50)),
});

const createUserSchema = z.object({
  firstName: z.string().min(2),
  lastName: z.string().min(2),
  email: z.string().email(),
  role: z.enum(['prog_coordinator', 'internship_coordinator', 'ict_support', 'supervisor']),
  programme: z.string().optional(),
  phone: z.string().optional(),
  password: z.string().min(8).optional(),
});

const createStudentSchema = z.object({
  firstName: z.string().min(2),
  lastName: z.string().min(2),
  email: z.string().email(),
  matricNumber: z.string().min(5),
  programme: z.string().optional(),
  phone: z.string().optional(),
  password: z.string().min(8).optional(),
  personalEmail: z.string().email().optional(),
  gender: z.enum(['Male', 'Female', 'Other']).optional(),
  isNigerian: z.boolean().optional(),
  address: z.string().optional(),
  academicSession: z.string().optional(),
  level: z.string().optional(),
});

const updateUserSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().optional(),
  role: z.enum(['prog_coordinator', 'internship_coordinator', 'ict_support', 'supervisor']).optional(),
  programme: z.string().optional(),
  isActive: z.boolean().optional(),
  resetPassword: z.boolean().optional(),
  reason: z.string().min(5),
});

const idParamSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID format'),
});

const auditLogsQuerySchema = z.object({
  targetId: z.string().optional(),
  module: z.string().optional(),
  action: z.string().optional(),
  limit: z.preprocess((val) => Number(val) || 100, z.number().min(1).max(1000).default(100)),
});

/** GET /api/admin/users  — all staff users */
export async function listUsers(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { role, programme, search, page, limit } = userListQuerySchema.parse(req.query);
    const tenantId = req.user!.tenant;

    const filter: Record<string, any> = { 
      tenant: tenantId,
      role: { $in: STAFF_ROLES },
      isDeleted: { $ne: true } 
    };
    
    // Programme Isolation
    if (req.user!.role !== 'admin') {
      filter.programme = req.user!.programme;
    } else if (programme) {
      filter.programme = programme;
    }

    if (role) filter.role = role;
    if (search) {
      const rx = new RegExp(search, 'i');
      filter.$or = [{ firstName: rx }, { lastName: rx }, { email: rx }];
    }

    const skip = (page - 1) * limit;
    const [users, total] = await Promise.all([
      User.find(filter)
        .select('-password')
        .populate('programme', 'code name level')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      User.countDocuments(filter),
    ]);

    // Role-wise counts for current tenant
    const counts = await User.aggregate([
      { $match: { tenant: new mongoose.Types.ObjectId(tenantId), role: { $in: STAFF_ROLES } } },
      { $group: { _id: '$role', count: { $sum: 1 } } },
    ]);

    res.json({ users, total, counts });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

/** POST /api/admin/users  — create a new staff user */
export async function createUser(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { firstName, lastName, email, role, programme, phone, password } = createUserSchema.parse(req.body);
    const tenantId = req.user!.tenant;

    const existing = await User.findOne({ 
      tenant: tenantId,
      email: email.toLowerCase() 
    });
    if (existing) {
      res.status(409).json({ error: 'Email already in use in this institution' });
      return;
    }

    let targetProgramme = programme;
    // Programme Isolation for Creation
    if (req.user!.role !== 'admin') {
      targetProgramme = req.user!.programme;
    }

    // Programme required for role that is programme-scoped
    const programmeScoped = ['prog_coordinator', 'ict_support'];
    if (programmeScoped.includes(role) && !targetProgramme) {
      res.status(400).json({ error: `A programme must be selected for role: ${role}` });
      return;
    }

    // Ensure programme exists if provided
    if (targetProgramme) {
      const prog = await Programme.findOne({ _id: targetProgramme, tenant: tenantId });
      if (!prog) {
        res.status(400).json({ error: 'Programme not found in your institution' });
        return;
      }
    }

    const tempPassword = password || `Staff@${Math.floor(1000 + Math.random() * 9000)}`;

    const user = new User({
      firstName,
      lastName,
      email: email.toLowerCase(),
      username: email.toLowerCase(),
      password: tempPassword,
      role,
      phone,
      programme: targetProgramme || undefined,
      tenant: tenantId,
      isActive: true,
    });

    await user.save();

    const saved = await User.findById(user._id)
      .select('-password')
      .populate('programme', 'code name level');

    res.status(201).json({
      user: saved,
      tempPassword,
      message: 'Staff user created successfully',
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function createStudent(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { 
      firstName, lastName, email, matricNumber, 
      programme, phone, password, 
      personalEmail, gender, isNigerian, address,
      academicSession, level 
    } = createStudentSchema.parse(req.body);
    const tenantId = req.user!.tenant;

    // Programme Isolation
    const targetProgramme = req.user!.role !== 'admin' ? req.user!.programme : programme;

    if (!targetProgramme) {
      res.status(400).json({ error: 'A programme must be selected' });
      return;
    }

    const existingUser = await User.findOne({ 
      tenant: tenantId,
      $or: [
        { email: email.toLowerCase() },
        { username: matricNumber.toLowerCase() }
      ] 
    });
    if (existingUser) {
      res.status(409).json({ error: 'Identity (Email or Matric Number) already in use in this institution' });
      return;
    }

    const existingMatric = await Student.findOne({ tenant: tenantId, matricNumber });
    if (existingMatric) {
      res.status(409).json({ error: 'Matric number already registered' });
      return;
    }

    const tempPassword = password || `Student@${Math.floor(1000 + Math.random() * 9000)}`;

    const user = new User({
      firstName,
      lastName,
      email: email.toLowerCase(),
      username: matricNumber.toLowerCase(),
      password: tempPassword,
      role: 'student',
      phone,
      tenant: tenantId,
      isActive: true,
    });

    await user.save();

    const student = new Student({
      user: user._id,
      tenant: tenantId,
      matricNumber,
      programme: targetProgramme,
      academicSession: academicSession || '2024/2025',
      level: level || 'MSc',
      status: 'pending',
      personalEmail,
      gender,
      isNigerian: isNigerian ?? true,
      address
    });

    await student.save();

    await AuditLog.create({
      tenant: tenantId,
      user: req.user!.id,
      action: 'CREATE_STUDENT',
      module: 'STUDENT_MANAGEMENT',
      targetId: student._id,
      details: `Onboarded student ${email} for programme ${targetProgramme}`,
      ipAddress: req.ip
    });

    res.status(201).json({
      message: 'Student onboarded successfully',
      tempPassword
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

/** PUT /api/admin/users/:id */
export async function updateUser(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = idParamSchema.parse(req.params);
    const { firstName, lastName, phone, role, programme, isActive, resetPassword, reason } = updateUserSchema.parse(req.body);
    const tenantId = req.user!.tenant;

    const user = await User.findOne({ _id: id, tenant: tenantId });
    if (!user) {
      res.status(404).json({ error: 'User not found in your institution' });
      return;
    }

    // Single Admin Policy: Do not allow promoting other users to admin
    if ((role as string) === 'admin' && user.role !== 'admin') {
      res.status(403).json({ error: 'The Administrator role is unique and cannot be assigned to other users.' });
      return;
    }

    // Role Allocation Restriction: Only admin can change roles
    if (role && role !== user.role && req.user!.role !== 'admin') {
      res.status(403).json({ error: 'Only administrators can allocate or change user roles' });
      return;
    }

    if (firstName)  user.firstName = firstName;
    if (lastName)   user.lastName  = lastName;
    if (phone)      user.phone     = phone;
    if (role)       user.role      = role;
    if (programme !== undefined) user.programme = (programme as any) || undefined;
    if (isActive   !== undefined) user.isActive = isActive;

    let newPassword: string | undefined;
    if (resetPassword) {
      newPassword = `Reset@${Math.floor(1000 + Math.random() * 9000)}`;
      user.password = newPassword;
    }

    await user.save();

    // Log update
    await AuditLog.create({
      tenant: tenantId,
      user: req.user!.id,
      action: 'UPDATE_USER',
      module: 'USER_MANAGEMENT',
      targetId: id,
      reason,
      details: `Updated staff profile for ${user.email}${resetPassword ? ' (Password Reset)' : ''}`,
      ipAddress: req.ip
    });

    const updated = await User.findById(id)
      .select('-password')
      .populate('programme', 'code name level');

    res.json({ user: updated, newPassword, message: 'User profile updated successfully' });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

/** DELETE /api/admin/users/:id  — soft delete */
export async function deactivateUser(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = idParamSchema.parse(req.params);
    const { reason } = req.body;
    const tenantId = req.user!.tenant;

    if (id === req.user!.id) {
      res.status(400).json({ error: 'You cannot delete your own account' });
      return;
    }

    if (!reason) {
      res.status(400).json({ error: 'A reason must be provided for deleting a user' });
      return;
    }

    const user = await User.findOne({ _id: id, tenant: tenantId });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    user.isDeleted = true;
    user.isActive = false;
    user.deletedAt = new Date();
    user.deletedBy = req.user!.id as any;
    user.deleteReason = reason;
    await user.save();

    // Log audit
    await AuditLog.create({
      tenant: tenantId,
      user: req.user!.id,
      action: 'DELETE_USER',
      module: 'USER_MANAGEMENT',
      targetId: id,
      reason,
      details: `Soft-deleted user ${user.email}`,
      ipAddress: req.ip
    });

    res.json({ message: 'User moved to recycle bin', user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

/** GET /api/admin/recycle-bin */
export async function listRecycleBin(req: AuthRequest, res: Response): Promise<void> {
  try {
    const tenantId = req.user!.tenant;
    const userFilter: any = { tenant: tenantId, isDeleted: true };
    const studentFilter: any = { tenant: tenantId, isDeleted: true };
    const companyFilter: any = { tenant: tenantId, isDeleted: true };
    
    if (req.user!.role !== 'admin') {
      userFilter.programme = req.user!.programme;
      studentFilter.programme = req.user!.programme;
    }

    const deletedUsers = await User.find(userFilter)
      .select('-password')
      .populate('programme', 'code name')
      .populate('deletedBy', 'firstName lastName')
      .sort({ deletedAt: -1 });

    const deletedStudents = await Student.find(studentFilter)
      .populate('user', 'firstName lastName email')
      .populate('programme', 'code name')
      .populate('deletedBy', 'firstName lastName')
      .sort({ deletedAt: -1 });

    const deletedCompanies = await Company.find(companyFilter)
      .populate('deletedBy', 'firstName lastName')
      .sort({ deletedAt: -1 });

    res.json({ users: deletedUsers, students: deletedStudents, companies: deletedCompanies });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

/** GET /api/admin/audit-logs */
export async function getAuditLogs(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { targetId, module, action, limit } = auditLogsQuerySchema.parse(req.query);
    const tenantId = req.user!.tenant;
    
    const filter: Record<string, any> = { tenant: tenantId };
    if (targetId) filter.targetId = targetId;
    if (module)   filter.module = module;
    if (action)   filter.action = action;

    // Programme Isolation: non-admins can only see logs for users in their programme
    if (req.user!.role !== 'admin' && req.user!.programme) {
      const programmeUsers = await User.find({ tenant: tenantId, programme: req.user!.programme }).distinct('_id');
      const programmeStudents = await Student.find({ tenant: tenantId, programme: req.user!.programme }).distinct('_id');
      filter.$or = [
        { user: { $in: programmeUsers } },
        { targetId: { $in: [...programmeUsers.map(String), ...programmeStudents.map(String)] } },
      ];
    }

    const logs = await AuditLog.find(filter)
      .populate('user', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .limit(limit);

    res.json({ logs });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

/** GET /api/admin/programmes  — active programmes for current tenant */
export async function listProgrammes(req: AuthRequest, res: Response): Promise<void> {
  try {
    const tenantId = req.user!.tenant;
    const programmes = await Programme.find({ tenant: tenantId, isActive: true }).sort({ name: 1 });
    res.json({ programmes });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
}

/** POST /api/admin/users/permanent-delete/:id — hard delete (admin only) */
export async function permanentDeleteUser(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = idParamSchema.parse(req.params);
    const { reason } = req.body;
    const approvalMemo = req.file?.filename;
    const tenantId = req.user!.tenant;

    if (!reason) { res.status(400).json({ error: 'A reason is required' }); return; }
    if (!approvalMemo) { res.status(400).json({ error: 'An approval memo document must be uploaded' }); return; }

    const user = await User.findOne({ _id: id, tenant: tenantId });
    if (!user) { res.status(404).json({ error: 'User not found in your institution' }); return; }

    await AuditLog.create({
      tenant: tenantId,
      user: req.user!.id,
      action: 'PERMANENT_DELETE_USER',
      module: 'RECYCLE_BIN',
      targetId: id,
      reason,
      details: `Permanently deleted user ${user.email}. Memo: ${approvalMemo}`,
      ipAddress: req.ip,
    });

    await User.findByIdAndDelete(id);
    res.json({ message: 'User permanently deleted' });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

/** POST /api/admin/users/restore/:id */
export async function restoreUser(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = idParamSchema.parse(req.params);
    const { reason } = req.body;
    const approvalMemo = req.file?.filename;
    const tenantId = req.user!.tenant;

    if (!reason) { res.status(400).json({ error: 'A reason is required' }); return; }
    if (!approvalMemo) { res.status(400).json({ error: 'An approval memo document must be uploaded' }); return; }

    const user = await User.findOne({ _id: id, tenant: tenantId });
    if (!user) { res.status(404).json({ error: 'User not found in your institution' }); return; }

    user.isDeleted = false;
    user.isActive = true;
    user.lastEditReason = `Restore: ${reason}`;
    await user.save();

    await AuditLog.create({
      tenant: tenantId,
      user: req.user!.id,
      action: 'RESTORE_USER',
      module: 'RECYCLE_BIN',
      targetId: id,
      reason,
      details: `Restored user ${user.email}. Memo: ${approvalMemo}`,
      ipAddress: req.ip,
    });

    res.json({ message: 'User restored successfully', user });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

/** POST /api/admin/students/restore/:id */
export async function restoreStudent(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = idParamSchema.parse(req.params);
    const { reason } = req.body;
    const approvalMemo = req.file?.filename;
    const tenantId = req.user!.tenant;

    if (!reason) { res.status(400).json({ error: 'A reason is required' }); return; }
    if (!approvalMemo) { res.status(400).json({ error: 'An approval memo document must be uploaded' }); return; }

    const student = await Student.findOne({ _id: id, tenant: tenantId });
    if (!student) { res.status(404).json({ error: 'Student not found in your institution' }); return; }

    student.isDeleted = false;
    await student.save();

    // Also reactivate the linked user account
    await User.findByIdAndUpdate(student.user, { isDeleted: false, isActive: true });

    await AuditLog.create({
      tenant: tenantId,
      user: req.user!.id,
      action: 'RESTORE_STUDENT',
      module: 'RECYCLE_BIN',
      targetId: id,
      reason,
      details: `Restored student record ${student.matricNumber}. Memo: ${approvalMemo}`,
      ipAddress: req.ip,
    });

    res.json({ message: 'Student restored successfully' });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

/** POST /api/admin/students/permanent-delete/:id */
export async function permanentDeleteStudent(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = idParamSchema.parse(req.params);
    const { reason } = req.body;
    const approvalMemo = req.file?.filename;
    const tenantId = req.user!.tenant;

    if (!reason) { res.status(400).json({ error: 'A reason is required' }); return; }
    if (!approvalMemo) { res.status(400).json({ error: 'An approval memo document must be uploaded' }); return; }

    const student = await Student.findOne({ _id: id, tenant: tenantId });
    if (!student) { res.status(404).json({ error: 'Student not found in your institution' }); return; }

    await AuditLog.create({
      tenant: tenantId,
      user: req.user!.id,
      action: 'PERMANENT_DELETE_STUDENT',
      module: 'RECYCLE_BIN',
      targetId: id,
      reason,
      details: `Permanently deleted student ${student.matricNumber}. Memo: ${approvalMemo}`,
      ipAddress: req.ip,
    });

    await User.findByIdAndDelete(student.user);
    await Student.findByIdAndDelete(id);
    res.json({ message: 'Student permanently deleted' });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

/** POST /api/admin/companies/restore/:id */
export async function restoreCompany(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = idParamSchema.parse(req.params);
    const { reason } = req.body;
    const approvalMemo = req.file?.filename;
    const tenantId = req.user!.tenant;

    if (!reason) { res.status(400).json({ error: 'A reason is required' }); return; }
    if (!approvalMemo) { res.status(400).json({ error: 'An approval memo document must be uploaded' }); return; }

    const company = await Company.findOneAndUpdate(
      { _id: id, tenant: tenantId },
      { isDeleted: false, $unset: { deletedAt: 1, deletedBy: 1, deleteReason: 1 } },
      { new: true }
    );
    if (!company) { res.status(404).json({ error: 'Company not found in your institution' }); return; }

    await AuditLog.create({
      tenant: tenantId,
      user: req.user!.id,
      action: 'RESTORE_COMPANY',
      module: 'RECYCLE_BIN',
      targetId: id,
      reason,
      details: `Restored partner company ${company.name}. Memo: ${approvalMemo}`,
      ipAddress: req.ip,
    });

    res.json({ message: 'Company restored successfully' });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

/** POST /api/admin/companies/permanent-delete/:id */
export async function permanentDeleteCompany(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = idParamSchema.parse(req.params);
    const { reason } = req.body;
    const approvalMemo = req.file?.filename;
    const tenantId = req.user!.tenant;

    if (!reason) { res.status(400).json({ error: 'A reason is required' }); return; }
    if (!approvalMemo) { res.status(400).json({ error: 'An approval memo document must be uploaded' }); return; }

    const company = await Company.findOne({ _id: id, tenant: tenantId });
    if (!company) { res.status(404).json({ error: 'Company not found in your institution' }); return; }

    await AuditLog.create({
      tenant: tenantId,
      user: req.user!.id,
      action: 'PERMANENT_DELETE_COMPANY',
      module: 'RECYCLE_BIN',
      targetId: id,
      reason,
      details: `Permanently deleted partner ${company.name}. Memo: ${approvalMemo}`,
      ipAddress: req.ip,
    });

    await Company.findByIdAndDelete(id);
    res.json({ message: 'Company permanently deleted' });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}


/** GET /api/admin/audit-logs/export */
export async function exportSecurityAudit(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { targetId, module, action } = req.query as Record<string, string>;
    const tenantId = req.user!.tenant;
    
    const filter: Record<string, any> = { tenant: tenantId };
    if (targetId) filter.targetId = targetId;
    if (module)   filter.module = module;
    if (action)   filter.action = action;

    // Programme Isolation
    if (req.user!.role !== 'admin' && req.user!.programme) {
      const programmeUsers = await User.find({ tenant: tenantId, programme: req.user!.programme }).distinct('_id');
      const programmeStudents = await Student.find({ tenant: tenantId, programme: req.user!.programme }).distinct('_id');
      filter.$or = [
        { user: { $in: programmeUsers } },
        { targetId: { $in: [...programmeUsers.map(String), ...programmeStudents.map(String)] } },
      ];
    }

    const logs = await AuditLog.find(filter)
      .populate('user', 'firstName lastName email role')
      .sort({ createdAt: -1 });

    const headers = ['Timestamp', 'Actor', 'Email', 'Role', 'Action', 'Module', 'Target ID', 'Reason', 'Details', 'IP Address'];
    const rows = logs.map(l => {
      const u = (l.user as any) || {};
      return [
        `"${l.createdAt.toISOString()}"`,
        `"${u.firstName ? `${u.firstName} ${u.lastName}` : 'System'}"`,
        `"${u.email || 'N/A'}"`,
        `"${u.role || 'N/A'}"`,
        `"${l.action}"`,
        `"${l.module}"`,
        `"${l.targetId || 'N/A'}"`,
        `"${l.reason || 'N/A'}"`,
        `"${l.details?.replace(/"/g, '""') || ''}"`,
        `"${l.ipAddress || 'N/A'}"`
      ];
    });

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=acetel_security_audit_${new Date().getTime()}.csv`);
    res.status(200).send(csvContent);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

/** 
 * POST /api/admin/bulk-onboard
 */
export async function bulkOnboard(req: AuthRequest, res: Response): Promise<void> {
  const { type, data } = req.body; 
  const tenantId = req.user!.tenant;
  
  if (!Array.isArray(data)) {
    res.status(400).json({ error: 'Data must be an array of objects' });
    return;
  }

  const results = {
    success: [] as any[],
    failed: [] as any[],
    total: data.length
  };

  try {
    // Cache programmes for faster mapping for current tenant
    const allProgs = await Programme.find({ tenant: tenantId }).select('code _id');
    const progMap = allProgs.reduce((acc, p) => {
      acc[p.code.toLowerCase()] = p._id;
      return acc;
    }, {} as Record<string, mongoose.Types.ObjectId>);

    // PARTNER COMPANY BRANCH
    if (type === 'company') {
      const Company = (await import('../models/Company.model')).default;
      for (const row of data) {
        const name = row['Company Name'] || row.companyName || row.name;
        const address = row['Company Address'] || row.address;
        const specialisation = row['Area of Specialisation'] || row.specialisation || row.sector;
        const state = row['State'] || row.state || 'Lagos';

        if (!name || !address) {
          results.failed.push({ row, reason: 'Missing required company fields (Name/Address)' });
          continue;
        }

        try {
          const company = new Company({
            name: name.trim(),
            address: address.trim(),
            specialisation: specialisation ? String(specialisation).trim() : 'General',
            state: state.trim(),
            isApproved: true,
            tenant: tenantId,
          });
          await company.save();
          results.success.push({ name: company.name, id: company._id });
        } catch (saveErr: any) {
          results.failed.push({ name, reason: saveErr.message });
        }
      }

      if (results.success.length > 0) {
        await AuditLog.create({
          tenant: tenantId,
          user: req.user!.id,
          action: 'BULK_ONBOARD',
          module: 'PARTNER_MANAGEMENT',
          reason: `Bulk onboarded ${results.success.length} partner organizations`,
          details: `Successfully enrolled ${results.success.length} companies.`,
          ipAddress: req.ip,
        });
      }
      res.json(results);
      return;
    }

    // STAFF / STUDENT BRANCH
    for (const row of data) {
      const firstName = row['Other Names'] || row.otherNames || row.firstName;
      const lastName = row['Surname'] || row.surname || row.lastName;
      const email = (row['Institutional Email'] || row.email)?.toLowerCase().trim();
      const matricNum = row['Matric Number'] || row.matricNumber;

      if (!email || !firstName || !lastName || (type === 'student' && !matricNum)) {
        results.failed.push({ row, reason: 'Missing required profile fields' });
        continue;
      }

      const username = type === 'student' ? matricNum.toLowerCase() : email;
      const existingUser = await User.findOne({ 
        tenant: tenantId,
        $or: [ { email }, { username } ] 
      });
      if (existingUser) {
        results.failed.push({ email, reason: 'User already exists in this institution' });
        continue;
      }

      let programmeId = row.programmeCode ? progMap[row.programmeCode.toLowerCase().trim()] : null;
      if (req.user!.role !== 'admin') {
        programmeId = (req.user!.programme as any);
      }

      const role = type === 'staff' ? (row.role || 'supervisor') : 'student';
      if ((role as string) === 'admin') {
        results.failed.push({ email, reason: 'Bulk creation of Admin role is prohibited' });
        continue;
      }

      const tempPassword = `Acetel@${Math.floor(1000 + Math.random() * 9000)}`;

      try {
        const user = new User({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email,
          username,
          password: tempPassword,
          role,
          phone: row['Phone Number'] || row.phone,
          programme: programmeId || undefined,
          tenant: tenantId,
          isActive: true,
        });

        await user.save();

        if (type === 'student') {
          const student = new Student({
            user: user._id,
            tenant: tenantId,
            matricNumber: matricNum.trim(),
            programme: programmeId,
            academicSession: row.academicSession || '2024/2025',
            level: row.level || 'MSc',
            status: 'pending',
            personalEmail: row['Personal Email'] || row.personalEmail,
            gender: row['Gender'] || row.gender,
            isNigerian: row['Nigerianity'] === 'Non-Nigerian' ? false : true,
            address: row['Address'] || row.address
          });
          await student.save();
        }

        results.success.push({
          name: `${user.firstName} ${user.lastName}`,
          email: user.email,
          username: user.username,
          tempPassword,
          role: user.role
        });

      } catch (saveErr: any) {
        results.failed.push({ email, reason: saveErr.message });
      }
    }

    if (results.success.length > 0) {
      await AuditLog.create({
        tenant: tenantId,
        user: req.user!.id,
        action: 'BULK_ONBOARD',
        module: 'USER_MANAGEMENT',
        reason: `Bulk onboarded ${results.success.length} ${type} accounts`,
        details: `Successfully enrolled ${results.success.length} users.`,
        ipAddress: req.ip,
      });
    }

    res.json(results);
  } catch (err) {
    console.error('Bulk onboard error:', err);
    res.status(500).json({ error: 'Server error during bulk processing' });
  }
}
