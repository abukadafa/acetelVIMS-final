import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import RefreshToken from '../models/RefreshToken.model';
import logger from '../utils/logger';

export interface TokenPayload {
  id: string;
  role: string;
  email: string;
  tenant: string;
  programme?: string;
}

/**
 * Generates Access and Refresh tokens for a user.
 * Aligns with Blueprint: 3. AUTHENTICATION SYSTEM
 */
export async function generateTokens(payload: TokenPayload, ipAddress: string, userAgent?: string) {
  const secret = process.env.JWT_SECRET;
  const refreshSecret = process.env.JWT_REFRESH_SECRET;

  if (!secret || !refreshSecret) {
    logger.error('CRITICAL: JWT secrets are missing in environment variables');
    throw new Error('Internal configuration error');
  }

  // Access Token (1 day expiry as per Blueprint)
  const access = jwt.sign(
    payload, 
    secret, 
    { expiresIn: '1d' }
  );

  // Refresh Token (7 days for session persistence)
  const refreshTokenString = crypto.randomBytes(40).toString('hex');
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  const refreshToken = new RefreshToken({
    user: payload.id,
    tenant: payload.tenant,
    token: refreshTokenString,
    expiresAt,
    ipAddress,
    userAgent
  });

  await refreshToken.save();

  return { access, refresh: refreshTokenString };
}

/**
 * Validates a JWT token.
 * Aligns with Blueprint: 4. AUTH MIDDLEWARE
 */
export function verifyToken(token: string): TokenPayload {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not configured');
  
  return jwt.verify(token, secret) as TokenPayload;
}
