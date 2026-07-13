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
import { sendEmail, emailTemplates, isEmailConfigured } from '../utils/mail.service';
import { sendWhatsAppMessage, whatsappTemplates } from '../utils/whatsapp.service';
import Notification from '../models/notification.model';
import { autoAllocateStudent } from '../utils/allocation.service';
import { normalizeStateName } from '../utils/nigeria-states.util';
import { purgeSoftDeletedIdentity } from '../utils/identity.util';
import {
  ALL_PERMISSIONS,
  PERMISSION_LABELS,
  Permission,
  DEFAULT_ROLE_PERMISSIONS,
} from '../utils/permissions.util';

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
  firstName: z.string().min(2),
  lastName: z.string().min(2),
  email: z.string().email(),
  matricNumber: z.string().min(5),
  programme: z.string().optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
  password: z.preprocess(
    (val) => (typeof val === 'string' && val.trim() === '' ? undefined : val),
    z.string().min(8).optional()
  ),
  personalEmail: z.preprocess(
    (val) => (typeof val === 'string' && val.trim() === '' ? undefined : val),
    z.string().email().optional()
  ),
  gender: z.enum(['Male', 'Female', 'Other']).optional(),
  isNigerian: z.boolean().optional(),
  address: z.string().optional().or(z.literal('')),
  stateOfOrigin: z.string().optional().or(z.literal('')),
  lga: z.string().optional().or(z.literal('')),
  academicSession: z.string().optional().or(z.literal('')),
  level: z.string().optional().or(z.literal('')),
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
    
    // Programme Isolation
    if (req.user!.role !== 'admin') {
      filter.programme = req.user!.programme;
    } else if (programme) {
      filter.programme = programme;
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

    const usersWithPerms = users.map((u) => {
      const doc = u.toObject();
      const custom = Array.isArray(doc.permissions) && doc.permissions.length > 0;
      return {
        ...doc,
        effectivePermissions: custom
          ? doc.permissions
          : DEFAULT_ROLE_PERMISSIONS[doc.role] || [],
      };
    });

    // Role-wise counts for current tenant
    const counts = await User.aggregate([
      { $match: { tenant: new mongoose.Types.ObjectId(tenantId), role: { $in: STAFF_ROLES } } },
      { $group: { _id: '$role', count: { $sum: 1 } } },
    ]);

    res.json({ users: usersWithPerms, total, counts });
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
      whatsappConfigured: !!(
        (process.env.WA_PHONE_NUMBER_ID && process.env.WA_ACCESS_TOKEN) ||
        (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_WHATSAPP_FROM)
      ),
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
    const tenantId = req.user!.tenant;
    if (!tenantId) {
      res.status(400).json({ error: 'Session expired or missing tenant. Please log out and sign in again.' });
      return;
    }

    const normMatric = normalizeMatricValue(matricNumber);
    const normEmail = email.toLowerCase().trim();

    if (req.user!.role === 'admin') {
      await purgeSoftDeletedIdentity(tenantId, { email: normEmail, matric: normMatric });
    }

    // Programme Isolation
    const targetProgramme = req.user!.role !== 'admin' ? req.user!.programme : programme;

    if (!targetProgramme) {
      res.status(400).json({ error: 'A programme must be selected' });
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
      matricNumber: normMatric,
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
      phone: phone?.trim(),
      tenant: tenantId,
      isActive: true,
    });

    await user.save();

    const normalizedState = normalizeStateName(stateOfOrigin) || undefined;
    const student = new Student({
      user: user._id,
      tenant: tenantId,
      matricNumber: normMatric,
      programme: targetProgramme,
      academicSession: academicSession || '2024/2025',
      level: level || 'MSc',
      status: 'pending',
      personalEmail: personalEmail?.trim().toLowerCase(),
      gender,
      isNigerian: isNigerian ?? true,
      address: address?.trim(),
      stateOfOrigin: normalizedState,
      lga: lga?.trim(),
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

    // Resolve programme name for notification
    const prog = await Programme.findById(targetProgramme).select('name');
    const progName = prog?.name || 'your programme';

    // Welcome notifications — institutional email + personal email + WhatsApp
    const appUrl = process.env.FRONTEND_URL || 'https://acetel-frontend.onrender.com';
    const welcomeHtml = emailTemplates.welcomeStudent(`${firstName} ${lastName}`, email, tempPassword, appUrl, 'Pending Placement');
    const delivery = { email: false, personalEmail: false, whatsapp: false };
    const deliveryDetails = {
      emailConfigured: isEmailConfigured(),
      whatsappConfigured: !!(
        (process.env.WA_PHONE_NUMBER_ID && process.env.WA_ACCESS_TOKEN) ||
        (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_WHATSAPP_FROM)
      ),
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

*Matric Number:* ${matricNumber}
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
      message: `Your student account is ready. Matric: ${matricNumber}. Login with your institutional email and temporary password.`,
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
      delivery,
      deliveryDetails,
      posting,
      tempPassword
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    if (err?.code === 11000) {
      const field = Object.keys(err.keyValue || {})[0] || 'identity';
      res.status(409).json({
        error: `Duplicate ${field}. If this student was deleted, release the email or matric from Recycle Bin first.`,
        field,
      });
      return;
    }
    logger.error('Create student error: %s', (err as Error).message);
    res.status(500).json({ error: 'Failed to onboard student. Please check required fields and try again.' });
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
    if (role)       user.role      = role as any;
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
    logger.error('Error: %s', (err as Error).message);
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
export async function bulkOnboard(req: AuthRequest, res: Response): Promise<void> {
  const { type, data } = req.body;
  const tenantId = req.user!.tenant;
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
    // Cache programmes for faster mapping for current tenant
    const allProgs = await Programme.find({ tenant: tenantId }).select('code _id');
    const progMap = allProgs.reduce((acc, p) => {
      acc[p.code.toLowerCase()] = p._id;
      return acc;
    }, {} as Record<string, mongoose.Types.ObjectId>);

    // PARTNER COMPANY BRANCH
    if (entityType === 'company') {
      const Company = (await import('../models/Company.model')).default;
      for (const row of data) {
        const name = String(row['Company Name'] || row.companyName || row.name || '').trim();
        const address = String(row['Company Address'] || row.address || '').trim();
        const specialisation = String(row['Area of Specialisation'] || row.specialisation || row.sector || 'General').trim();
        const state = String(row['State'] || row.state || 'Lagos').trim();

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
      const firstName = String(row['Other Names'] || row.otherNames || row.firstName || '').trim();
      const lastName = String(row['Surname'] || row.surname || row.lastName || '').trim();
      const email = String(row['Institutional Email'] || row.email || '').trim().toLowerCase();
      const matricNum = normalizeMatricValue(row['Matric Number'] || row.matricNumber || row.matric || '');
      const phone = String(row['Phone Number'] || row.phone || '').trim() || undefined;
      const personalEmail = String(row['Personal Email'] || row.personalEmail || '').trim().toLowerCase() || undefined;
      const gender = String(row['Gender'] || row.gender || 'Male').trim();
      const isNigerian = String(row['Nigerianity'] || row.nigerianity || row['Nigerian Status'] || '').toLowerCase() !== 'non-nigerian';
      const address = String(row['Address'] || row.address || '').trim() || undefined;
      const stateOfOrigin = String(row['State of Origin'] || row.stateOfOrigin || row.state || '').trim() || undefined;
      const programmeCodeValue = String(row['programmeCode'] || row['Programme Code'] || row.programme || row['programme'] || '').trim();
      const academicSession = String(row['academicSession'] || row['Academic Session'] || row.academic_session || '2024/2025').trim() || '2024/2025';
      const level = String(row['level'] || row['Level'] || 'MSc').trim() || 'MSc';

      if (!email || !firstName || !lastName || (entityType === 'student' && !matricNum)) {
        results.failed.push({ row, reason: 'Missing required profile fields' });
        continue;
      }

      const username = entityType === 'student' ? matricNum.toLowerCase() : email;
      const existingUser = await User.findOne({
        tenant: tenantId,
        isDeleted: { $ne: true },
        $or: [{ email }, { username }]
      });
      if (existingUser) {
        results.failed.push({ email, reason: 'User already exists in this institution' });
        continue;
      }

      let programmeId = programmeCodeValue ? progMap[programmeCodeValue.toLowerCase()] : null;
      if (req.user!.role !== 'admin') {
        programmeId = req.user!.programme as any;
      }

      const rawRoleValue = String(row['Role'] || row.role || 'supervisor');
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
        results.failed.push({ email, reason: 'Programme code is required and must match an existing programme' });
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
          });
          await student.save();

          const progDoc = programmeId ? await Programme.findById(programmeId).select('name') : null;
          const progName = progDoc?.name || programmeCodeValue || 'your programme';
          const delivery = await sendBulkStudentWelcome(
            { firstName: user.firstName, lastName: user.lastName, email: user.email, phone },
            matricNum,
            tempPassword,
            progName,
            personalEmail
          );

          try {
            await autoAllocateStudent((student._id as any).toString());
          } catch (allocErr) {
            logger.warn('Bulk auto-post failed for %s: %s', user.email, (allocErr as Error).message);
          }

          results.success.push({
            name: `${user.firstName} ${user.lastName}`,
            email: user.email,
            username: user.username,
            tempPassword,
            role: user.role,
            delivery,
          });
          continue;
        }

        // Staff welcome notifications
        const appUrl = process.env.FRONTEND_URL || 'https://acetel-frontend.onrender.com';
        const roleLabel = formatRoleLabel(role);
        let staffEmailSent = false;
        let staffWaSent = false;
        try {
          staffEmailSent = await sendEmail(
            user.email,
            'Welcome to ACETEL IMS — Your Account is Ready',
            emailTemplates.welcomeStaff(
              `${user.firstName} ${user.lastName}`,
              user.email,
              user.email,
              tempPassword,
              roleLabel,
              appUrl
            )
          );
        } catch (mailErr) {
          logger.warn('Bulk staff email failed for %s: %s', user.email, (mailErr as Error).message);
        }
        if (phone) {
          try {
            staffWaSent = await sendWhatsAppMessage(phone, whatsappTemplates.welcomeStaff(
              `${user.firstName} ${user.lastName}`,
              user.email,
              tempPassword,
              role,
              appUrl
            ));
          } catch (waErr) {
            logger.warn('Bulk staff WhatsApp failed for %s: %s', phone, (waErr as Error).message);
          }
        }

        results.success.push({
          name: `${user.firstName} ${user.lastName}`,
          email: user.email,
          username: user.username,
          tempPassword,
          role: user.role,
          delivery: { email: staffEmailSent, whatsapp: staffWaSent },
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
        reason: `Bulk onboarded ${results.success.length} ${entityType} accounts`,
        details: `Successfully enrolled ${results.success.length} users.`,
        ipAddress: req.ip,
      });
    }

    res.json(results);
  } catch (err) {
    logger.error('Bulk onboard error: %s', (err as Error).message);
    res.status(500).json({ error: 'Server error during bulk processing' });
  }
}

/** GET /api/admin/permissions — catalog of assignable permissions */
export async function listPermissionCatalog(_req: AuthRequest, res: Response): Promise<void> {
  res.json({
    permissions: ALL_PERMISSIONS.map((key) => ({
      key,
      label: PERMISSION_LABELS[key],
    })),
  });
}

const updatePermissionsSchema = z.object({
  permissions: z.array(z.string()),
  reason: z.string().min(3),
});

/** PUT /api/admin/users/:id/permissions — assign granular permissions (admin only) */
export async function updateUserPermissions(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = idParamSchema.parse(req.params);
    const { permissions, reason } = updatePermissionsSchema.parse(req.body);
    const tenantId = req.user!.tenant;

    const user = await User.findOne({ _id: id, tenant: tenantId, isDeleted: { $ne: true } });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    if (user.role === 'admin') {
      res.status(403).json({ error: 'Administrator permissions cannot be modified' });
      return;
    }

    const valid = permissions.filter((p): p is Permission =>
      ALL_PERMISSIONS.includes(p as Permission)
    );
    user.permissions = valid;
    await user.save();

    await AuditLog.create({
      tenant: tenantId,
      user: req.user!.id,
      action: 'UPDATE_PERMISSIONS',
      module: 'USER_MANAGEMENT',
      targetId: id,
      reason,
      details: `Updated permissions for ${user.email}: ${valid.join(', ') || '(role defaults)'}`,
      ipAddress: req.ip,
    });

    const updated = await User.findById(id).select('-password').populate('programme', 'code name level');
    res.json({
      user: updated,
      effectivePermissions: valid.length ? valid : DEFAULT_ROLE_PERMISSIONS[user.role] || [],
      message: 'Permissions updated successfully',
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    logger.error('updateUserPermissions: %s', (err as Error).message);
    res.status(500).json({ error: 'Server error' });
  }
}

async function sendBulkStudentWelcome(
  user: { firstName: string; lastName: string; email: string; phone?: string },
  matricNumber: string,
  tempPassword: string,
  progName: string,
  personalEmail?: string
): Promise<{ email: boolean; personalEmail: boolean; whatsapp: boolean }> {
  const appUrl = process.env.FRONTEND_URL || 'https://acetel-frontend.onrender.com';
  const welcomeHtml = emailTemplates.welcomeStudent(
    `${user.firstName} ${user.lastName}`,
    user.email,
    tempPassword,
    appUrl,
    'Pending Placement'
  );
  const delivery = { email: false, personalEmail: false, whatsapp: false };
  try {
    delivery.email = await sendEmail(user.email, 'Welcome to ACETEL IMS — Your Account is Ready', welcomeHtml);
  } catch (e) {
    logger.warn('Bulk student email failed for %s: %s', user.email, (e as Error).message);
  }
  if (personalEmail) {
    try {
      delivery.personalEmail = await sendEmail(personalEmail, 'Welcome to ACETEL IMS — Your Account is Ready', welcomeHtml);
    } catch (e) {
      logger.warn('Bulk personal email failed for %s: %s', personalEmail, (e as Error).message);
    }
  }
  if (user.phone) {
    try {
      delivery.whatsapp = await sendWhatsAppMessage(
        user.phone,
        `*ACETEL IMS — Enrollment Successful* 🎓

Hello ${user.firstName},

You have been enrolled on the ACETEL Virtual Internship Management System.

*Matric Number:* ${matricNumber}
*Programme:* ${progName}
*Login Email:* ${user.email}
*Temporary Password:* ${tempPassword}

Access the portal here:
${appUrl}

_Please change your password after first login._`
      );
    } catch (e) {
      logger.warn('Bulk WhatsApp failed for %s: %s', user.phone, (e as Error).message);
    }
  }
  return delivery;
}


const bulkActionSchema = z.object({
  ids: z.union([z.string(), z.array(z.string())]).transform((val) => Array.isArray(val) ? val : val.split(',')),
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

    const students = await Student.find({ _id: { $in: ids }, tenant: tenantId }).select('user');
    const userIds = students.map(s => s.user);

    await Student.deleteMany({ _id: { $in: ids }, tenant: tenantId });
    await User.deleteMany({ _id: { $in: userIds } });

    await AuditLog.create({
      tenant: tenantId, user: req.user!.id, action: 'BULK_PERMANENT_DELETE_STUDENTS', module: 'RECYCLE_BIN',
      reason, details: `Bulk permanently deleted ${students.length} students. Memo: ${approvalMemo}`, ipAddress: req.ip,
    });
    res.json({ message: `Successfully deleted ${students.length} students` });
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: 'Validation failed', details: err.errors }); return; }
    res.status(500).json({ error: 'Server error' });
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
