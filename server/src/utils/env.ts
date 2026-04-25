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
  'NODE_ENV'
];

/**
 * Validates that all critical environment variables are present.
 * Aligns with Blueprint: 2. ENVIRONMENT VARIABLE DESIGN
 */
export function validateEnv() {
  const missing = REQUIRED_ENV_VARS.filter(v => !process.env[v]);

  if (missing.length > 0) {
    const errorMsg = `CRITICAL: Missing required environment variables: ${missing.join(', ')}`;
    logger.error(errorMsg);
    
    // In production, we MUST fail fast to prevent silent configuration bugs
    if (process.env.NODE_ENV === 'production') {
      throw new Error(errorMsg);
    } else {
      logger.warn('⚠️ Development mode: Continuing with missing variables, but system may be unstable.');
    }
  }

  // Final check for Admin credentials - strictly required for authentication
  if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) {
    throw new Error('CRITICAL: ADMIN_EMAIL and ADMIN_PASSWORD must be defined for the Authentication System.');
  }
}
