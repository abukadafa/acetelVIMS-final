import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { login, register, refreshToken, getProfile, changePassword, logout } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware';
import { upload } from '../middleware/upload.middleware';

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 5,
  message: 'Institutional Security: Too many failed login attempts.'
});

const r = Router();

r.post('/login', loginLimiter, login);
r.post('/register', upload.single('avatar'), register);
r.post('/refresh', refreshToken);
r.post('/logout', authenticate, logout);
r.get('/profile', authenticate, getProfile);
r.put('/change-password', authenticate, changePassword);
export default r;
