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

    const dbUser = await User.findById(userId).select('tenant programme role email isActive isDeleted');
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

export const authenticate = protect;
