import { Request, Response, NextFunction } from 'express';
import BlockedIP from '../models/BlockedIP.model';
import IPTracker from '../models/IPTracker.model';
import logger from '../utils/logger';

// ─── Thresholds ────────────────────────────────────────────────────────────
const THRESHOLDS = {
  BLOCK_ON_SCORE:    100,   // Auto-block when suspicion score exceeds this
  REQ_PER_1MIN:      120,   // >120 req/min from one IP  → high suspicion
  REQ_PER_5MIN:      400,   // >400 req/5min             → medium suspicion
  REQ_PER_15MIN:     800,   // >800 req/15min            → low suspicion
  FAILED_LOGINS:      10,   // >10 failed logins ever    → brute force signal
  CONSECUTIVE_404s:   20,   // >20 not-found hits        → scanner signal
};

// Points added per signal — combined score triggers the block
const SCORE_WEIGHTS = {
  REQ_PER_1MIN:      60,
  REQ_PER_5MIN:      30,
  REQ_PER_15MIN:     15,
  FAILED_LOGINS:     40,
  CONSECUTIVE_404s:  25,
};

// How long auto-blocks last (ms). Score-based escalation.
function blockDuration(score: number): number {
  if (score >= 200) return 7  * 24 * 60 * 60 * 1000;  // 7 days
  if (score >= 150) return 24 * 60 * 60 * 1000;        // 24 hours
  if (score >= 100) return 60 * 60 * 1000;             // 1 hour
  return                   15 * 60 * 1000;             // 15 minutes
}

// ─── In-memory cache for blocked IPs (avoids DB hit on every request) ──────
// Rebuilt from DB on startup and updated on every block/unblock
const blockedIPCache = new Set<string>();

export async function loadBlockedIPsIntoCache(): Promise<void> {
  try {
    const blocked = await BlockedIP.find({ isActive: true }).select('ip').lean();
    blockedIPCache.clear();
    blocked.forEach(b => blockedIPCache.add(b.ip));
    logger.info('🛡️  Firewall: loaded %d blocked IPs into memory cache', blockedIPCache.size);
  } catch (err) {
    logger.error('Firewall cache load error: %s', (err as Error).message);
  }
}

// ─── Main firewall middleware (runs on every request) ───────────────────────
export async function firewallMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const ip = (
    req.headers['x-forwarded-for'] as string ||
    req.headers['x-real-ip'] as string ||
    req.socket.remoteAddress ||
    'unknown'
  ).split(',')[0].trim();

  if (!ip || ip === 'unknown' || ip === '::1' || ip === '127.0.0.1') {
    return next(); // Never block localhost
  }

  // 1. Fast in-memory check (microseconds — no DB round trip)
  if (blockedIPCache.has(ip)) {
    logger.warn('🚫 Firewall: blocked IP attempt | %s | %s %s', ip, req.method, req.path);
    res.status(403).json({
      error: 'Your IP address has been blocked due to suspicious activity. Contact your administrator if this is a mistake.',
      code: 'IP_BLOCKED',
    });
    return;
  }

  // 2. Track this request (non-blocking — runs in background)
  trackRequest(ip, req).catch(err =>
    logger.error('Firewall trackRequest error: %s', err.message)
  );

  next();
}

// ─── Track request, update counters, compute score, block if needed ─────────
async function trackRequest(ip: string, req: Request): Promise<void> {
  try {
    const now = new Date();

    // Upsert IP tracker with atomic increments
    const tracker = await IPTracker.findOneAndUpdate(
      { ip },
      {
        $inc: {
          'windows.1m':  1,
          'windows.5m':  1,
          'windows.15m': 1,
          'windows.1h':  1,
          ...(req.path === '/api/auth/login' && res_was_401(req) ? { failedLogins: 1 } : {}),
          ...(isLikely404(req) ? { last404s: 1 } : {}),
        },
        $set: { lastSeen: now },
      },
      { upsert: true, new: true }
    );

    if (!tracker) return;

    // 3. Compute suspicion score
    let score = 0;
    const reasons: string[] = [];

    if (tracker.windows['1m']  > THRESHOLDS.REQ_PER_1MIN)   { score += SCORE_WEIGHTS.REQ_PER_1MIN;      reasons.push(`${tracker.windows['1m']} req/min`); }
    if (tracker.windows['5m']  > THRESHOLDS.REQ_PER_5MIN)   { score += SCORE_WEIGHTS.REQ_PER_5MIN;      reasons.push(`${tracker.windows['5m']} req/5min`); }
    if (tracker.windows['15m'] > THRESHOLDS.REQ_PER_15MIN)  { score += SCORE_WEIGHTS.REQ_PER_15MIN;     reasons.push(`${tracker.windows['15m']} req/15min`); }
    if (tracker.failedLogins   > THRESHOLDS.FAILED_LOGINS)  { score += SCORE_WEIGHTS.FAILED_LOGINS;     reasons.push(`${tracker.failedLogins} failed logins`); }
    if (tracker.last404s       > THRESHOLDS.CONSECUTIVE_404s){ score += SCORE_WEIGHTS.CONSECUTIVE_404s; reasons.push(`${tracker.last404s} 404 hits (scanner)`); }

    // Update score in tracker
    await IPTracker.updateOne({ ip }, { $set: { suspicionScore: score } });

    // 4. Auto-block if score crosses threshold
    if (score >= THRESHOLDS.BLOCK_ON_SCORE) {
      await autoBlockIP(ip, score, reasons.join(' | '));
    }
  } catch (err) {
    // Non-fatal — tracking failure should never break a real request
    logger.error('Firewall tracking error for %s: %s', ip, (err as Error).message);
  }
}

// ─── Auto-block an IP ───────────────────────────────────────────────────────
export async function autoBlockIP(ip: string, score: number, reason: string): Promise<void> {
  const now = new Date();
  const duration = blockDuration(score);
  const until = new Date(now.getTime() + duration);
  const durationLabel = duration >= 86400000 ? `${Math.round(duration/86400000)}d` :
                        duration >= 3600000  ? `${Math.round(duration/3600000)}h` :
                        `${Math.round(duration/60000)}m`;

  try {
    // Upsert block record
    await BlockedIP.findOneAndUpdate(
      { ip },
      {
        $set: {
          reason,
          blockedAt: now,
          blockedUntil: until,
          isActive: true,
          autoBlocked: true,
        },
        $inc: { requestCount: 1 },
        $setOnInsert: { firstSeen: now },
        $max: { lastSeen: now },
      },
      { upsert: true, new: true }
    );

    // Add to memory cache immediately
    blockedIPCache.add(ip);

    logger.warn('🚫 AUTO-BLOCK: %s | score=%d | duration=%s | reason: %s', ip, score, durationLabel, reason);
  } catch (err) {
    logger.error('autoBlockIP error for %s: %s', ip, (err as Error).message);
  }
}

// ─── Manual admin block/unblock ─────────────────────────────────────────────
export async function manualBlockIP(ip: string, reason: string, adminId: string, durationHours?: number): Promise<void> {
  const now = new Date();
  const until = durationHours ? new Date(now.getTime() + durationHours * 3600000) : undefined;

  await BlockedIP.findOneAndUpdate(
    { ip },
    {
      $set: {
        reason,
        blockedAt: now,
        blockedUntil: until,
        isActive: true,
        autoBlocked: false,
      },
      $setOnInsert: { firstSeen: now },
    },
    { upsert: true }
  );
  blockedIPCache.add(ip);
  logger.info('🔒 MANUAL BLOCK: %s by admin %s | reason: %s | until: %s', ip, adminId, reason, until || 'permanent');
}

export async function unblockIP(ip: string, adminId: string, reason: string): Promise<void> {
  await BlockedIP.findOneAndUpdate(
    { ip },
    {
      $set: {
        isActive: false,
        unblockedAt: new Date(),
        unblockedBy: adminId as any,
        unblockReason: reason,
      },
    }
  );
  blockedIPCache.delete(ip);
  // Also reset tracker so they get a clean slate
  await IPTracker.findOneAndUpdate({ ip }, { $set: { suspicionScore: 0, failedLogins: 0, last404s: 0, 'windows.1m': 0, 'windows.5m': 0, 'windows.15m': 0, 'windows.1h': 0 } });
  logger.info('🔓 UNBLOCK: %s by admin %s | reason: %s', ip, adminId, reason);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
// We can't easily check the response code inside the request middleware,
// so we use path heuristics for 404 detection (scanner patterns)
function isLikely404(req: Request): boolean {
  const suspiciousPaths = [
    '/wp-admin', '/wp-login', '/.env', '/config', '/admin.php',
    '/phpmyadmin', '/.git', '/backup', '/shell', '/cgi-bin',
    '/xmlrpc', '/actuator', '/.aws', '/server-status',
  ];
  return suspiciousPaths.some(p => req.path.toLowerCase().includes(p));
}

// Heuristic: track login attempts (actual failure tracked in auth.controller)
function res_was_401(_req: Request): boolean {
  // This is approximate — actual failed login tracking is done in auth controller
  // via IPTracker.failedLogins increment on password mismatch
  return false; // Placeholder — real tracking done in controller
}
