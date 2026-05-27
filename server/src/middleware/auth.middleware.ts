import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import logger from '../utils/logger';

// Extend Express Request
export interface AuthRequest extends Request {
  user?: {
    id: string;
    role: string;
    email: string;
    programme?: string;
    tenant?: string;
  };
}

// ====================== PROTECT MIDDLEWARE ======================
export const protect = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const token = req.cookies?.token || req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: "Not authorized, no token" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    req.user = decoded;
    next();
  } catch (error) {
    logger.error('Auth error:', error);
    return res.status(401).json({ message: "Session expired or invalid token" });
  }
};

// ====================== AUTHORIZE MIDDLEWARE ======================
export const authorize = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: "You do not have permission to access this route" });
    }
    next();
  };
};

// ====================== AUTHENTICATE (Legacy Support) ======================
// Many routes use 'authenticate' instead of 'protect'
export const authenticate = protect;   // Alias for backward compatibility
