import logger from './logger';

const REQUIRED_ENV_VARS = [
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'FRONTEND_URL',
  'COOKIE_SECRET',
  'ADMIN_EMAIL',
  'ADMIN_PASSWORD',
  'NODE_ENV'
];

export function validateEnv() {
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

  if (!process.env.GEMINI_API_KEY) {
    logger.warn('⚠️ GEMINI_API_KEY is missing. AI features will be disabled but the server will continue to run.');
  }

  // Check for weak secrets in production
  if (process.env.NODE_ENV === 'production') {
    if (process.env.JWT_SECRET === 'secret' || 
        process.env.JWT_SECRET === 'acetel_ims_secure_secret_2024' ||
        process.env.JWT_REFRESH_SECRET === 'refresh') {
      logger.error('CRITICAL: Weak or default JWT secrets detected in production!');
      process.exit(1);
    }
  }
}
