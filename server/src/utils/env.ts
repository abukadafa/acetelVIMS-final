import logger from './logger';
import dotenv from 'dotenv';

const REQUIRED_ENV_VARS = [
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'FRONTEND_URL',
  'COOKIE_SECRET',
  'NODE_ENV'
];

export function validateEnv() {
  dotenv.config();
  const missing = REQUIRED_ENV_VARS.filter(key => !process.env[key]);

  if (!process.env.MONGO_URI && !process.env.MONGODB_URI) {
    missing.push('MONGO_URI or MONGODB_URI');
  }

  if (missing.length > 0) {
    const errorMsg = `CRITICAL: Missing required environment variables: ${missing.join(', ')}`;
    console.error(errorMsg);
    logger.error(errorMsg);
    
    // In production, we MUST exit if variables are missing
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  }

  // Warning for missing secondary variables
  if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) {
    logger.warn('⚠️ ADMIN_EMAIL or ADMIN_PASSWORD missing. Using default system credentials. THIS IS INSECURE FOR PRODUCTION.');
  }

  if (!process.env.GEMINI_API_KEY) {
    logger.warn('⚠️ GEMINI_API_KEY is missing. AI features will be disabled but the server will continue to run.');
  }

  // Check for weak secrets in production
  if (process.env.NODE_ENV === 'production') {
    const weakSecrets = ['secret', 'password', '123456', 'refresh'];
    if (weakSecrets.includes(process.env.JWT_SECRET || '') || 
        weakSecrets.includes(process.env.JWT_REFRESH_SECRET || '')) {
      logger.error('CRITICAL: Extremely weak JWT secrets detected in production!');
      process.exit(1);
    }
    
    // Warning for template secrets but don't crash
    if (process.env.JWT_SECRET === 'acetel_ims_secure_secret_2024') {
      logger.warn('⚠️ Using template JWT secret. Please change this in production for maximum security.');
    }
  }
}
