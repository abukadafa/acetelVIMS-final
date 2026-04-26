import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const isDev = process.env.NODE_ENV !== 'production';

  // Log the full error internally — never expose to client
  logger.error('Unhandled error: %s | Path: %s %s | IP: %s',
    err.message, req.method, req.path, req.ip);

  if (isDev) {
    logger.error(err.stack);
  }

  // CORS errors
  if (err.message === 'Not allowed by CORS') {
    res.status(403).json({ error: 'CORS policy violation' });
    return;
  }

  // Mongoose validation errors
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors || {}).map((e: any) => e.message);
    res.status(400).json({ error: 'Validation failed', details: messages });
    return;
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    res.status(409).json({ error: `Duplicate value for ${field}` });
    return;
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }

  // Multer file errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    res.status(413).json({ error: 'File too large. Maximum size is 5MB.' });
    return;
  }

  if (err.message?.includes('Invalid file type')) {
    res.status(415).json({ error: err.message });
    return;
  }

  // Default — never expose internal details in production
  res.status(err.status || 500).json({
    error: isDev ? err.message : 'An unexpected error occurred. Please try again.',
    // Stack trace ONLY in development
    ...(isDev && { stack: err.stack }),
  });
}
