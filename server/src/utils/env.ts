import logger from './logger';

const REQUIRED_ENV_VARS = [
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'MONGO_URI',
  'FRONTEND_URL',
  'COOKIE_SECRET'
];

export function validateEnv() {
  const missing = REQUIRED_ENV_VARS.filter(key => !process.env[key]);

  if (missing.length > 0) {
    logger.error('CRITICAL: Missing required environment variables: %s', missing.join(', '));
    if (process.env.NODE_ENV === 'production') {
      logger.error('Server cannot start without these variables in production.');
      process.exit(1);
    } else {
      logger.warn('Server is running in development mode with missing variables. This may cause issues.');
    }
  }

  // Check for weak secrets in production
  if (process.env.NODE_ENV === 'production') {
    if (process.env.JWT_SECRET === 'secret' || process.env.JWT_REFRESH_SECRET === 'refresh') {
      logger.error('CRITICAL: Weak JWT secrets detected in production!');
      process.exit(1);
    }
  }
}
