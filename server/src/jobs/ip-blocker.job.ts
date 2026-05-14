import IPTracker from '../models/IPTracker.model';
import BlockedIP from '../models/BlockedIP.model';
import { autoBlockIP, loadBlockedIPsIntoCache } from '../middleware/firewall.middleware';
import logger from '../utils/logger';

const JOB_NAME = 'IP_BLOCKER';

// ─── Thresholds for the batch analysis job ───────────────────────────────────
// These catch persistent low-and-slow attackers that slip under per-minute limits
const BATCH_THRESHOLDS = {
  SCORE_AUTO_BLOCK:    80,   // Score >= 80 = auto-block
  REQ_PER_HOUR:      1000,   // >1000 req/hr sustained = very high suspicion
  FAILED_LOGIN_HOUR:   15,   // >15 failed logins in tracker lifetime = brute force
  SCANNER_404s:        30,   // >30 scanner paths hit = active recon
};

export async function runIPBlockerJob(): Promise<void> {
  logger.info('🛡️  IP Blocker Job: scanning for threats...');
  const startTime = Date.now();

  try {
    let blocked = 0;
    let expired = 0;

    // ── 1. Expire temporary blocks whose time has passed ─────────────────────
    const expiredBlocks = await BlockedIP.updateMany(
      {
        isActive: true,
        blockedUntil: { $lte: new Date() },
        autoBlocked: true,    // Only auto-expire automatic blocks; manual stays until admin removes
      },
      { $set: { isActive: false, unblockReason: 'Automatic expiry after duration elapsed' } }
    );
    expired = expiredBlocks.modifiedCount;

    // ── 2. Reload cache if any blocks expired ────────────────────────────────
    if (expired > 0) {
      await loadBlockedIPsIntoCache();
      logger.info('🛡️  IP Blocker: expired %d temporary blocks', expired);
    }

    // ── 3. Find high-suspicion IPs not yet blocked ───────────────────────────
    const suspects = await IPTracker.find({
      suspicionScore: { $gte: BATCH_THRESHOLDS.SCORE_AUTO_BLOCK },
      ip: {
        // Exclude already-blocked IPs
        $nin: (await BlockedIP.find({ isActive: true }).distinct('ip')),
      },
    }).lean();

    for (const suspect of suspects) {
      const reasons: string[] = [];

      if (suspect.suspicionScore >= BATCH_THRESHOLDS.SCORE_AUTO_BLOCK) {
        reasons.push(`suspicion score ${suspect.suspicionScore}`);
      }
      if (suspect.windows['1h'] > BATCH_THRESHOLDS.REQ_PER_HOUR) {
        reasons.push(`${suspect.windows['1h']} req/hr`);
      }
      if (suspect.failedLogins > BATCH_THRESHOLDS.FAILED_LOGIN_HOUR) {
        reasons.push(`${suspect.failedLogins} failed logins`);
      }
      if (suspect.last404s > BATCH_THRESHOLDS.SCANNER_404s) {
        reasons.push(`${suspect.last404s} scanner hits`);
      }

      if (reasons.length > 0) {
        await autoBlockIP(suspect.ip, suspect.suspicionScore, `[Batch job] ${reasons.join(' | ')}`);
        blocked++;
      }
    }

    // ── 4. Reset sliding window counters (1m, 5m, 15m windows) ──────────────
    // The 1h counter resets once per job run (every 5 minutes is not 1h — good enough)
    await IPTracker.updateMany(
      {},
      { $set: { 'windows.1m': 0, 'windows.5m': 0, 'windows.15m': 0 } }
    );

    const duration = Date.now() - startTime;
    logger.info(
      '🛡️  IP Blocker Job done in %dms | blocked: %d | expired: %d | suspects checked: %d',
      duration, blocked, expired, suspects.length
    );
  } catch (err) {
    logger.error('❌ IP Blocker Job error: %s', (err as Error).message);
  }
}

// ─── Schedule ─────────────────────────────────────────────────────────────────
export function startIPBlockerSchedule(): void {
  const INTERVAL_MS = 5 * 60 * 1000; // Every 5 minutes

  // Run once 30s after startup to let DB settle
  setTimeout(async () => {
    await loadBlockedIPsIntoCache();
    await runIPBlockerJob();
  }, 30000);

  setInterval(runIPBlockerJob, INTERVAL_MS);
  logger.info('🛡️  IP Blocker Job scheduled every 5 minutes');
}
