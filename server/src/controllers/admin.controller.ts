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
import logger from '../utils/logger';
import { sendEmail, emailTemplates, isEmailConfigured, getPrimaryAppUrl } from '../utils/mail.service';
import { sendWhatsAppMessage, whatsappTemplates, isWhatsAppConfigured } from '../utils/whatsapp.service';
import Notification from '../models/notification.model';
import EmailRecord from '../models/EmailRecord.model';
import { autoAllocateStudent } from '../utils/allocation.service';
import { normalizeStateName } from '../utils/nigeria-states.util';
import { purgeSoftDeletedIdentity } from '../utils/identity.util';
import { hasPermission } from '../middleware/auth.middleware';
import { getDefaultTenantId } from '../utils/tenant.util';
import { PERMISSIONS, PERMISSION_CATALOG, ALL_PERMISSIONS, isValidPermission, getDefaultPermissionsForRole } from '../config/permissions';

const STAFF_ROLES = ['admin', 'prog_coordinator', 'internship_coordinator', 'ict_support', 'supervisor', 'industry_supervisor'];

const ROLE_ALIASES: Record<string, string> = {
  supervisor: 'supervisor',
  'industry supervisor': 'industry_supervisor',
  'industry_supervisor': 'industry_supervisor',
  'prog_coordinator': 'prog_coordinator',
  'programme coordinator': 'prog_coordinator',
  'programme_coordinator': 'prog_coordinator',
  'internship coordinator': 'internship_coordinator',
  'internship_coordinator': 'internship_coordinator',
  'ict_support': 'ict_support',
  'ict support': 'ict_support',
  support: 'ict_support',
  admin: 'admin',
  administrator: 'admin',
};

function normalizeRoleValue(raw?: string): string | null {
  if (!raw) return null;
  const key = String(raw).trim().toLowerCase();
  return ROLE_ALIASES[key] || null;
}

function normalizeMatricValue(raw?: string): string {
  return String(raw || '').trim().toUpperCase();
}

const userListQuerySchema = z.object({
  role: z.enum(['admin', 'prog_coordinator', 'internship_coordinator', 'ict_support', 'supervisor', 'industry_supervisor']).optional(),
  programme: z.string().optional(),
  search: z.string().optional(),
  page: z.preprocess((val) => Number(val) || 1, z.number().min(1).default(1)),
  limit: z.preprocess((val) => Number(val) || 50, z.number().min(1).max(100).default(50)),
});

const createUserSchema = z.object({
  firstName: z.string().min(2),
  lastName: z.string().min(2),
  email: z.string().email(),
  role: z.enum(['admin', 'prog_coordinator', 'internship_coordinator', 'ict_support', 'supervisor', 'industry_supervisor']),
  programme: z.string().optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
  password: z.preprocess(
    (val) => (typeof val === 'string' && val.trim() === '' ? undefined : val),
    z.string().min(8).optional()
  ),
});

const releaseEmailSchema = z.object({
  email: z.string().email(),
  reason: z.string().min(3).optional(),
});

const releaseMatricSchema = z.object({
  matricNumber: z.string().min(5),
  reason: z.string().min(3).optional(),
});

const createStudentSchema = z.object({
  firstName: z.preprocess((v) => String(v || '').trim(), z.string().min(1, 'First name is required')),
  lastName: z.preprocess((v) => String(v || '').trim(), z.string().min(1, 'Last name is required')),
  email: z.preprocess((v) => String(v || '').trim().toLowerCase(), z.string().email('Invalid institutional email format')),
  matricNumber: z.preprocess((v) => String(v || '').trim(), z.string().min(3, 'Matric number must be at least 3 characters')),
  programme: z.preprocess((v) => (typeof v === 'string' ? v.trim() : (v ? String(v) : '')), z.string().optional().or(z.literal(''))),
  phone: z.preprocess((v) => (typeof v === 'string' ? v.trim() : ''), z.string().optional()),
  password: z.preprocess(
    (val) => (typeof val === 'string' && val.trim() !== '' ? val.trim() : undefined),
    z.string().min(6).optional()
  ),
  personalEmail: z.preprocess(
    (val) => {
      if (typeof val !== 'string') return undefined;
      const t = val.trim().toLowerCase();
      return t === '' ? undefined : t;
    },
    z.string().email('Invalid personal email format').optional()
  ),
  gender: z.preprocess((v) => {
    if (!v) return 'Male';
    const s = String(v).trim().toLowerCase();
    if (s === 'female') return 'Female';
    if (s === 'other') return 'Other';
    return 'Male';
  }, z.enum(['Male', 'Female', 'Other']).default('Male')),
  isNigerian: z.preprocess((v) => {
    if (typeof v === 'boolean') return v;
    if (typeof v === 'string') return v.toLowerCase() !== 'false' && v.toLowerCase() !== 'non-nigerian';
    return true;
  }, z.boolean().default(true)),
  address: z.preprocess((v) => (typeof v === 'string' ? v.trim() : ''), z.string().optional().default('')),
  stateOfOrigin: z.preprocess((v) => (typeof v === 'string' ? v.trim() : ''), z.string().optional().default('')),
  lga: z.preprocess((v) => (typeof v === 'string' ? v.trim() : ''), z.string().optional().default('')),
  academicSession: z.preprocess((v) => (typeof v === 'string' && v.trim() ? v.trim() : '2024/2025'), z.string().default('2024/2025')),
  level: z.preprocess((v) => (typeof v === 'string' && v.trim() ? v.trim() : 'MSc'), z.string().default('MSc')),
});


const updateUserSchema = z.object({
  firstName: z.string().optional().or(z.literal('')),
  lastName: z.string().optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
  role: z.enum(['admin', 'prog_coordinator', 'internship_coordinator', 'ict_support', 'supervisor', 'industry_supervisor']).optional(),
  programme: z.string().optional().or(z.literal('')),
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
    
    // Visibility is permission-based: STAFF_VIEW (or admin) sees all staff
    // tenant-wide. Users without that permission are locked to their own
    // programme, same fallback as before.
    if (programme) {
      filter.programme = programme;
    } else if (!hasPermission(req.user, PERMISSIONS.STAFF_VIEW)) {
      filter.programme = req.user!.programme;
    }

    if (role) filter.role = role;
    if (search) {
      // Escape special regex characters to prevent ReDoS attacks
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const rx = new RegExp(escaped, 'i');
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
    logger.error('Error: %s', (err as Error).message);
    res.status(500).json({ error: 'Server error' });
  }
}

function formatRoleLabel(role: string): string {
  return role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** POST /api/admin/users  — create a new staff user */
export async function createUser(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { firstName, lastName, email, role, programme, phone, password } = createUserSchema.parse(req.body);
    const tenantId = req.user!.tenant;
    if (!tenantId) {
      res.status(400).json({ error: 'Session expired or missing tenant. Please log out and sign in again.' });
      return;
    }
    const normalizedEmail = email.toLowerCase().trim();

    if (req.user!.role === 'admin') {
      await purgeSoftDeletedIdentity(tenantId, { email: normalizedEmail });
    }

    const existing = await User.findOne({
      tenant: tenantId,
      email: normalizedEmail,
      isDeleted: { $ne: true },
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
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: normalizedEmail,
      username: normalizedEmail,
      password: tempPassword,
      role,
      phone: phone?.trim(),
      programme: targetProgramme || undefined,
      tenant: tenantId,
      isActive: true,
    });

    await user.save();

    const saved = await User.findById(user._id)
      .select('-password')
      .populate('programme', 'code name level');

    await AuditLog.create({
      tenant: tenantId,
      user: req.user!.id,
      action: 'CREATE_USER',
      module: 'USER_MANAGEMENT',
      targetId: user._id,
      details: `Created staff user ${normalizedEmail} (${role})`,
      ipAddress: req.ip,
    });

    const appUrl = process.env.FRONTEND_URL || 'https://acetel-frontend.onrender.com';
    const roleLabel = formatRoleLabel(role);
    const delivery = { email: false, whatsapp: false };
    const deliveryDetails = {
      emailConfigured: isEmailConfigured(),
      whatsappConfigured: isWhatsAppConfigured(),
      phoneProvided: !!phone,
    };

    try {
      delivery.email = await sendEmail(
        normalizedEmail,
        'Welcome to ACETEL IMS — Your Account is Ready',
        emailTemplates.welcomeStaff(
          `${firstName} ${lastName}`,
          normalizedEmail,
          normalizedEmail,
          tempPassword,
          roleLabel,
          appUrl
        )
      );
      if (!delivery.email) {
        logger.warn('Staff welcome email not sent for %s (SMTP missing or send failed)', normalizedEmail);
      }
    } catch (mailErr) {
      logger.warn('Welcome email failed for %s: %s', normalizedEmail, (mailErr as Error).message);
    }
    if (phone) {
      try {
        delivery.whatsapp = await sendWhatsAppMessage(phone, `*ACETEL IMS — Account Created* 🎓

Hello ${firstName},

Your staff account has been created.

*Role:* ${roleLabel}
*Login Email:* ${normalizedEmail}
*Username:* ${normalizedEmail}
*Temporary Password:* ${tempPassword}

Login here: ${appUrl}

_Please change your password after first login._`);
        if (!delivery.whatsapp) {
          logger.warn('Staff welcome WhatsApp not sent for %s', phone);
        }
      } catch (waErr) {
        logger.warn('Welcome WhatsApp failed for %s: %s', phone, (waErr as Error).message);
      }
    }
    await Notification.create({
      user: user._id, tenant: tenantId,
      title: 'Welcome to ACETEL IMS!',
      message: `Your ${roleLabel} account is ready. Login with your email and temporary password.`,
      type: 'success',
    });

    res.status(201).json({
      user: saved,
      tempPassword,
      delivery,
      deliveryDetails,
      message: 'Staff user created successfully',
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    if (err?.code === 11000) {
      const field = Object.keys(err.keyValue || {})[0] || 'email';
      res.status(409).json({
        error: `A user with this ${field} already exists. If it was deleted, release the email from Recycle Bin first.`,
        field,
      });
      return;
    }
    logger.error('Create user error: %s', (err as Error).message);
    res.status(500).json({ error: 'Failed to save user. Please check required fields and try again.' });
  }
}

/** POST /api/admin/users/release-email — permanently remove soft-deleted user so email can be reused */
export async function releaseEmail(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { email, reason } = releaseEmailSchema.parse(req.body);
    const tenantId = req.user!.tenant;
    const normalizedEmail = email.toLowerCase().trim();

    const active = await User.findOne({
      tenant: tenantId,
      email: normalizedEmail,
      isDeleted: { $ne: true },
    });
    if (active) {
      res.status(400).json({ error: 'This email is still assigned to an active user. Deactivate the account first.' });
      return;
    }

    const deletedUsers = await User.find({
      tenant: tenantId,
      email: normalizedEmail,
      isDeleted: true,
    });

    if (deletedUsers.length === 0) {
      res.status(404).json({ error: 'No deleted account found with this email in the recycle bin' });
      return;
    }

    const ids = deletedUsers.map((u) => u._id);
    await User.deleteMany({ _id: { $in: ids } });

    await AuditLog.create({
      tenant: tenantId,
      user: req.user!.id,
      action: 'RELEASE_EMAIL',
      module: 'RECYCLE_BIN',
      reason: reason || 'Email released for reuse',
      details: `Permanently purged ${deletedUsers.length} soft-deleted record(s) for ${normalizedEmail}`,
      ipAddress: req.ip,
    });

    res.json({
      message: `Email ${normalizedEmail} is now free to use for a new account`,
      releasedCount: deletedUsers.length,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    logger.error('Release email error: %s', (err as Error).message);
    res.status(500).json({ error: 'Failed to release email' });
  }
}

/** POST /api/admin/students/release-matric — purge soft-deleted student so matric can be reused */
export async function releaseMatric(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { matricNumber, reason } = releaseMatricSchema.parse(req.body);
    const tenantId = req.user!.tenant;
    if (!tenantId) {
      res.status(400).json({ error: 'Session expired or missing tenant. Please log out and sign in again.' });
      return;
    }
    const normMatric = normalizeMatricValue(matricNumber);

    const activeStudent = await Student.findOne({
      tenant: tenantId,
      matricNumber: normMatric,
      isDeleted: { $ne: true },
    });
    if (activeStudent) {
      res.status(400).json({ error: 'This matric number is still assigned to an active student. Deactivate the account first.' });
      return;
    }

    const activeUser = await User.findOne({
      tenant: tenantId,
      username: normMatric.toLowerCase(),
      isDeleted: { $ne: true },
    });
    if (activeUser) {
      res.status(400).json({ error: 'This matric is still used as a login username by an active user.' });
      return;
    }

    const deletedStudents = await Student.find({
      tenant: tenantId,
      matricNumber: normMatric,
      isDeleted: true,
    });

    if (deletedStudents.length === 0) {
      res.status(404).json({ error: 'No deleted student found with this matric number in the recycle bin' });
      return;
    }

    const userIds = deletedStudents.map((s) => s.user);
    await Student.deleteMany({ _id: { $in: deletedStudents.map((s) => s._id) } });
    await User.deleteMany({ _id: { $in: userIds }, isDeleted: true });
    await User.deleteMany({
      tenant: tenantId,
      username: normMatric.toLowerCase(),
      isDeleted: true,
    });

    await AuditLog.create({
      tenant: tenantId,
      user: req.user!.id,
      action: 'RELEASE_MATRIC',
      module: 'RECYCLE_BIN',
      reason: reason || 'Matric released for reuse',
      details: `Permanently purged ${deletedStudents.length} soft-deleted student record(s) for matric ${normMatric}`,
      ipAddress: req.ip,
    });

    res.json({
      message: `Matric number ${normMatric} is now free to use for a new student`,
      releasedCount: deletedStudents.length,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    logger.error('Release matric error: %s', (err as Error).message);
    res.status(500).json({ error: 'Failed to release matric number' });
  }
}

export async function createStudent(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { 
      firstName, lastName, email, matricNumber, 
      programme, phone, password, 
      personalEmail, gender, isNigerian, address,
      stateOfOrigin, lga,
      academicSession, level 
    } = createStudentSchema.parse(req.body);
    const tenantId = req.user?.tenant || (await getDefaultTenantId().catch(() => undefined));
    if (!tenantId) {
      res.status(400).json({ error: 'Session expired or missing tenant. Please log out and sign in again.' });
      return;
    }

    const normMatric = normalizeMatricValue(matricNumber);
    const normEmail = email.toLowerCase().trim();

    // Purge any soft-deleted records for this email or matric so they don't block fresh enrollment
    await purgeSoftDeletedIdentity(tenantId, { email: normEmail, matric: normMatric });

    // Clean up any orphaned student user records from a previous interrupted enrollment
    const orphanUser = await User.findOne({
      tenant: tenantId,
      role: 'student',
      $or: [{ email: normEmail }, { username: normMatric.toLowerCase() }],
    });
    if (orphanUser) {
      const hasStudent = await Student.findOne({ user: orphanUser._id });
      if (!hasStudent) {
        logger.warn('Cleaning up orphaned student user record from previous interrupted enrollment: %s', orphanUser.email);
        await User.findByIdAndDelete(orphanUser._id).catch(() => {});
      }
    }

    // Programme Resolution:
    // If coordinator is assigned to a specific programme, enforce it.
    // Otherwise (admin, internship coordinator, ICT support), use the programme passed from the form.
    let targetProgrammeStr = programme;
    if (req.user!.role === 'prog_coordinator' && req.user!.programme) {
      targetProgrammeStr = req.user!.programme;
    } else if (!targetProgrammeStr && req.user!.programme) {
      targetProgrammeStr = req.user!.programme;
    }

    if (!targetProgrammeStr) {
      res.status(400).json({ error: 'A programme must be selected' });
      return;
    }

    const tenantProgFilter = tenantId
      ? { $or: [{ tenant: tenantId }, { tenant: { $exists: false } }, { tenant: null }] }
      : {};

    let resolvedProgId: mongoose.Types.ObjectId | null = null;
    if (mongoose.Types.ObjectId.isValid(targetProgrammeStr)) {
      const prog = await Programme.findOne({ _id: targetProgrammeStr, ...tenantProgFilter }) || await Programme.findById(targetProgrammeStr);
      if (prog) resolvedProgId = prog._id as mongoose.Types.ObjectId;
    }
    if (!resolvedProgId) {
      const prog = await Programme.findOne({
        code: new RegExp(`^${targetProgrammeStr.trim()}$`, 'i'),
        ...tenantProgFilter,
      });
      if (prog) resolvedProgId = prog._id as mongoose.Types.ObjectId;
    }
    if (!resolvedProgId) {
      const prog = await Programme.findOne({
        name: new RegExp(targetProgrammeStr.trim(), 'i'),
        ...tenantProgFilter,
      });
      if (prog) resolvedProgId = prog._id as mongoose.Types.ObjectId;
    }
    if (!resolvedProgId) {
      const anyProg = await Programme.findOne({ ...tenantProgFilter, isActive: { $ne: false } });
      if (anyProg) {
        resolvedProgId = anyProg._id as mongoose.Types.ObjectId;
      } else {
        const { seedProgrammes } = await import('../models/database');
        await seedProgrammes(new mongoose.Types.ObjectId(tenantId));
        const seeded = await Programme.findOne({ ...tenantProgFilter });
        if (seeded) resolvedProgId = seeded._id as mongoose.Types.ObjectId;
      }
    }

    if (!resolvedProgId) {
      res.status(400).json({ error: 'Selected programme not found. Please select a valid academic programme.' });
      return;
    }

    const existingUser = await User.findOne({
      tenant: tenantId,
      isDeleted: { $ne: true },
      $or: [{ email: normEmail }, { username: normMatric.toLowerCase() }],
    });
    if (existingUser) {
      const conflict = existingUser.email === normEmail ? 'email' : 'matric number';
      res.status(409).json({ error: `Identity already in use: ${conflict} is taken by an active account.` });
      return;
    }

    const existingMatric = await Student.findOne({
      tenant: tenantId,
      matricNumber: { $regex: new RegExp(`^${normMatric}$`, 'i') },
      isDeleted: { $ne: true },
    });
    if (existingMatric) {
      res.status(409).json({ error: 'Matric number already registered to an active student' });
      return;
    }

    const tempPassword = password || `Student@${Math.floor(1000 + Math.random() * 9000)}`;

    const user = new User({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: normEmail,
      username: normMatric.toLowerCase(),
      password: tempPassword,
      role: 'student',
      phone: phone?.trim() || undefined,
      programme: resolvedProgId,
      tenant: tenantId,
      isActive: true,
    });

    await user.save();

    const normalizedState = normalizeStateName(stateOfOrigin) || undefined;
    const student = new Student({
      user: user._id,
      tenant: tenantId,
      matricNumber: normMatric,
      programme: resolvedProgId,
      academicSession: academicSession || '2024/2025',
      level: level || 'MSc',
      status: 'pending',
      personalEmail: personalEmail?.trim().toLowerCase() || undefined,
      gender: gender || 'Male',
      isNigerian: isNigerian ?? true,
      address: address?.trim() || undefined,
      stateOfOrigin: normalizedState,
      lga: lga?.trim() || undefined,
    });

    try {
      await student.save();
    } catch (saveStudentErr: any) {
      logger.error('Failed to save student document, rolling back created user %s: %s', user._id, saveStudentErr.message);
      await User.findByIdAndDelete(user._id).catch(() => {});
      throw saveStudentErr;
    }

    await AuditLog.create({
      tenant: tenantId,
      user: req.user!.id,
      action: 'CREATE_STUDENT',
      module: 'STUDENT_MANAGEMENT',
      targetId: student._id,
      details: `Onboarded student ${email} for programme ${resolvedProgId}`,
      ipAddress: req.ip
    });

    // Resolve programme name for notification
    const prog = await Programme.findById(resolvedProgId).select('name code');
    const progName = prog?.name || 'your programme';

    // Welcome notifications — institutional email + personal email + WhatsApp
    const appUrl = getPrimaryAppUrl();
    const welcomeHtml = emailTemplates.welcomeStudent(`${firstName} ${lastName}`, email, tempPassword, appUrl, 'Pending Placement');
    const delivery = { email: false, personalEmail: false, whatsapp: false };
    const deliveryDetails = {
      emailConfigured: isEmailConfigured(),
      whatsappConfigured: isWhatsAppConfigured(),
      phoneProvided: !!phone,
      institutionalEmail: email.toLowerCase(),
      personalEmail: personalEmail || null,
    };
    try {
      delivery.email = await sendEmail(email.toLowerCase(), 'Welcome to ACETEL IMS — Your Account is Ready', welcomeHtml);
      if (!delivery.email) logger.warn('Student welcome email (inst.) failed for %s', email);
    } catch (e) { logger.warn('Student welcome email (inst.) failed: %s', (e as Error).message); }
    if (personalEmail) {
      try {
        delivery.personalEmail = await sendEmail(personalEmail, 'Welcome to ACETEL IMS — Your Account is Ready', welcomeHtml);
        if (!delivery.personalEmail) logger.warn('Student welcome email (personal) failed for %s', personalEmail);
      } catch (e) { logger.warn('Student welcome email (personal) failed: %s', (e as Error).message); }
    }
    if (phone) {
      try {
        delivery.whatsapp = await sendWhatsAppMessage(phone,
          `*ACETEL IMS — Enrollment Successful* 🎓

Hello ${firstName},

You have been enrolled on the ACETEL Virtual Internship Management System.

*Matric Number:* ${normMatric}
*Programme:* ${progName}
*Login Email:* ${email}
*Temporary Password:* ${tempPassword}

Access the portal here:
${appUrl}

_Please change your password after first login._`
        );
        if (!delivery.whatsapp) logger.warn('Student welcome WhatsApp failed for %s', phone);
      } catch (e) { logger.warn('Student welcome WhatsApp failed: %s', (e as Error).message); }
    }
    await Notification.create({
      user: user._id, tenant: tenantId,
      title: 'Welcome to ACETEL IMS!',
      message: `Your student account is ready. Matric: ${normMatric}. Login with your institutional email and temporary password.`,
      type: 'success',
    });

    // Auto-post (state-based) immediately after enrollment
    let posting: any = null;
    try {
      posting = await autoAllocateStudent((student._id as any).toString());
    } catch (e) {
      logger.warn('Auto-post failed: %s', (e as Error).message);
    }

    res.status(201).json({
      message: 'Student onboarded successfully',
      student,
      user: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        username: user.username,
        role: user.role,
        programme: resolvedProgId,
      },
      delivery,
      deliveryDetails,
      posting,
      tempPassword
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      const issueDetails = err.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      res.status(400).json({ error: `Validation failed: ${issueDetails}`, details: err.errors });
      return;
    }
    if (err?.code === 11000) {
      const field = Object.keys(err.keyValue || {})[0] || 'identity';
      res.status(409).json({
        error: `A user or student with this ${field} already exists. If it was deleted, release the email or matric from Recycle Bin first.`,
        field,
      });
      return;
    }
    logger.error('Create student error: %s', (err as Error).message);
    res.status(500).json({ error: err.message || 'Failed to onboard student. Please check required fields and try again.' });
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
    if (role && role !== user.role) {
      user.role = role as any;
      // Role changed — reset to that role's default permission grant. An
      // admin can fine-tune afterwards via PUT /users/:id/permissions.
      user.permissions = getDefaultPermissionsForRole(role);
    }
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
    logger.error('Error: %s', (err as Error).message);
    res.status(500).json({ error: 'Server error' });
  }
}

/** GET /api/admin/permissions/catalog — the full list of grantable permissions, grouped for UI rendering */
export async function getPermissionCatalog(_req: AuthRequest, res: Response): Promise<void> {
  res.json({ catalog: PERMISSION_CATALOG, all: ALL_PERMISSIONS });
}

/** GET /api/admin/users/:id/permissions */
export async function getUserPermissions(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = idParamSchema.parse(req.params);
    const tenantId = req.user!.tenant;

    const user = await User.findOne({ _id: id, tenant: tenantId }).select('role permissions email firstName lastName');
    if (!user) {
      res.status(404).json({ error: 'User not found in your institution' });
      return;
    }

    res.json({
      userId: user._id,
      role: user.role,
      // admin implicitly has everything; report the full catalog so the UI shows it as fully granted
      permissions: user.role === 'admin' ? ALL_PERMISSIONS : (user.permissions || []),
      isAdmin: user.role === 'admin',
      defaultsForRole: getDefaultPermissionsForRole(user.role),
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    logger.error('getUserPermissions error: %s', (err as Error).message);
    res.status(500).json({ error: 'Server error' });
  }
}

const updatePermissionsSchema = z.object({
  permissions: z.array(z.string()).max(ALL_PERMISSIONS.length),
  reason: z.string().min(3).optional(),
});

/**
 * PUT /api/admin/users/:id/permissions — admin-only. Fully replaces the
 * target user's permission grant with the given list (add AND remove in one
 * call: send the complete desired set). This is the mechanism referenced
 * throughout the app for "who can add/view/manage students, companies,
 * staff, attendance, logbook, etc."
 */
export async function updateUserPermissions(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = idParamSchema.parse(req.params);
    const { permissions, reason } = updatePermissionsSchema.parse(req.body);
    const tenantId = req.user!.tenant;

    const invalid = permissions.filter((p) => !isValidPermission(p));
    if (invalid.length > 0) {
      res.status(400).json({ error: `Unknown permission(s): ${invalid.join(', ')}` });
      return;
    }

    const user = await User.findOne({ _id: id, tenant: tenantId });
    if (!user) {
      res.status(404).json({ error: 'User not found in your institution' });
      return;
    }

    if (user.role === 'admin') {
      res.status(400).json({ error: 'Administrators implicitly hold every permission and cannot be edited.' });
      return;
    }

    const before = user.permissions || [];
    user.permissions = [...new Set(permissions)];
    await user.save();

    await AuditLog.create({
      tenant: tenantId,
      user: req.user!.id,
      action: 'UPDATE_USER_PERMISSIONS',
      module: 'ACCESS_CONTROL',
      targetId: id,
      reason,
      details: `Updated permissions for ${user.email}: [${before.join(', ')}] → [${user.permissions.join(', ')}]`,
      ipAddress: req.ip,
    });

    res.json({ userId: user._id, permissions: user.permissions, message: 'Permissions updated successfully' });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    logger.error('updateUserPermissions error: %s', (err as Error).message);
    res.status(500).json({ error: 'Server error' });
  }
}

const sendEnrollmentEmailsSchema = z.object({
  studentIds: z.array(z.string().regex(/^[0-9a-fA-F]{24}$/)).optional(), // omit = all visible students
  programme: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  resetPassword: z.boolean().optional(),
});

/**
 * POST /api/admin/students/send-enrollment-emails
 * Bulk-sends (or resends) the enrollment confirmation email to every
 * enrolled student the caller is permitted to see (respects the same
 * STUDENTS_VIEW_ALL / programme-scope rule as the student list), or to a
 * specific subset via `studentIds`. Uses each student's stored institutional
 * email address. Records the run in EmailRecord for an audit trail and
 * returns a per-student delivery breakdown so failures are never silent.
 */
export async function sendEnrollmentEmails(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { studentIds, programme, resetPassword } = sendEnrollmentEmailsSchema.parse(req.body);
    const tenantId = req.user?.tenant || (await getDefaultTenantId().catch(() => undefined));

    const query: any = { isDeleted: { $ne: true } };
    if (tenantId) query.tenant = tenantId;
    if (studentIds?.length) {
      query._id = { $in: studentIds };
    } else if (!hasPermission(req.user, PERMISSIONS.STUDENTS_VIEW_ALL)) {
      if (req.user!.programme) {
        query.programme = req.user!.programme;
      } else {
        res.status(403).json({ error: 'You do not have permission to view students outside your programme' });
        return;
      }
    }
    if (programme) query.programme = programme;

    const students = await Student.find(query)
      .populate('user', 'firstName lastName email phone isActive')
      .populate('programme', 'name')
      .populate('company', 'name');

    if (students.length === 0) {
      res.status(400).json({ error: 'No matching enrolled students found' });
      return;
    }

    if (!isEmailConfigured()) {
      res.status(400).json({
        error: 'Email is not configured on this server. Check SMTP settings under Settings → Integrations before sending enrollment emails.',
      });
      return;
    }

    const appUrl = getPrimaryAppUrl();
    const sender = await User.findById(req.user!.id).select('firstName lastName email');

    const emailSubject = resetPassword
      ? 'Welcome to ACETEL VIMS — Your Account is Ready'
      : 'You Are Enrolled — ACETEL VIMS';

    const record = await EmailRecord.create({
      tenant: tenantId,
      sender: req.user!.id,
      subject: emailSubject,
      body: resetPassword ? 'Enrollment credentials & welcome email' : 'Enrollment confirmation notification email',
      recipientScope: programme ? 'programme' : 'all_students',
      programme: programme || undefined,
      recipients: students
        .filter((s: any) => s.user?.email)
        .map((s: any) => ({ userId: s.user._id, email: s.user.email, name: `${s.user.firstName} ${s.user.lastName}` })),
      sentCount: 0,
      failedCount: 0,
      status: 'sending',
    });

    const results: { studentId: string; email: string | null; sent: boolean; error?: string }[] = [];
    let sent = 0;
    let failed = 0;

    for (const s of students as any[]) {
      const u = s.user;
      if (!u?.email) {
        results.push({ studentId: s._id.toString(), email: null, sent: false, error: 'No email on file' });
        failed++;
        continue;
      }

      let html: string;
      let tempPassword = '';

      if (resetPassword) {
        tempPassword = `Student@${Math.floor(1000 + Math.random() * 9000)}`;
        const hash = await bcrypt.hash(tempPassword, 10);
        await User.findByIdAndUpdate(u._id, { password: hash, mustChangePassword: true });
        html = emailTemplates.welcomeStudent(
          `${u.firstName} ${u.lastName}`,
          u.email,
          tempPassword,
          appUrl,
          s.company?.name || 'Pending Placement'
        );
      } else {
        html = emailTemplates.enrollmentNotice(
          `${u.firstName} ${u.lastName}`,
          s.matricNumber,
          s.programme?.name || 'N/A',
          s.status,
          s.company?.name || null,
          appUrl
        );
      }

      const ok = await sendEmail(u.email, emailSubject, html);
      results.push({ studentId: s._id.toString(), email: u.email, sent: ok, error: ok ? undefined : 'Send failed — see server logs' });
      if (ok) sent++; else failed++;

      if (u.phone) {
        try {
          const waMsg = resetPassword
            ? `*ACETEL IMS — Enrollment Details* 🎓\n\nHello ${u.firstName},\n\nYour student account login credentials:\n*Login:* ${u.email}\n*Temporary Password:* ${tempPassword}\n\nPortal: ${appUrl}\n\n_Please change your password after logging in._`
            : `*ACETEL IMS — Enrollment Confirmed* 🎓\n\nHello ${u.firstName},\n\nYour enrollment on ACETEL IMS has been confirmed. Matric: ${s.matricNumber}.\n\nPortal: ${appUrl}`;
          await sendWhatsAppMessage(u.phone, waMsg);
        } catch (waErr: any) {
          logger.warn('Student WhatsApp failed for %s: %s', u.phone, waErr.message);
        }
      }
    }

    await EmailRecord.findByIdAndUpdate(record._id, {
      sentCount: sent,
      failedCount: failed,
      status: failed === 0 ? 'sent' : sent === 0 ? 'failed' : 'partial',
    });

    await AuditLog.create({
      tenant: tenantId,
      user: req.user!.id,
      action: 'BULK_SEND_ENROLLMENT_EMAIL',
      module: 'COMMUNICATIONS',
      details: `Sent enrollment email to ${sent}/${students.length} students (${failed} failed) by ${sender?.email || req.user!.id}`,
      ipAddress: req.ip,
    });

    res.json({
      message: `Enrollment email sent to ${sent} of ${students.length} student(s)${failed > 0 ? ` — ${failed} failed` : ''}.`,
      emailRecordId: record._id,
      total: students.length,
      sent,
      failed,
      results,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    logger.error('sendEnrollmentEmails error: %s', (err as Error).message);
    res.status(500).json({ error: 'Server error' });
  }
}

const sendStaffEnrollmentEmailsSchema = z.object({
  userIds: z.array(z.string().regex(/^[0-9a-fA-F]{24}$/)).optional(), // omit = all visible staff
  role: z.string().optional(),
  resetPassword: z.boolean().optional(),
});

/**
 * POST /api/admin/staff/send-enrollment-emails
 * Resends welcome / enrollment emails to staff members (individual or bulk).
 * Allows administrators to optionally regenerate a temporary password or
 * send account login reminders.
 */
export async function sendStaffEnrollmentEmails(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { userIds, role, resetPassword } = sendStaffEnrollmentEmailsSchema.parse(req.body);
    const tenantId = req.user?.tenant || (await getDefaultTenantId().catch(() => undefined));

    const staffRoles = ['admin', 'prog_coordinator', 'internship_coordinator', 'ict_support', 'supervisor', 'industry_supervisor'];
    const query: any = {
      role: role ? role : { $in: staffRoles },
      isDeleted: { $ne: true },
    };
    if (tenantId) query.tenant = tenantId;
    if (userIds?.length) {
      query._id = { $in: userIds };
    }

    const staffList = await User.find(query).populate('programme', 'name code');

    if (staffList.length === 0) {
      res.status(400).json({ error: 'No matching staff accounts found' });
      return;
    }

    if (!isEmailConfigured()) {
      res.status(400).json({
        error: 'Email is not configured on this server. Check SMTP settings under Settings → Integrations before sending enrollment emails.',
      });
      return;
    }

    const appUrl = getPrimaryAppUrl();
    const sender = await User.findById(req.user!.id).select('firstName lastName email');

    const emailSubject = resetPassword
      ? 'Welcome to ACETEL IMS — Your Account is Ready'
      : 'Your ACETEL VIMS Account Notice';

    const record = await EmailRecord.create({
      tenant: tenantId,
      sender: req.user!.id,
      subject: emailSubject,
      body: resetPassword ? 'Staff welcome/enrollment credentials email' : 'Staff enrollment notification email',
      recipientScope: role ? 'role' : 'all_staff',
      recipients: staffList
        .filter((u: any) => u.email)
        .map((u: any) => ({ userId: u._id, email: u.email, name: `${u.firstName} ${u.lastName}` })),
      sentCount: 0,
      failedCount: 0,
      status: 'sending',
    });

    const results: { userId: string; email: string | null; sent: boolean; error?: string }[] = [];
    let sent = 0;
    let failed = 0;

    for (const u of staffList as any[]) {
      if (!u.email) {
        results.push({ userId: u._id.toString(), email: null, sent: false, error: 'No email on file' });
        failed++;
        continue;
      }

      let html: string;
      let tempPassword = '';

      if (resetPassword) {
        tempPassword = `Staff@${Math.floor(1000 + Math.random() * 9000)}`;
        const hash = await bcrypt.hash(tempPassword, 10);
        u.password = hash;
        u.mustChangePassword = true;
        await u.save();

        html = emailTemplates.welcomeStaff(
          `${u.firstName} ${u.lastName}`,
          u.email,
          u.email,
          tempPassword,
          formatRoleLabel(u.role),
          appUrl
        );
      } else {
        html = emailTemplates.staffEnrollmentNotice(
          `${u.firstName} ${u.lastName}`,
          u.email,
          u.role,
          appUrl
        );
      }

      const ok = await sendEmail(u.email, emailSubject, html);
      results.push({ userId: u._id.toString(), email: u.email, sent: ok, error: ok ? undefined : 'Send failed — see server logs' });
      if (ok) sent++; else failed++;

      if (u.phone) {
        try {
          const waMsg = resetPassword
            ? `*ACETEL IMS — Account Credentials* 🎓\n\nHello ${u.firstName},\n\nYour ${formatRoleLabel(u.role)} login credentials have been updated:\n\n*Login:* ${u.email}\n*Temporary Password:* ${tempPassword}\n\nAccess portal: ${appUrl}\n\n_Please change your password upon logging in._`
            : `*ACETEL IMS — Account Active* 🎓\n\nHello ${u.firstName},\n\nYour ${formatRoleLabel(u.role)} account is active on ACETEL IMS.\n\nPortal: ${appUrl}`;
          await sendWhatsAppMessage(u.phone, waMsg);
        } catch (waErr: any) {
          logger.warn('WhatsApp to staff %s failed: %s', u.phone, waErr.message);
        }
      }
    }

    await EmailRecord.findByIdAndUpdate(record._id, {
      sentCount: sent,
      failedCount: failed,
      status: failed === 0 ? 'sent' : sent === 0 ? 'failed' : 'partial',
    });

    await AuditLog.create({
      tenant: tenantId,
      user: req.user!.id,
      action: 'BULK_SEND_ENROLLMENT_EMAIL',
      module: 'COMMUNICATIONS',
      details: `Sent enrollment/welcome email to ${sent}/${staffList.length} staff (${failed} failed) by ${sender?.email || req.user!.id}`,
      ipAddress: req.ip,
    });

    res.json({
      message: `Staff enrollment email sent to ${sent} of ${staffList.length} staff member(s)${failed > 0 ? ` — ${failed} failed` : ''}.`,
      emailRecordId: record._id,
      total: staffList.length,
      sent,
      failed,
      results,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    logger.error('sendStaffEnrollmentEmails error: %s', (err as Error).message);
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
    logger.error('Error: %s', (err as Error).message);
    res.status(500).json({ error: 'Server error' });
  }
}

/** GET /api/admin/recycle-bin */
export async function listRecycleBin(req: AuthRequest, res: Response): Promise<void> {
  try {
    const tenantId = req.user?.tenant || (await getDefaultTenantId().catch(() => undefined));
    const userFilter: any = { isDeleted: true };
    const studentFilter: any = { isDeleted: true };
    const companyFilter: any = { isDeleted: true };
    if (tenantId) {
      userFilter.tenant = tenantId;
      studentFilter.tenant = tenantId;
      companyFilter.tenant = tenantId;
    }
    
    if (req.user?.role !== 'admin' && req.user?.programme) {
      userFilter.programme = req.user.programme;
      studentFilter.programme = req.user.programme;
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
    logger.error('Error in listRecycleBin: %s', (err as Error).message);
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
    logger.error('Error: %s', (err as Error).message);
    res.status(500).json({ error: 'Server error' });
  }
}

/** GET /api/admin/programmes  — active programmes for current tenant */
export async function listProgrammes(req: AuthRequest, res: Response): Promise<void> {
  try {
    const tenantId = req.user!.tenant;
    let programmes = await Programme.find({ tenant: tenantId, isActive: { $ne: false } }).sort({ name: 1 });
    if (programmes.length === 0) {
      const { seedProgrammes } = await import('../models/database');
      await seedProgrammes(new mongoose.Types.ObjectId(tenantId));
      programmes = await Programme.find({ tenant: tenantId, isActive: { $ne: false } }).sort({ name: 1 });
    }
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
    logger.error('Error: %s', (err as Error).message);
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
    logger.error('Error: %s', (err as Error).message);
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
    logger.error('Error: %s', (err as Error).message);
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
    logger.error('Error: %s', (err as Error).message);
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
    logger.error('Error: %s', (err as Error).message);
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
    logger.error('Error: %s', (err as Error).message);
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
    logger.error('Error: %s', (err as Error).message);
    res.status(500).json({ error: 'Server error' });
  }
}

/** 
 * POST /api/admin/bulk-onboard
 */
function extractRowLookup(row: Record<string, any>): Record<string, string> {
  const lookup: Record<string, string> = {};
  for (const [k, v] of Object.entries(row || {})) {
    const cleanKey = k.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (cleanKey && v !== undefined && v !== null) {
      lookup[cleanKey] = String(v).trim();
    }
  }
  return lookup;
}

function normalizeGenderValue(raw?: string): 'Male' | 'Female' | 'Other' {
  if (!raw) return 'Male';
  const s = String(raw).trim().toLowerCase();
  if (s === 'female' || s === 'f') return 'Female';
  if (s === 'other' || s === 'o') return 'Other';
  return 'Male';
}

function normalizeNationality(raw?: any): boolean {
  if (raw === undefined || raw === null || raw === '') return true;
  if (typeof raw === 'boolean') return raw;
  const s = String(raw).trim().toLowerCase();
  if (s === 'false' || s === 'non-nigerian' || s === 'foreign' || s === 'international' || s === 'no') return false;
  return true;
}

/** 
 * POST /api/admin/bulk-onboard
 */
export async function bulkOnboard(req: AuthRequest, res: Response): Promise<void> {
  const { type, data } = req.body;
  const tenantId = req.user?.tenant || (await getDefaultTenantId().catch(() => undefined));
  if (!tenantId) {
    res.status(400).json({ error: 'Session expired or missing tenant. Please log out and sign in again.' });
    return;
  }
  const entityType = String(type || '').trim().toLowerCase();

  if (!['company', 'staff', 'student'].includes(entityType)) {
    res.status(400).json({ error: 'Bulk onboard type must be company, staff, or student' });
    return;
  }

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
    const tenantProgFilter = { $or: [{ tenant: tenantId }, { tenant: { $exists: false } }, { tenant: null }] };

    // Cache programmes for faster mapping for current tenant
    let allProgs: any[] = await Programme.find({
      ...tenantProgFilter,
      isActive: { $ne: false },
    }).select('code name level _id');

    if (allProgs.length === 0 && tenantId) {
      const { seedProgrammes } = await import('../models/database');
      await seedProgrammes(new mongoose.Types.ObjectId(tenantId));
      allProgs = await Programme.find({
        ...tenantProgFilter,
        isActive: { $ne: false },
      }).select('code name level _id');
    }

    const resolveProg = (programmeCodeValue: string, levelValue?: string): mongoose.Types.ObjectId | null => {
      if (!programmeCodeValue) return null;
      const raw = programmeCodeValue.trim();
      if (mongoose.Types.ObjectId.isValid(raw)) {
        const found = allProgs.find((p) => p._id.toString() === raw);
        if (found) return found._id as mongoose.Types.ObjectId;
      }
      const clean = raw.toLowerCase().replace(/[^a-z0-9]/g, '');
      const isPhd = clean.includes('phd') || String(levelValue || '').toLowerCase().includes('phd');

      // 1. Direct code or name match
      for (const p of allProgs) {
        const pCodeClean = p.code.toLowerCase().replace(/[^a-z0-9]/g, '');
        const pNameClean = p.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (clean === pCodeClean || clean === pNameClean) {
          return p._id as mongoose.Types.ObjectId;
        }
      }

      // 2. Keyword heuristic with degree level
      if (clean.includes('ai') || clean.includes('artificial') || clean.includes('intelligence')) {
        const targetCode = isPhd ? 'PHD-AI' : 'MSC-AI';
        const found = allProgs.find((p) => p.code.toUpperCase() === targetCode);
        if (found) return found._id as mongoose.Types.ObjectId;
      }
      if (clean.includes('cyb') || clean.includes('cyber') || clean.includes('security')) {
        const targetCode = isPhd ? 'PHD-CYB' : 'MSC-CYB';
        const found = allProgs.find((p) => p.code.toUpperCase() === targetCode);
        if (found) return found._id as mongoose.Types.ObjectId;
      }
      if (clean.includes('mis') || clean.includes('management') || clean.includes('information')) {
        const targetCode = isPhd ? 'PHD-MIS' : 'MSC-MIS';
        const found = allProgs.find((p) => p.code.toUpperCase() === targetCode);
        if (found) return found._id as mongoose.Types.ObjectId;
      }

      // 3. Partial substring match in name
      for (const p of allProgs) {
        const pNameLower = p.name.toLowerCase();
        const rawLower = raw.toLowerCase();
        if (pNameLower.includes(rawLower) || rawLower.includes(pNameLower)) {
          return p._id as mongoose.Types.ObjectId;
        }
      }
      return null;
    };

    // PARTNER COMPANY BRANCH
    if (entityType === 'company') {
      const Company = (await import('../models/Company.model')).default;
      for (const row of data) {
        const lookup = extractRowLookup(row);
        const name = lookup['companyname'] || lookup['name'] || lookup['organisation'] || lookup['organization'] || row['Company Name'] || row.name || '';
        const address = lookup['companyaddress'] || lookup['address'] || lookup['location'] || row['Company Address'] || row.address || '';
        const specialisation = lookup['areaofspecialisation'] || lookup['specialisation'] || lookup['specialization'] || lookup['sector'] || row['Area of Specialisation'] || 'General IT';
        const state = normalizeStateName(lookup['state'] || lookup['companystate'] || row['State'] || '') || 'FCT';

        if (!name || !address) {
          results.failed.push({ row, reason: 'Missing required company fields (Name/Address)' });
          continue;
        }

        try {
          const company = new Company({
            name: name.trim(),
            address: address.trim(),
            specialisation: specialisation ? String(specialisation).trim() : 'General IT',
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
      const lookup = extractRowLookup(row);

      let firstName = lookup['firstname'] || lookup['othernames'] || lookup['othername'] || lookup['fname'] || lookup['first'] || '';
      let lastName = lookup['lastname'] || lookup['surname'] || lookup['lname'] || lookup['last'] || '';
      const rawFullName = lookup['fullname'] || lookup['name'] || lookup['studentname'] || lookup['candidatename'] || '';

      if (!firstName || !lastName) {
        if (rawFullName) {
          const parts = rawFullName.split(/\s+/).filter(Boolean);
          if (!lastName && parts.length > 0) {
            lastName = parts[0];
            if (!firstName && parts.length > 1) {
              firstName = parts.slice(1).join(' ');
            }
          } else if (!firstName && parts.length > 0) {
            firstName = parts.join(' ');
          }
        }
      }

      let email = (lookup['institutionalemail'] || lookup['email'] || lookup['emailaddress'] || lookup['studentemail'] || lookup['officialemail'] || lookup['mail'] || '').toLowerCase();
      const personalEmail = (lookup['personalemail'] || lookup['altemail'] || lookup['alternateemail'] || lookup['secondaryemail'] || lookup['privateemail'] || '').toLowerCase() || undefined;

      const matricNum = normalizeMatricValue(lookup['matricnumber'] || lookup['matricno'] || lookup['matric'] || lookup['matriculationnumber'] || lookup['regno'] || lookup['registrationnumber'] || lookup['username'] || '');

      // Fallback: If institutional email is missing, use personalEmail or generate standard student alias from matric
      if (!email && personalEmail) {
        email = personalEmail;
      } else if (!email && entityType === 'student' && matricNum) {
        email = `${matricNum.toLowerCase().replace(/[^a-z0-9]/g, '')}@student.noun.edu.ng`;
      }

      const phone = lookup['phonenumber'] || lookup['phone'] || lookup['phoneno'] || lookup['mobile'] || lookup['mobilenumber'] || lookup['whatsapp'] || lookup['telephone'] || lookup['contactphone'] || undefined;

      const gender = normalizeGenderValue(lookup['gender'] || lookup['sex']);
      const isNigerian = normalizeNationality(lookup['nigerianity'] || lookup['nigerianstatus'] || lookup['nationality'] || lookup['country']);

      const address = lookup['address'] || lookup['residentialaddress'] || lookup['homeaddress'] || lookup['location'] || lookup['contactaddress'] || undefined;
      const stateOfOrigin = normalizeStateName(lookup['stateoforigin'] || lookup['state'] || lookup['origin'] || lookup['statecode'] || '') || undefined;
      const lga = lookup['lga'] || lookup['localgovernment'] || lookup['lgaoforigin'] || undefined;

      const programmeCodeValue = lookup['programmecode'] || lookup['programme'] || lookup['program'] || lookup['programcode'] || lookup['course'] || lookup['courseofstudy'] || lookup['department'] || lookup['specialization'] || lookup['option'] || lookup['field'] || '';
      const academicSession = lookup['academicsession'] || lookup['session'] || lookup['academicyear'] || lookup['year'] || '2024/2025';
      const level = lookup['level'] || lookup['studylevel'] || lookup['degree'] || 'MSc';

      if (!email || !firstName || !lastName || (entityType === 'student' && !matricNum)) {
        const missing = [
          !firstName && 'First Name',
          !lastName && 'Surname/Last Name',
          !email && 'Email',
          (entityType === 'student' && !matricNum) && 'Matric Number',
        ].filter(Boolean).join(', ');
        results.failed.push({ row, reason: `Missing required profile fields: ${missing}` });
        continue;
      }

      // Purge any soft-deleted records for this identity so it doesn't block re-enrollment
      await purgeSoftDeletedIdentity(tenantId, {
        email,
        matric: entityType === 'student' ? matricNum : undefined,
      }).catch(() => {});

      // Clean up orphaned student users from previous interrupted enrollment
      if (entityType === 'student') {
        const orphanUser = await User.findOne({
          tenant: tenantId,
          role: 'student',
          $or: [{ email }, { username: matricNum.toLowerCase() }],
        });
        if (orphanUser) {
          const hasStudent = await Student.findOne({ user: orphanUser._id });
          if (!hasStudent) {
            await User.findByIdAndDelete(orphanUser._id).catch(() => {});
          }
        }
      }

      const username = entityType === 'student' ? matricNum.toLowerCase() : email;
      const existingUser = await User.findOne({
        tenant: tenantId,
        isDeleted: { $ne: true },
        $or: [{ email }, { username }]
      });
      if (existingUser) {
        results.failed.push({
          email,
          reason: `Account already exists (${existingUser.email === email ? 'email' : 'matric/username'} is in use)`,
        });
        continue;
      }

      let programmeId = resolveProg(programmeCodeValue, level);
      if (!programmeId && mongoose.Types.ObjectId.isValid(programmeCodeValue)) {
        programmeId = new mongoose.Types.ObjectId(programmeCodeValue);
      }
      if (!programmeId && req.user!.programme) {
        programmeId = req.user!.programme as any;
      }
      if (!programmeId && entityType === 'student' && allProgs.length > 0) {
        programmeId = allProgs[0]._id as mongoose.Types.ObjectId;
      }

      const rawRoleValue = lookup['role'] || row['Role'] || row.role || 'supervisor';
      const normalizedRole = entityType === 'staff' ? normalizeRoleValue(rawRoleValue) || 'supervisor' : 'student';
      if (!normalizedRole) {
        results.failed.push({ email, reason: `Invalid staff role: ${rawRoleValue}` });
        continue;
      }
      if (normalizedRole === 'admin') {
        results.failed.push({ email, reason: 'Bulk creation of Admin role is prohibited' });
        continue;
      }

      if (entityType === 'student' && !programmeId) {
        results.failed.push({ email, reason: 'Programme code is required and could not be resolved' });
        continue;
      }

      const role = normalizedRole;
      if (entityType === 'staff' && ['prog_coordinator', 'ict_support'].includes(role) && !programmeId) {
        results.failed.push({ email, reason: `Programme is required for role ${role}` });
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
          phone,
          programme: programmeId || undefined,
          tenant: tenantId,
          isActive: true,
        });

        await user.save();

        if (entityType === 'student') {
          const student = new Student({
            user: user._id,
            tenant: tenantId,
            matricNumber: matricNum,
            programme: programmeId,
            academicSession,
            level,
            status: 'pending',
            personalEmail,
            gender,
            isNigerian,
            address,
            stateOfOrigin,
            lga,
          });
          await student.save();

          // Auto-allocate student to closest verified partner organisation
          try {
            await autoAllocateStudent((student._id as any).toString());
          } catch (allocErr) {
            logger.warn('Bulk onboard auto-allocation skipped for %s: %s', matricNum, (allocErr as Error).message);
          }
        }

        // Welcome notifications — same behaviour as single-record add
        const appUrl = getPrimaryAppUrl();
        const delivery = { email: false, personalEmail: false, whatsapp: false };
        try {
          const html = entityType === 'student'
            ? emailTemplates.welcomeStudent(`${firstName} ${lastName}`, email, tempPassword, appUrl, 'Pending Placement')
            : emailTemplates.welcomeStaff(`${firstName} ${lastName}`, email, username, tempPassword, formatRoleLabel(role), appUrl);
          delivery.email = await sendEmail(email, 'Welcome to ACETEL IMS — Your Account is Ready', html);
          if (entityType === 'student' && personalEmail) {
            delivery.personalEmail = await sendEmail(personalEmail, 'Welcome to ACETEL IMS — Your Account is Ready', html);
          }
        } catch (mailErr) {
          logger.warn('Bulk onboard welcome email failed for %s: %s', email, (mailErr as Error).message);
        }
        if (phone) {
          try {
            delivery.whatsapp = await sendWhatsAppMessage(phone,
              `*ACETEL IMS — Enrollment Successful* 🎓\n\nHello ${firstName},\n\nYour ${entityType === 'student' ? 'student' : formatRoleLabel(role)} account has been created via bulk enrollment.\n\n*Login:* ${username}\n*Temporary Password:* ${tempPassword}\n\nAccess the portal here:\n${appUrl}\n\n_Please change your password after first login._`
            );
          } catch (waErr) {
            logger.warn('Bulk onboard WhatsApp failed for %s: %s', phone, (waErr as Error).message);
          }
        }

        results.success.push({
          name: `${user.firstName} ${user.lastName}`,
          email: user.email,
          username: user.username,
          tempPassword,
          role: user.role,
          delivery,
        });

      } catch (saveErr: any) {
        results.failed.push({ email, reason: saveErr.message });
      }
    }

    if (results.success.length > 0) {
      const emailedCount = results.success.filter((s) => s.delivery?.email).length;
      await AuditLog.create({
        tenant: tenantId,
        user: req.user!.id,
        action: 'BULK_ONBOARD',
        module: 'USER_MANAGEMENT',
        reason: `Bulk onboarded ${results.success.length} ${entityType} accounts`,
        details: `Successfully enrolled ${results.success.length} users. Welcome email delivered to ${emailedCount}/${results.success.length}.${!isEmailConfigured() ? ' SMTP not configured on server.' : ''}`,
        ipAddress: req.ip,
      });
    }

    res.json({
      ...results,
      emailConfigured: isEmailConfigured(),
      whatsappConfigured: isWhatsAppConfigured(),
    });
  } catch (err) {
    logger.error('Bulk onboard error: %s', (err as Error).message);
    res.status(500).json({ error: 'Server error during bulk processing' });
  }
}

// ─── BULK RECYCLE BIN ACTIONS ───────────────────────────────────────────────

const bulkActionSchema = z.object({
  ids: z.union([z.string(), z.array(z.string())]).transform((val) => {
    const raw = Array.isArray(val) ? val : String(val || '').split(',');
    return raw.map((s) => String(s).trim()).filter((s) => mongoose.Types.ObjectId.isValid(s));
  }),
  reason: z.string().min(1, 'Reason is required')
});

export async function bulkRestoreUsers(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { ids, reason } = bulkActionSchema.parse(req.body);
    const approvalMemo = req.file?.filename;
    const tenantId = req.user!.tenant;
    if (!approvalMemo) { res.status(400).json({ error: 'Approval memo is required' }); return; }

    const updated = await User.updateMany(
      { _id: { $in: ids }, tenant: tenantId },
      { isDeleted: false, isActive: true, lastEditReason: `Bulk Restore: ${reason}` }
    );

    await AuditLog.create({
      tenant: tenantId, user: req.user!.id, action: 'BULK_RESTORE_USERS', module: 'RECYCLE_BIN',
      reason, details: `Bulk restored ${updated.modifiedCount} users. Memo: ${approvalMemo}`, ipAddress: req.ip,
    });
    res.json({ message: `Successfully restored ${updated.modifiedCount} users` });
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: 'Validation failed', details: err.errors }); return; }
    res.status(500).json({ error: 'Server error' });
  }
}

export async function bulkPermanentDeleteUsers(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { ids, reason } = bulkActionSchema.parse(req.body);
    const approvalMemo = req.file?.filename;
    const tenantId = req.user!.tenant;
    if (!approvalMemo) { res.status(400).json({ error: 'Approval memo is required' }); return; }

    const deleted = await User.deleteMany({ _id: { $in: ids }, tenant: tenantId });
    await AuditLog.create({
      tenant: tenantId, user: req.user!.id, action: 'BULK_PERMANENT_DELETE_USERS', module: 'RECYCLE_BIN',
      reason, details: `Bulk permanently deleted ${deleted.deletedCount} users. Memo: ${approvalMemo}`, ipAddress: req.ip,
    });
    res.json({ message: `Successfully deleted ${deleted.deletedCount} users` });
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: 'Validation failed', details: err.errors }); return; }
    res.status(500).json({ error: 'Server error' });
  }
}

export async function bulkRestoreStudents(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { ids, reason } = bulkActionSchema.parse(req.body);
    const approvalMemo = req.file?.filename;
    const tenantId = req.user!.tenant;
    if (!approvalMemo) { res.status(400).json({ error: 'Approval memo is required' }); return; }

    const students = await Student.find({ _id: { $in: ids }, tenant: tenantId }).select('user');
    const userIds = students.map(s => s.user);

    await Student.updateMany({ _id: { $in: ids }, tenant: tenantId }, { isDeleted: false });
    await User.updateMany({ _id: { $in: userIds } }, { isDeleted: false, isActive: true });

    await AuditLog.create({
      tenant: tenantId, user: req.user!.id, action: 'BULK_RESTORE_STUDENTS', module: 'RECYCLE_BIN',
      reason, details: `Bulk restored ${students.length} students. Memo: ${approvalMemo}`, ipAddress: req.ip,
    });
    res.json({ message: `Successfully restored ${students.length} students` });
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: 'Validation failed', details: err.errors }); return; }
    res.status(500).json({ error: 'Server error' });
  }
}

export async function bulkPermanentDeleteStudents(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { ids, reason } = bulkActionSchema.parse(req.body);
    const approvalMemo = req.file?.filename;
    const tenantId = req.user!.tenant;
    if (!approvalMemo) { res.status(400).json({ error: 'Approval memo is required' }); return; }

    if (!ids.length) {
      res.status(400).json({ error: 'No valid student IDs provided' });
      return;
    }

    const studentQuery: any = { _id: { $in: ids } };
    if (tenantId) {
      studentQuery.$or = [{ tenant: tenantId }, { tenant: { $exists: false } }, { tenant: null }];
    }
    const students = await Student.find(studentQuery).select('user');
    const userIds = students.map(s => s.user).filter(Boolean);

    await Student.deleteMany({ _id: { $in: ids } });
    if (userIds.length > 0) {
      await User.deleteMany({ _id: { $in: userIds } });
    }

    await AuditLog.create({
      tenant: tenantId, user: req.user!.id, action: 'BULK_PERMANENT_DELETE_STUDENTS', module: 'RECYCLE_BIN',
      reason, details: `Bulk permanently deleted ${students.length} students. Memo: ${approvalMemo}`, ipAddress: req.ip,
    });
    res.json({ message: `Successfully deleted ${students.length} students` });
  } catch (err: any) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: 'Validation failed', details: err.errors }); return; }
    logger.error('bulkPermanentDeleteStudents error: %s', err.message);
    res.status(500).json({ error: err.message || 'Server error' });
  }
}

export async function bulkRestoreCompanies(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { ids, reason } = bulkActionSchema.parse(req.body);
    const approvalMemo = req.file?.filename;
    const tenantId = req.user!.tenant;
    if (!approvalMemo) { res.status(400).json({ error: 'Approval memo is required' }); return; }

    const updated = await Company.updateMany(
      { _id: { $in: ids }, tenant: tenantId },
      { isDeleted: false, $unset: { deletedAt: 1, deletedBy: 1, deleteReason: 1 } }
    );

    await AuditLog.create({
      tenant: tenantId, user: req.user!.id, action: 'BULK_RESTORE_COMPANIES', module: 'RECYCLE_BIN',
      reason, details: `Bulk restored ${updated.modifiedCount} companies. Memo: ${approvalMemo}`, ipAddress: req.ip,
    });
    res.json({ message: `Successfully restored ${updated.modifiedCount} companies` });
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: 'Validation failed', details: err.errors }); return; }
    res.status(500).json({ error: 'Server error' });
  }
}

export async function bulkPermanentDeleteCompanies(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { ids, reason } = bulkActionSchema.parse(req.body);
    const approvalMemo = req.file?.filename;
    const tenantId = req.user!.tenant;
    if (!approvalMemo) { res.status(400).json({ error: 'Approval memo is required' }); return; }

    const deleted = await Company.deleteMany({ _id: { $in: ids }, tenant: tenantId });
    await AuditLog.create({
      tenant: tenantId, user: req.user!.id, action: 'BULK_PERMANENT_DELETE_COMPANIES', module: 'RECYCLE_BIN',
      reason, details: `Bulk permanently deleted ${deleted.deletedCount} companies. Memo: ${approvalMemo}`, ipAddress: req.ip,
    });
    res.json({ message: `Successfully deleted ${deleted.deletedCount} companies` });
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: 'Validation failed', details: err.errors }); return; }
    res.status(500).json({ error: 'Server error' });
  }
}

// ─── TESTING RESET (Admin only) ──────────────────────────────────────────────
/** POST /api/admin/reset-for-testing
 *  ⚠️  Wipes ALL dynamic data for the tenant and reseeds fresh baseline.
 *  Requires: Bearer token (admin role) + JSON body { confirm: "RESET" }
 */
export async function resetForTesting(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (req.body?.confirm !== 'RESET') {
      res.status(400).json({ error: 'Send { "confirm": "RESET" } to execute reset' });
      return;
    }

    const tenantId = req.user!.tenant;
    const adminUserId = req.user!.id;

    // 1 ── Wipe dynamic collections for this tenant ──────────────────────────
    const Student   = (await import('../models/Student.model')).default;
    const Logbook   = (await import('../models/Logbook.model')).default;
    const Attendance = (await import('../models/Attendance.model')).default;
    const EmailRecord = (await import('../models/EmailRecord.model')).default;
    const Chat = (await import('../models/Chat.model')).default;
    const Notification = (await import('../models/notification.model')).default;
    const Feedback = (await import('../models/Feedback.model')).default;
    const Assessment = (await import('../models/Assessment.model')).default;
    const Application = (await import('../models/Application.model')).default;
    const RefreshToken = (await import('../models/RefreshToken.model')).default;

    // Delete all non-admin users
    const nonAdminUsers = await User.find({ tenant: tenantId, _id: { $ne: adminUserId } }).distinct('_id');
    await User.deleteMany({ tenant: tenantId, _id: { $ne: adminUserId } });
    await Student.deleteMany({ tenant: tenantId });
    await Company.deleteMany({ tenant: tenantId });
    await Logbook.deleteMany({ tenant: tenantId });
    await Attendance.deleteMany({ tenant: tenantId });
    await EmailRecord.deleteMany({ tenant: tenantId });
    await Chat.deleteMany({ tenant: tenantId });
    await Notification.deleteMany({ tenant: tenantId });
    await Feedback.deleteMany({ tenant: tenantId });
    await Assessment.deleteMany({ tenant: tenantId });
    await Application.deleteMany({ tenant: tenantId });
    await AuditLog.deleteMany({ tenant: tenantId });
    await RefreshToken.deleteMany({ user: { $in: nonAdminUsers } });

    // 2 ── Reseed Programmes ─────────────────────────────────────────────────
    const progList = [
      { code: 'MSC-AI',  name: 'MSc Artificial Intelligence',        level: 'MSc' },
      { code: 'MSC-CYB', name: 'MSc Cybersecurity',                  level: 'MSc' },
      { code: 'MSC-MIS', name: 'MSc Management Information Systems', level: 'MSc' },
      { code: 'PHD-AI',  name: 'PhD Artificial Intelligence',        level: 'PhD' },
      { code: 'PHD-CYB', name: 'PhD Cybersecurity',                  level: 'PhD' },
      { code: 'PHD-MIS', name: 'PhD Management Information Systems', level: 'PhD' },
    ];
    for (const p of progList) {
      await Programme.findOneAndUpdate(
        { code: p.code, tenant: tenantId },
        { $set: { ...p, tenant: tenantId, isActive: true } },
        { upsert: true }
      );
    }

    // 3 ── Reseed Settings ───────────────────────────────────────────────────
    const Setting = (await import('../models/Setting.model')).default;
    const settingsList = [
      { key: 'academic_session', value: '2024/2025' },
      { key: 'system_name',      value: 'ACETEL Internship Management System' },
      { key: 'institution',      value: 'National Open University of Nigeria (NOUN)' },
    ];
    for (const s of settingsList) {
      await Setting.findOneAndUpdate(
        { key: s.key, tenant: tenantId },
        { $set: { ...s, tenant: tenantId } },
        { upsert: true }
      );
    }

    logger.info('🔄 Testing reset executed by admin %s for tenant %s', adminUserId, tenantId);

    res.json({
      message: '✅ Database reset complete. All test data cleared. Programmes re-seeded.',
      cleared: ['users (non-admin)', 'students', 'companies', 'logbooks', 'attendance',
                'emails', 'chats', 'notifications', 'feedback', 'assessments',
                'applications', 'auditlogs', 'refreshtokens'],
      reseeded: ['programmes', 'settings'],
    });
  } catch (err) {
    logger.error('resetForTesting error: %s', (err as Error).message);
    res.status(500).json({ error: 'Reset failed: ' + (err as Error).message });
  }
}
