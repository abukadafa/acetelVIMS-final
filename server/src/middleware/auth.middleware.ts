import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import User from '../models/User.model';
import logger from '../utils/logger';
import { resolveUserTenantId } from '../utils/tenant.util';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    role: string;
    email: string;
    programme?: string;
    tenant?: string;
    permissions: string[];
  };
}

export const protect = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const token = req.cookies?.token || req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return res.status(500).json({ error: 'Server misconfigured — contact administrator' });
    }

    let decoded: { id?: string; sub?: string; role?: string; email?: string; programme?: string; tenant?: string };
    try {
      decoded = jwt.verify(token, secret) as typeof decoded;
    } catch (error: any) {
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Session expired — please log in again' });
      }
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    const userId = decoded.id || decoded.sub;
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(401).json({ error: 'Invalid session — please log in again' });
    }

    const dbUser = await User.findById(userId).select('tenant programme role email isActive isDeleted permissions');
    if (!dbUser || !dbUser.isActive || dbUser.isDeleted) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const tenantId = await resolveUserTenantId(dbUser);

    req.user = {
      id: dbUser._id.toString(),
      role: dbUser.role,
      email: dbUser.email,
      tenant: tenantId,
      programme: dbUser.programme?.toString() || decoded.programme,
      permissions: dbUser.role === 'admin' ? [] : (dbUser.permissions || []),
    };
    next();
  } catch (error: any) {
    logger.error('Auth error: %s', error.message);
    return res.status(401).json({ error: 'Authentication failed' });
  }
};

export const authorize = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    next();
  };
};

/** True if the user is an admin (implicit all-access) or holds the given permission explicitly. */
export function hasPermission(user: AuthRequest['user'], permission: string): boolean {
  if (!user) return false;
  if (user.role === 'admin') return true;
  return (user.permissions || []).includes(permission);
}

/** True if the user holds any of the given permissions (or is admin). */
export function hasAnyPermission(user: AuthRequest['user'], permissions: string[]): boolean {
  if (!user) return false;
  if (user.role === 'admin') return true;
  return permissions.some((p) => (user.permissions || []).includes(p));
}

/**
 * Route guard: allows the request through if the authenticated user is an
 * admin OR holds at least one of the listed permissions. Use this instead of
 * (or alongside) `authorize(...roles)` for anything whose access should be
 * governed by the granular permission grid rather than a fixed role list.
 */
export const requirePermission = (...permissions: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!hasAnyPermission(req.user, permissions)) {
      return res.status(403).json({ error: 'Access denied — you do not have permission to perform this action' });
    }
    next();
  };
};

export const authenticate = protect;
