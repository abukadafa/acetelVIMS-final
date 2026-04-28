import { Request, Response, CookieOptions } from 'express';
import User from '../models/User.model';
import Student from '../models/Student.model';
import Programme from '../models/Programme.model';
import Tenant from '../models/Tenant.model';
import RefreshToken from '../models/RefreshToken.model';
import { AuthRequest } from '../middleware/auth.middleware';
import { fetchStudentDetails } from '../utils/sdms.service';
import AuditLog from '../models/AuditLog.model';
import NotificationModel from '../models/notification.model';
import logger from '../utils/logger';
import { loginSchema, registerSchema } from '../utils/validation';
import * as authService from '../services/auth.service';
import { sendEmail, emailTemplates } from '../utils/mail.service';
import { sendWhatsAppMessage, whatsappTemplates } from '../utils/whatsapp.service';
import { autoAllocateStudent } from '../utils/allocation.service';
import { z } from 'zod';

const COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: 'none',
  maxAge: 8 * 60 * 60 * 1000,
  path: '/',
};

const REFRESH_COOKIE_OPTIONS: CookieOptions = {
  ...COOKIE_OPTIONS,
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

// ─── LOGIN ─────────────────────────────────────────────────────────────────
export async function login(req: Request, res: Response): Promise<void> {
  try {
    const validatedData = loginSchema.safeParse(req.body);
    if (!validatedData.success) {
      res.status(400).json({ error: 'Validation failed', details: validatedData.error.format() });
      return;
    }

    const { identifier, password } = validatedData.data;
    const cleanIdentifier = identifier.trim().toLowerCase();

    // ── ADMIN shortcut via ENV ──
    const envAdminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    const envAdminPass  = process.env.ADMIN_PASSWORD?.trim();

    if (envAdminEmail && (cleanIdentifier === envAdminEmail || cleanIdentifier === 'admin')) {
      if (password !== envAdminPass) {
        res.status(401).json({ error: 'Invalid admin password.' });
        return;
      }
      const adminUser = await User.findOne({ email: envAdminEmail });
      if (!adminUser) {
        res.status(401).json({ error: 'Admin profile missing. Please wait for seeding.' });
        return;
      }
      // Ensure we always use a real tenant ObjectId in the token
      let adminTenantId = adminUser.tenant?.toString();
      if (!adminTenantId || adminTenantId === 'default') {
        const defaultTenantDoc = await Tenant.findOne({ slug: 'acetel' });
        adminTenantId = defaultTenantDoc?._id.toString() || '';
        // Sync it back to the user record
        if (defaultTenantDoc) {
          await User.findByIdAndUpdate(adminUser._id, { tenant: defaultTenantDoc._id });
        }
      }
      const { access, refresh } = await authService.generateTokens({
        id: adminUser._id.toString(), role: 'admin',
        email: adminUser.email, tenant: adminTenantId
      }, req.ip || 'unknown', req.get('user-agent') || 'unknown');
      res.cookie('token', access, COOKIE_OPTIONS);
      res.cookie('refresh_token', refresh, REFRESH_COOKIE_OPTIONS);
      res.json({ user: { id: adminUser._id, email: adminUser.email, role: 'admin',
        firstName: adminUser.firstName, lastName: adminUser.lastName, tenant: adminUser.tenant },
        accessToken: access });
      return;
    }

    // ── STANDARD FLOW ──
    const user = await User.findOne({
      $or: [{ email: cleanIdentifier }, { username: cleanIdentifier }],
      isActive: true
    });

    if (!user) {
      const defaultTenant = await Tenant.findOne({ slug: 'acetel' });
      await AuditLog.create({ tenant: defaultTenant?._id, action: 'LOGIN_FAILED', module: 'AUTH',
        details: `Failed login for: ${identifier}`, ipAddress: req.ip }).catch(() => {});
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      await AuditLog.create({ user: user._id, tenant: user.tenant, action: 'LOGIN_FAILED',
        module: 'AUTH', details: `Wrong password for: ${user.email}`, ipAddress: req.ip }).catch(() => {});
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    user.lastLogin = new Date();
    await user.save();

    const { access, refresh } = await authService.generateTokens({
      id: user._id.toString(), role: user.role, email: user.email,
      tenant: user.tenant.toString(), programme: user.programme?.toString()
    }, req.ip || 'unknown', req.get('user-agent') || 'unknown');

    res.cookie('token', access, COOKIE_OPTIONS);
    res.cookie('refresh_token', refresh, REFRESH_COOKIE_OPTIONS);

    let studentData = null;
    if (user.role === 'student') {
      studentData = await Student.findOne({ user: user._id, tenant: user.tenant })
        .populate('programme').populate('company')
        .populate('supervisor', 'firstName lastName email phone');
    }

    await AuditLog.create({ user: user._id, tenant: user.tenant, action: 'LOGIN_SUCCESS',
      module: 'AUTH', details: `Login: ${user.email} (${user.role})`, ipAddress: req.ip }).catch(() => {});

    res.json({ user: { id: user._id, email: user.email, role: user.role,
      firstName: user.firstName, lastName: user.lastName, phone: user.phone,
      avatar: user.avatar, tenant: user.tenant }, student: studentData, accessToken: access });
  } catch (err) {
    logger.error('Login Error: %s', (err as Error).message);
    res.status(500).json({ error: 'Server error' });
  }
}

// ─── REGISTER ──────────────────────────────────────────────────────────────
export async function register(req: Request, res: Response): Promise<void> {
  try {
    const validatedData = registerSchema.safeParse(req.body);
    if (!validatedData.success) {
      res.status(400).json({ error: 'Validation failed', details: validatedData.error.format() });
      return;
    }

    const {
      email, password, firstName, lastName, phone,
      role, matricNumber, academicSession, level,
      stateOfOrigin, lga, address, lat, lng,
      tenantSlug = 'acetel'
    } = validatedData.data as any;

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }

    let tenant = await Tenant.findOne({ slug: tenantSlug });
    if (!tenant) {
      if (tenantSlug === 'acetel') {
        tenant = new Tenant({ name: 'ACETEL', slug: 'acetel', institutionType: 'University' });
        await tenant.save();
      } else {
        res.status(404).json({ error: 'Tenant not found' });
        return;
      }
    }

    let programmeId = null;
    if (role === 'student') {
      if (!matricNumber) {
        res.status(400).json({ error: 'Matric number is required for students' });
        return;
      }
      const sdmsData = await fetchStudentDetails(matricNumber);
      if (!sdmsData) {
        res.status(404).json({ error: 'Matric number not found in institution records' });
        return;
      }
      let prog = await Programme.findOne({ code: sdmsData.programme, tenant: tenant._id });
      if (!prog) {
        prog = new Programme({
          code: sdmsData.programme,
          name: (sdmsData as any).programmeName || sdmsData.programme,
          level: (sdmsData as any).level || 'MSc',
          tenant: tenant._id
        });
        await prog.save();
      }
      programmeId = prog._id;
    }

    const cleanEmail    = email.trim().toLowerCase();
    const cleanUsername = (role === 'student' ? matricNumber.trim() : cleanEmail).toLowerCase();

    const user = new User({
      email: cleanEmail, username: cleanUsername, password, role,
      firstName: firstName.trim(), lastName: lastName.trim(),
      phone: phone?.trim(), tenant: tenant._id
    });
    await user.save();

    let studentDoc: any = null;
    if (role === 'student') {
      studentDoc = new Student({
        user: user._id, tenant: tenant._id, matricNumber,
        programme: programmeId, academicSession: academicSession || '2024/2025',
        level: level || 'MSc', stateOfOrigin, lga, address, lat, lng,
        riskScore: 0, riskLevel: 'Low'
      });
      await studentDoc.save();
    }

    const { access, refresh } = await authService.generateTokens({
      id: user._id.toString(), role: user.role,
      email: user.email, tenant: user.tenant.toString()
    }, req.ip || 'unknown', req.get('user-agent') || 'unknown');

    res.cookie('token', access, COOKIE_OPTIONS);
    res.cookie('refresh_token', refresh, REFRESH_COOKIE_OPTIONS);

    await AuditLog.create({ user: user._id, tenant: tenant._id, action: 'USER_REGISTERED',
      module: 'AUTH', details: `New ${role} registered: ${cleanEmail}`, ipAddress: req.ip }).catch(() => {});

    // ── POST-REGISTRATION: Auto-allocate student + send full notifications ──
    if (role === 'student' && studentDoc) {
      setImmediate(async () => {
        try {
          const appUrl = process.env.FRONTEND_URL || 'https://acetel-vims.onrender.com';
          const tempPassword = password; // already plaintext at this stage

          // 1. Auto-allocate to nearest partner company
          let allocationResult: any = { success: false };
          try {
            allocationResult = await autoAllocateStudent(studentDoc._id.toString());
          } catch (allocErr: any) {
            logger.warn('Auto-allocation skipped: %s', allocErr.message);
          }

          const companyName  = allocationResult.success ? allocationResult.company : 'Pending Allocation';
          const studentName  = `${user.firstName} ${user.lastName}`;

          // 2. In-app notification
          await NotificationModel.create({
            user: user._id,
            title: 'Welcome to ACETEL VIMS',
            message: `Your account has been created. ${allocationResult.success ? `You have been placed at ${companyName}.` : 'Your company placement is pending.'}`,
            type: 'success'
          });

          // 3. Institutional email
          await sendEmail(cleanEmail, 'Welcome to ACETEL VIMS — Your Login Details',
            emailTemplates.welcomeStudent(studentName, cleanEmail, tempPassword, appUrl, companyName));

          // 4. WhatsApp notification
          if (user.phone) {
            await sendWhatsAppMessage(user.phone,
              whatsappTemplates.welcomeStudent(studentName, cleanEmail, tempPassword, appUrl, companyName));
          }

          // 6. Notify company if allocated
          if (allocationResult.success) {
            const company = await (await import('../models/Company.model')).default
              .findOne({ name: companyName });
            if (company?.contactEmail) {
              await sendEmail(company.contactEmail,
                `New Intern Assigned — ${studentName}`,
                emailTemplates.companyPlacementNotice(companyName, studentName, matricNumber, cleanEmail, user.phone || 'N/A'));
            }
          }

        } catch (bgErr: any) {
          logger.error('Post-registration notifications error: %s', bgErr.message);
        }
      });
    }

    // ── POST-REGISTRATION: Staff welcome email ──
    if (role !== 'student') {
      setImmediate(async () => {
        try {
          const appUrl = process.env.FRONTEND_URL || 'https://acetel-vims.onrender.com';
          await sendEmail(cleanEmail, 'Welcome to ACETEL VIMS — Staff Account Created',
            emailTemplates.welcomeStaff(`${firstName} ${lastName}`, cleanEmail, password, role, appUrl));
          if (phone) {
            await sendWhatsAppMessage(phone,
              whatsappTemplates.welcomeStaff(`${firstName} ${lastName}`, cleanEmail, password, role, appUrl));
          }
        } catch (e: any) {
          logger.error('Staff welcome notification error: %s', e.message);
        }
      });
    }

    res.status(201).json({ message: 'Registration successful' });
  } catch (err) {
    logger.error('Registration Error: %s', (err as Error).message);
    res.status(500).json({ error: 'Server error during registration' });
  }
}

// ─── REFRESH TOKEN ──────────────────────────────────────────────────────────
export async function refreshToken(req: Request, res: Response): Promise<void> {
  const token = req.cookies?.refresh_token || req.body.refreshToken;
  if (!token) { res.status(401).json({ error: 'Refresh token required' }); return; }

  try {
    const record = await RefreshToken.findOne({ token, isRevoked: false });
    if (!record || record.expiresAt < new Date()) {
      res.status(401).json({ error: 'Invalid or expired refresh token' }); return;
    }

    const user = await User.findById(record.user);
    if (!user || !user.isActive) { res.status(401).json({ error: 'Authentication failed' }); return; }

    record.isRevoked = true;
    const { access, refresh } = await authService.generateTokens({
      id: user._id.toString(), role: user.role, email: user.email,
      tenant: user.tenant.toString(), programme: user.programme?.toString()
    }, req.ip || 'unknown', req.get('user-agent') || 'unknown');
    record.replacedByToken = refresh;
    await record.save();

    res.cookie('token', access, COOKIE_OPTIONS);
    res.cookie('refresh_token', refresh, REFRESH_COOKIE_OPTIONS);
    res.json({ message: 'Token refreshed' });
  } catch (err) {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
}

// ─── PROFILE ────────────────────────────────────────────────────────────────
export async function getProfile(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user) { res.status(401).json({ error: 'Session invalid' }); return; }
    const user = await User.findOne({ _id: req.user.id, tenant: req.user.tenant }).select('-password');
    if (!user || !user.isActive) { res.status(401).json({ error: 'Unauthorized' }); return; }

    let studentData = null;
    if (user.role === 'student') {
      studentData = await Student.findOne({ user: user._id, tenant: req.user.tenant })
        .populate('programme').populate('company')
        .populate('supervisor', 'firstName lastName email phone');
    }
    res.json({ user, student: studentData });
  } catch (err) {
    logger.error('Profile Error: %s', (err as Error).message);
    res.status(500).json({ error: 'Server error' });
  }
}

const updateProfileSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  phone: z.string().min(5).optional(),
});

export async function updateProfile(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { firstName, lastName, phone } = updateProfileSchema.parse(req.body);
    const user = await User.findOne({ _id: req.user!.id, tenant: req.user!.tenant });
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }

    if (firstName !== undefined) user.firstName = firstName;
    if (lastName !== undefined) user.lastName = lastName;
    if (phone !== undefined) user.phone = phone;

    await user.save();

    await AuditLog.create({
      user: user._id,
      tenant: req.user!.tenant,
      action: 'UPDATE_PROFILE',
      module: 'AUTH',
      details: `Updated profile: ${user.email}`,
      ipAddress: req.ip,
    }).catch(() => {});

    const updated = await User.findOne({ _id: req.user!.id, tenant: req.user!.tenant }).select('-password');
    res.json({ user: updated, message: 'Profile updated successfully' });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    logger.error('updateProfile: %s', (err as Error).message);
    res.status(500).json({ error: 'Server error' });
  }
}

// ─── CHANGE PASSWORD ────────────────────────────────────────────────────────
export async function changePassword(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findOne({ _id: req.user!.id, tenant: req.user!.tenant });
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) { res.status(400).json({ error: 'Current password incorrect' }); return; }

    user.password = newPassword;
    await user.save();
    await RefreshToken.updateMany({ user: req.user!.id, isRevoked: false }, { isRevoked: true });
    await AuditLog.create({ user: user._id, tenant: req.user!.tenant, action: 'PASSWORD_CHANGED',
      module: 'SECURITY', details: `Password changed: ${user.email}`, ipAddress: req.ip });

    res.json({ message: 'Password changed. Please log in again on other devices.' });
  } catch (err) {
    logger.error('Password Change Error: %s', (err as Error).message);
    res.status(500).json({ error: 'Server error' });
  }
}

// ─── LOGOUT ─────────────────────────────────────────────────────────────────
export async function logout(req: AuthRequest, res: Response): Promise<void> {
  try {
    const token = req.cookies?.refresh_token;
    if (token && req.user?.tenant) {
      await RefreshToken.findOneAndUpdate({ token, tenant: req.user.tenant }, { isRevoked: true });
    }
    if (req.user) {
      await AuditLog.create({ user: req.user.id as any, tenant: req.user.tenant as any,
        action: 'LOGOUT', module: 'AUTH', details: `Logout: ${req.user.email}`, ipAddress: req.ip }).catch(() => {});
    }
    const clearOpts: CookieOptions = { httpOnly: true, secure: true, sameSite: 'none', path: '/' };
    res.clearCookie('token', clearOpts);
    res.clearCookie('refresh_token', clearOpts);
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    logger.error('Logout Error: %s', (err as Error).message);
    res.status(500).json({ error: 'Server error' });
  }
}

// ─── COMMS STATUS ────────────────────────────────────────────────────────────
export async function getCommsStatus(_req: Request, res: Response): Promise<void> {
  const emailActive    = !!(process.env.SMTP_USER && process.env.SMTP_PASS);
  const whatsappActive = !!(process.env.WA_PHONE_NUMBER_ID && process.env.WA_ACCESS_TOKEN);
  res.json({
    email:    { active: emailActive,    provider: emailActive    ? (process.env.SMTP_HOST || 'smtp.gmail.com') : null },
    whatsapp: { active: whatsappActive, provider: whatsappActive ? 'Meta WhatsApp Cloud API (Free)'           : null },
    chat:     { active: true,           provider: 'ACETEL IMS Real-Time Chat (Socket.IO)'                          },
  });
}

// ─── TEST WHATSAPP ───────────────────────────────────────────────────────────
export async function testWhatsApp(req: Request, res: Response): Promise<void> {
  try {
    const { phone } = req.body;
    if (!phone) { res.status(400).json({ error: 'Phone number required' }); return; }
    await sendWhatsAppMessage(phone, '*ACETEL VIMS Test* ✅\n\nWhatsApp notifications are working correctly.');
    res.json({ message: 'Test WhatsApp message sent' });
  } catch (err) {
    res.status(500).json({ error: 'WhatsApp test failed' });
  }
}

// ─── WHATSAPP WEBHOOK ────────────────────────────────────────────────────────
export async function whatsappWebhookVerify(req: Request, res: Response): Promise<void> {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === process.env.META_WA_VERIFY_TOKEN) {
    res.status(200).send(challenge);
  } else {
    res.status(403).json({ error: 'Forbidden' });
  }
}

export async function whatsappWebhookReceive(req: Request, res: Response): Promise<void> {
  // Handle incoming WhatsApp messages
  logger.info('WhatsApp webhook received: %j', req.body);
  res.status(200).json({ status: 'ok' });
}
