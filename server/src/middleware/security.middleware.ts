import { Request, Response, NextFunction } from 'express';

/**
 * Additional security headers not covered by helmet,
 * plus request sanitisation helpers.
 */
export function securityHeaders(req: Request, res: Response, next: NextFunction) {
  // Prevent MIME sniffing attacks
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  // Legacy XSS filter (IE)
  res.setHeader('X-XSS-Protection', '1; mode=block');
  // Remove server fingerprint
  res.removeHeader('X-Powered-By');
  // Permissions policy — restrict sensitive browser APIs
  res.setHeader('Permissions-Policy',
    'camera=(), microphone=(), geolocation=(self), payment=(), usb=()');
  next();
}

/**
 * Sanitise string inputs — strip null bytes, trim excessive whitespace.
 * Applied to req.body, req.query, req.params recursively.
 */
export function sanitiseInput(req: Request, res: Response, next: NextFunction) {
  function clean(obj: any): any {
    if (typeof obj === 'string') {
      // Strip null bytes (can bypass filters)
      return obj.replace(/\0/g, '').trimEnd();
    }
    if (Array.isArray(obj)) return obj.map(clean);
    if (obj && typeof obj === 'object') {
      const result: any = {};
      for (const key of Object.keys(obj)) {
        // Strip keys that start with $ (NoSQL injection)
        if (key.startsWith('$') || key.includes('.')) continue;
        result[key] = clean(obj[key]);
      }
      return result;
    }
    return obj;
  }

  if (req.body)   req.body   = clean(req.body);
  if (req.query)  req.query  = clean(req.query) as any;
  if (req.params) req.params = clean(req.params);
  next();
}
