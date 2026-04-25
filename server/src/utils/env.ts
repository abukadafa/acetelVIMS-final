import dotenv from 'dotenv';
import logger from './logger';

dotenv.config();

const REQUIRED_ENV_VARS = [
  'MONGO_URI',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'FRONTEND_URL',
  'COOKIE_SECRET',
  'ADMIN_EMAIL',
  'ADMIN_PASSWORD',
  'NODE_ENV',
];

const OPTIONAL_ENV_VARS = [
  'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS',         // Email
  'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_WHATSAPP_FROM', // WhatsApp
  'GEMINI_API_KEY',                                             // AI
];

export function validateEnv() {
  const missing = REQUIRED_ENV_VARS.filter(v => !process.env[v]);

  if (missing.length > 0) {
    const errorMsg = `CRITICAL: Missing required environment variables: ${missing.join(', ')}`;
    logger.error(errorMsg);
    if (process.env.NODE_ENV === 'production') {
      throw new Error(errorMsg);
    } else {
      logger.warn('⚠️ Development mode: Continuing with missing variables.');
    }
  }

  const missingOptional = OPTIONAL_ENV_VARS.filter(v => !process.env[v]);
  if (missingOptional.length > 0) {
    logger.warn('ℹ️ Optional features disabled (missing ENV vars): %s', missingOptional.join(', '));
  }

  if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) {
    throw new Error('CRITICAL: ADMIN_EMAIL and ADMIN_PASSWORD must be defined.');
  }

  // Report feature availability
  const emailActive = !!(process.env.SMTP_USER && process.env.SMTP_PASS);
  const waActive = !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);
  logger.info('📧 Email notifications: %s | 📱 WhatsApp (Twilio): %s', emailActive ? 'ACTIVE' : 'SIMULATED', waActive ? 'ACTIVE' : 'SIMULATED');
}
