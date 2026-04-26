import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { login, register, refreshToken, getProfile, changePassword, logout, getCommsStatus } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware';
import { upload } from '../middleware/upload.middleware';

// 5 login attempts per 15 min per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many login attempts. Please wait 15 minutes before trying again.' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,   // only count failed attempts
});

// 3 registrations per hour per IP — prevents mass account creation
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: { error: 'Too many registration attempts from this IP.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// 3 password-change attempts per hour per user
const passwordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: { error: 'Too many password change attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const r = Router();

r.post('/login',           loginLimiter,    login);
r.post('/register',        registerLimiter, upload.single('avatar'), register);
r.post('/refresh',         refreshToken);
r.post('/logout',          authenticate, logout);
r.get('/profile',          authenticate, getProfile);
r.put('/change-password',  authenticate, passwordLimiter, changePassword);
r.get('/comms-status',     authenticate, getCommsStatus);

export default r;
