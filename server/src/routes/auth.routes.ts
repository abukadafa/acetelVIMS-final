import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import {
  login, register, refreshToken, getProfile, changePassword, logout,
  getCommsStatus, testWhatsApp, whatsappWebhookVerify, whatsappWebhookReceive, updateProfile
} from '../controllers/auth.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { upload } from '../middleware/upload.middleware';

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many login attempts. Please try again in 15 minutes.',
});

const r = Router();

r.post('/login',           loginLimiter, login);
r.post('/register',        upload.single('avatar'), register);
r.post('/refresh',         refreshToken);
r.post('/logout',          authenticate, logout);
r.get('/profile',          authenticate, getProfile);
r.put('/profile',          authenticate, updateProfile);
r.put('/change-password',  authenticate, changePassword);

// Communications & WhatsApp
r.get('/comms-status',        authenticate, authorize('admin', 'ict_support'), getCommsStatus);
r.post('/test-whatsapp',      authenticate, authorize('admin', 'ict_support'), testWhatsApp);
r.get('/whatsapp/webhook',    whatsappWebhookVerify);
r.post('/whatsapp/webhook',   whatsappWebhookReceive);

export default r;
