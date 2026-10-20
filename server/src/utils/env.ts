import path from 'path';
import dotenv from 'dotenv';
import logger from './logger';

// Load .env relative to the server project root (works when running node with different cwd)
const envPath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: envPath });

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

  // Check optional services cleanly without false warnings for unused providers
  const unconfiguredServices: string[] = [];
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS || process.env.SMTP_PASS === 'none') unconfiguredServices.push('Email/SMTP');
  if (!process.env.WA_PHONE_NUMBER_ID && !process.env.TWILIO_ACCOUNT_SID) unconfiguredServices.push('WhatsApp');
  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'none') unconfiguredServices.push('Gemini AI');

  if (unconfiguredServices.length > 0) {
    logger.info('ℹ️ Optional service integrations not active: %s', unconfiguredServices.join(', '));
  }

  if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) {
    throw new Error('CRITICAL: ADMIN_EMAIL and ADMIN_PASSWORD must be defined.');
  }

  // Report feature availability
  const smtpUser = process.env.SMTP_USER?.trim() || '';
  const smtpPass = process.env.SMTP_PASS?.trim() || '';
  const smtpLooksPlaceholder = !smtpUser || !smtpPass
    || smtpUser.includes('your-') || smtpPass.includes('your-')
    || smtpUser.includes('example.com');
  const emailActive = !smtpLooksPlaceholder;
  if (smtpUser && smtpLooksPlaceholder) {
    logger.warn('⚠️ SMTP_USER/SMTP_PASS look like placeholder values — replace with real Gmail + App Password');
  }
  if (process.env.FRONTEND_URL?.includes('your-frontend')) {
    logger.warn('⚠️ FRONTEND_URL is still a placeholder — set your real Render frontend URL');
  }
  const waTwilioActive = !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_WHATSAPP_FROM);
  const waMetaActive = !!(process.env.WA_PHONE_NUMBER_ID && process.env.WA_ACCESS_TOKEN);
  logger.info(
    '📧 Email notifications: %s | 📱 WhatsApp: %s',
    emailActive ? 'ACTIVE' : 'DISABLED',
    waMetaActive ? 'ACTIVE (Meta Cloud API)' : (waTwilioActive ? 'ACTIVE (Twilio)' : 'SIMULATED')
  );
}
