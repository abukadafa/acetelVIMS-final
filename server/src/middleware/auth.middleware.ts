import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import logger from '../utils/logger';

// Extend Express Request — preserves all standard properties (body, query, params, ip, cookies, files, etc.)
export interface AuthRequest extends Request {
  user?: {
    id: string;
    role: string;
    email: string;
    programme?: string;
    tenant?: string;
  };
}

export function authenticate(req: AuthRequest, res: Response, next: NextFunction): void {
  let token = req.cookies?.token;

  if (!token) {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }
  }

  if (!token) {
    logger.warn('Auth Failure: No token provided from IP %s', req.ip);
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const secret = process.env.JWT_SECRET || 'acetel_vims_default_secure_secret_2024';
  const refreshSecret = process.env.JWT_REFRESH_SECRET || 'acetel_vims_default_refresh_secret_2024';

  if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
    logger.error('CRITICAL: JWT_SECRET environment variable is not defined in production!');
  }

  try {
    const decoded = jwt.verify(token, secret) as {
      id: string; role: string; email: string; programme?: string; tenant?: string;
    };
    req.user = decoded;
    next();
  } catch (err) {
    logger.error('Auth Failure: Invalid token from IP %s. Error: %s', req.ip, (err as Error).message);
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function authorize(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      logger.warn(
        'Access Denied: User %s (Role: %s) tried to access %s without permissions',
        req.user?.email || 'Unknown',
        req.user?.role || 'None',
        req.originalUrl
      );
      res.status(403).json({ error: 'Access denied' });
      return;
    }
    next();
  };
}
