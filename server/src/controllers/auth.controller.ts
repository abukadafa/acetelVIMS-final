import { Request, Response, CookieOptions } from 'express';
import User from '../models/User.model';
import Student from '../models/Student.model';
import Programme from '../models/Programme.model';
import Tenant from '../models/Tenant.model';
import RefreshToken from '../models/RefreshToken.model';
import { AuthRequest } from '../middleware/auth.middleware';
import { fetchStudentDetails } from '../utils/sdms.service';
import AuditLog from '../models/AuditLog.model';
import logger from '../utils/logger';
import { loginSchema, registerSchema } from '../utils/validation';
import * as authService from '../services/auth.service';

const isProduction = process.env.NODE_ENV === 'production';

// Cross-origin cookie config:
// Frontend (acetel-frontend.onrender.com) and backend (acetel-backend.onrender.com)
// are on different subdomains, so cookies MUST use sameSite:'none' + secure:true
// in production to be sent with cross-origin requests (withCredentials:true).
const COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? 'none' : 'lax',
  maxAge: 8 * 60 * 60 * 1000, // 8 hours for access token
  path: '/',
};

const REFRESH_COOKIE_OPTIONS: CookieOptions = {
  ...COOKIE_OPTIONS,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

// Local token generation removed - now handled by auth.service.ts

export async function login(req: Request, res: Response): Promise<void> {
  try {
    const validatedData = loginSchema.safeParse(req.body);
    if (!validatedData.success) {
      res.status(400).json({ error: 'Validation failed', details: validatedData.error.format() });
      return;
    }

    const { identifier, password } = validatedData.data;
    const cleanIdentifier = identifier.trim().toLowerCase();
    
    // --- NO CONFLICT DESIGN: Environment-First Admin Validation ---
    const envAdminEmail = process.env.ADMIN_EMAIL;
    const envAdminPass = process.env.ADMIN_PASSWORD;

    if (cleanIdentifier === envAdminEmail?.toLowerCase()) {
      if (password === envAdminPass) {
        // Authenticated via Environment - fetch DB record for metadata only
        const adminUser = await User.findOne({ email: envAdminEmail.toLowerCase() });
        
        if (!adminUser) {
          logger.error('CRITICAL: Admin email matches environment, but no User record exists in DB for metadata.');
          res.status(500).json({ error: 'Server misconfigured: Admin record missing in DB.' });
          return;
        }

        const { access, refresh } = await authService.generateTokens({ 
          id: adminUser._id.toString(), 
          role: 'admin', 
          email: adminUser.email,
          tenant: adminUser.tenant.toString()
        }, req.ip, req.get('user-agent'));

        res.cookie('token', access, COOKIE_OPTIONS);
        res.cookie('refresh_token', refresh, REFRESH_COOKIE_OPTIONS);

        logger.info('Login Success: Admin %s authenticated via ENVIRONMENT', envAdminEmail);
        await AuditLog.create({
          user: adminUser._id,
          tenant: adminUser.tenant,
          action: 'LOGIN_SUCCESS',
          module: 'AUTH',
          details: 'Administrative login authenticated via environment variables',
          ipAddress: req.ip
        });

        res.json({
          user: {
            id: adminUser._id,
            email: adminUser.email,
            role: 'admin',
            firstName: adminUser.firstName,
            lastName: adminUser.lastName,
            tenant: adminUser.tenant,
          },
          accessToken: access,
        });
        return;
      } else {
        logger.warn('Login Failure: Admin password mismatch via environment for %s', envAdminEmail);
        res.status(401).json({ error: 'Invalid credentials' });
        return;
      }
    }

    // --- STANDARD FLOW: Database-based validation for all other users ---
    const user = await User.findOne({ 
      $or: [
        { email: cleanIdentifier }, 
        { username: cleanIdentifier }
      ], 
      isActive: true 
    });

    if (!user) {
      logger.warn('Login Failure: User not found or inactive for identifier: %s', cleanIdentifier);
      
      // Resolve default tenant for logging if user not found
      const defaultTenant = await Tenant.findOne({ slug: 'acetel' });
      
      try {
        await AuditLog.create({
          tenant: defaultTenant?._id,
          action: 'LOGIN_FAILED',
          module: 'AUTH',
          details: `Failed login attempt for identifier: ${identifier}`,
          ipAddress: req.ip
        });
      } catch (logErr: any) {
        logger.error('AuditLog Error: %s', logErr.message);
      }

      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      logger.warn('Login Failure: Password mismatch for user: %s', user.email);
      try {
        await AuditLog.create({
          user: user._id,
          tenant: user.tenant,
          action: 'LOGIN_FAILED',
          module: 'AUTH',
          details: `Incorrect password attempt for user: ${user.email}`,
          ipAddress: req.ip
        });
      } catch (logErr: any) {
        logger.error('AuditLog Error: %s', logErr.message);
      }

      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    user.lastLogin = new Date();
    await user.save();

    const { access, refresh } = await authService.generateTokens({ 
      id: user._id.toString(), 
      role: user.role, 
      email: user.email,
      tenant: user.tenant.toString(),
      programme: user.programme?.toString()
    }, req.ip, req.get('user-agent'));

    res.cookie('token', access, COOKIE_OPTIONS);
    res.cookie('refresh_token', refresh, REFRESH_COOKIE_OPTIONS);

    let studentData = null;
    if (user.role === 'student') {
      studentData = await Student.findOne({ user: user._id, tenant: user.tenant })
        .populate('programme')
        .populate('company')
        .populate('supervisor', 'firstName lastName email phone');
    }

    logger.info('Login Success: User %s logged in from IP %s', user.email, req.ip);
    await AuditLog.create({
      user: user._id,
      tenant: user.tenant,
      action: 'LOGIN_SUCCESS',
      module: 'AUTH',
      details: `Successful login for user: ${user.email} (${user.role})`,
      ipAddress: req.ip
    });

    res.json({
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        avatar: user.avatar,
        tenant: user.tenant,
      },
      student: studentData,
      accessToken: access,
    });
  } catch (err) {
    logger.error('Login Error: %s', (err as Error).message);
    res.status(500).json({ error: 'Server error' });
  }
}

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
        res.status(404).json({ error: 'Specified tenant not found' });
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

      const prog = await Programme.findOne({ code: sdmsData.programme, tenant: tenant._id });
      if (!prog) {
        const newProg = new Programme({
          code: sdmsData.programme,
          name: (sdmsData as any).programmeName || sdmsData.programme,
          level: (sdmsData as any).level || 'MSc',
          tenant: tenant._id
        });
        await newProg.save();
        programmeId = newProg._id;
      } else {
        programmeId = prog._id;
      }
    }

    const avatarPath = req.file ? `/uploads/avatars/${req.file.filename}` : undefined;

    const cleanEmail = email.trim().toLowerCase();
    const cleanUsername = (role === 'student' ? matricNumber.trim() : cleanEmail).toLowerCase();

    const user = new User({
      email: cleanEmail,
      username: cleanUsername,
      password,
      role,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phone: phone?.trim(),
      avatar: avatarPath,
      tenant: tenant._id
    });

    await user.save();

    if (role === 'student') {
      const student = new Student({
        user: user._id,
        tenant: tenant._id,
        matricNumber,
        programme: programmeId,
        academicSession: academicSession || '2024/2025',
        level: level || 'MSc',
        stateOfOrigin,
        lga,
        address,
        lat,
        lng,
        riskScore: 0,
        riskLevel: 'Low'
      });
      await student.save();
    }

    const { access, refresh } = await authService.generateTokens({ 
      id: user._id.toString(), 
      role: user.role, 
      email: user.email,
      tenant: user.tenant.toString()
    }, req.ip, req.get('user-agent'));

    res.cookie('token', access, COOKIE_OPTIONS);
    res.cookie('refresh_token', refresh, REFRESH_COOKIE_OPTIONS);

    logger.info('Registration Success: New user %s registered from IP %s', user.email, req.ip);
    await AuditLog.create({
      user: user._id,
      tenant: tenant._id,
      action: 'USER_REGISTERED',
      module: 'AUTH',
      details: `New account registered: ${email} as ${user.role} for tenant ${tenant.slug}`,
      ipAddress: req.ip
    });

    res.status(201).json({ 
      message: 'Registration successful' 
    });
  } catch (err) {
    logger.error('Registration Error: %s', (err as Error).message);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function refreshToken(req: Request, res: Response): Promise<void> {
  const token = req.cookies?.refresh_token || req.body.refreshToken;
  
  if (!token) {
    res.status(401).json({ error: 'Refresh token required' });
    return;
  }

  try {
    const refreshTokenRecord = await RefreshToken.findOne({ token, isRevoked: false });
    
    if (!refreshTokenRecord) {
      logger.warn('Suspicious Activity: Invalid or revoked refresh token used from IP %s', req.ip);
      res.status(401).json({ error: 'Invalid refresh token' });
      return;
    }

    if (refreshTokenRecord.expiresAt < new Date()) {
      res.status(401).json({ error: 'Refresh token expired' });
      return;
    }

    const user = await User.findById(refreshTokenRecord.user);
    if (!user || !user.isActive) {
      res.status(401).json({ error: 'Authentication failed' });
      return;
    }

    // REVOKE OLD TOKEN (Rotation)
    refreshTokenRecord.isRevoked = true;
    
    const { access, refresh } = await authService.generateTokens({ 
      id: user._id.toString(), 
      role: user.role, 
      email: user.email,
      tenant: user.tenant.toString(),
      programme: user.programme?.toString()
    }, req.ip, req.get('user-agent'));

    refreshTokenRecord.replacedByToken = refresh;
    await refreshTokenRecord.save();

    res.cookie('token', access, COOKIE_OPTIONS);
    res.cookie('refresh_token', refresh, REFRESH_COOKIE_OPTIONS);

    res.json({ message: 'Token refreshed' });
  } catch (err) {
    logger.warn('Token Refresh Failure: %s from IP %s', (err as Error).message, req.ip);
    res.status(401).json({ error: 'Invalid refresh token' });
  }
}

export async function getProfile(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id: userId, tenant: userTenant } = req.user!;
    const user = await User.findOne({ _id: userId, tenant: userTenant }).select('-password');
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    let studentData = null;
    if (user.role === 'student') {
      studentData = await Student.findOne({ user: user._id, tenant: userTenant })
        .populate('programme')
        .populate('company')
        .populate('supervisor', 'firstName lastName email phone');
    }

    res.json({ user, student: studentData });
  } catch (err) {
    logger.error('Profile Fetch Error: %s', (err as Error).message);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function changePassword(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { currentPassword, newPassword } = req.body;
    const { id: userId, tenant: userTenant } = req.user!;
    
    const user = await User.findOne({ _id: userId, tenant: userTenant });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      res.status(400).json({ error: 'Current password incorrect' });
      return;
    }

    user.password = newPassword;
    await user.save();

    // Revoke all refresh tokens for this user on password change (Force logout of other sessions)
    await RefreshToken.updateMany({ user: userId, isRevoked: false }, { isRevoked: true });

    await AuditLog.create({
      user: user._id,
      tenant: userTenant,
      action: 'PASSWORD_CHANGED',
      module: 'SECURITY',
      details: `User ${user.email} changed their password`,
      ipAddress: req.ip
    });

    res.json({ message: 'Password changed successfully. Please log in again on other devices.' });
  } catch (err) {
    logger.error('Password Change Error: %s', (err as Error).message);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function logout(req: AuthRequest, res: Response): Promise<void> {
  try {
    const token = req.cookies?.refresh_token;
    if (token && req.user?.tenant) {
      await RefreshToken.findOneAndUpdate({ token, tenant: req.user.tenant }, { isRevoked: true });
    }

    if (req.user) {
      await AuditLog.create({
        user: req.user.id as any,
        tenant: req.user.tenant as any,
        action: 'LOGOUT',
        module: 'AUTH',
        details: `User ${req.user.email} logged out`,
        ipAddress: req.ip
      });
    }
    
    const clearOptions: CookieOptions = {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      path: '/',
    };
    res.clearCookie('token', clearOptions);
    res.clearCookie('refresh_token', clearOptions);
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    logger.error('Logout Error: %s', (err as Error).message);
    res.status(500).json({ error: 'Server error' });
  }
}
