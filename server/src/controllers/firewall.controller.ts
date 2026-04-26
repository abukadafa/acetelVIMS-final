import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import BlockedIP from '../models/BlockedIP.model';
import IPTracker from '../models/IPTracker.model';
import { manualBlockIP, unblockIP } from '../middleware/firewall.middleware';
import { z } from 'zod';
import logger from '../utils/logger';

const blockSchema = z.object({
  ip: z.string().ip({ version: 'v4', message: 'Invalid IPv4 address' }),
  reason: z.string().min(5).max(300),
  durationHours: z.number().min(0).max(8760).optional(), // 0 = permanent, max 1 year
});

const unblockSchema = z.object({
  reason: z.string().min(3).max(300),
});

const ipParamSchema = z.object({
  ip: z.string().regex(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/, 'Invalid IP format'),
});

/** GET /api/admin/firewall/blocked — list all blocked IPs */
export async function listBlockedIPs(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { status = 'active', page = '1', limit = '50' } = req.query as any;
    const filter: any = {};
    if (status === 'active')   filter.isActive = true;
    if (status === 'expired')  filter.isActive = false;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, parseInt(limit));
    const skip = (pageNum - 1) * limitNum;

    const [blocked, total] = await Promise.all([
      BlockedIP.find(filter)
        .populate('unblockedBy', 'firstName lastName email')
        .sort({ blockedAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      BlockedIP.countDocuments(filter),
    ]);

    res.json({
      blocked,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
    });
  } catch (err) {
    logger.error('listBlockedIPs error: %s', (err as Error).message);
    res.status(500).json({ error: 'Server error' });
  }
}

/** GET /api/admin/firewall/suspects — top suspicious IPs not yet blocked */
export async function listSuspects(req: AuthRequest, res: Response): Promise<void> {
  try {
    const suspects = await IPTracker.find({ suspicionScore: { $gt: 0 } })
      .sort({ suspicionScore: -1 })
      .limit(100)
      .lean();

    const blockedIPs = new Set(
      (await BlockedIP.find({ isActive: true }).distinct('ip'))
    );

    res.json({
      suspects: suspects.map(s => ({
        ...s,
        isBlocked: blockedIPs.has(s.ip),
      })),
    });
  } catch (err) {
    logger.error('listSuspects error: %s', (err as Error).message);
    res.status(500).json({ error: 'Server error' });
  }
}

/** POST /api/admin/firewall/block — manually block an IP */
export async function blockIP(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { ip, reason, durationHours } = blockSchema.parse(req.body);

    // Protect server's own IP and localhost
    if (['127.0.0.1', '::1', '0.0.0.0'].includes(ip)) {
      res.status(400).json({ error: 'Cannot block localhost or internal addresses' });
      return;
    }

    await manualBlockIP(ip, reason, req.user!.id, durationHours);

    logger.warn('Manual block: %s | admin: %s | reason: %s', ip, req.user!.email, reason);
    res.json({
      message: `IP ${ip} has been blocked${durationHours ? ` for ${durationHours} hours` : ' permanently'}.`,
    });
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: 'Validation failed', details: err.errors }); return; }
    logger.error('blockIP error: %s', (err as Error).message);
    res.status(500).json({ error: 'Server error' });
  }
}

/** DELETE /api/admin/firewall/block/:ip — unblock an IP */
export async function unblockIPHandler(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { ip } = ipParamSchema.parse(req.params);
    const { reason } = unblockSchema.parse(req.body);

    const existing = await BlockedIP.findOne({ ip });
    if (!existing) {
      res.status(404).json({ error: 'IP not found in block list' });
      return;
    }

    await unblockIP(ip, req.user!.id, reason);

    logger.info('Manual unblock: %s | admin: %s | reason: %s', ip, req.user!.email, reason);
    res.json({ message: `IP ${ip} has been unblocked.` });
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: 'Validation failed', details: err.errors }); return; }
    logger.error('unblockIP error: %s', (err as Error).message);
    res.status(500).json({ error: 'Server error' });
  }
}

/** GET /api/admin/firewall/stats — summary stats */
export async function firewallStats(req: AuthRequest, res: Response): Promise<void> {
  try {
    const [
      totalBlocked,
      activeBlocked,
      autoBlocked,
      manualBlocked,
      highSuspicion,
    ] = await Promise.all([
      BlockedIP.countDocuments(),
      BlockedIP.countDocuments({ isActive: true }),
      BlockedIP.countDocuments({ isActive: true, autoBlocked: true }),
      BlockedIP.countDocuments({ isActive: true, autoBlocked: false }),
      IPTracker.countDocuments({ suspicionScore: { $gte: 50 } }),
    ]);

    const recentBlocks = await BlockedIP.find({ isActive: true })
      .sort({ blockedAt: -1 })
      .limit(5)
      .select('ip reason blockedAt autoBlocked')
      .lean();

    res.json({
      totalBlocked,
      activeBlocked,
      autoBlocked,
      manualBlocked,
      highSuspicion,
      recentBlocks,
    });
  } catch (err) {
    logger.error('firewallStats error: %s', (err as Error).message);
    res.status(500).json({ error: 'Server error' });
  }
}
