import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import Notification from '../models/notification.model';
import { z } from 'zod';

const idParamSchema = z.object({
  id: z.string().or(z.literal('all')).refine(val => {
    if (val === 'all') return true;
    return /^[0-9a-fA-F]{24}$/.test(val);
  }, 'Invalid ID format')
});

export async function getNotifications(req: AuthRequest, res: Response): Promise<void> {
  try {
    const tenantId = req.user!.tenant;
    const notifications = await Notification.find({ user: req.user!.id, tenant: tenantId })
      .sort({ createdAt: -1 })
      .limit(50);
    
    const unreadCount = await Notification.countDocuments({ 
      user: req.user!.id, 
      tenant: tenantId,
      isRead: false 
    });
    
    res.json({ notifications, unreadCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function markAsRead(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = idParamSchema.parse(req.params);
    const tenantId = req.user!.tenant;

    if (id === 'all') {
      await Notification.updateMany(
        { user: req.user!.id, tenant: tenantId }, 
        { $set: { isRead: true } }
      );
    } else {
      await Notification.findOneAndUpdate(
        { _id: id, user: req.user!.id, tenant: tenantId },
        { $set: { isRead: true } }
      );
    }
    res.json({ message: 'Marked as read' });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function deleteNotification(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = idParamSchema.parse(req.params);
    const tenantId = req.user!.tenant;

    await Notification.findOneAndDelete({ 
      _id: id, 
      user: req.user!.id,
      tenant: tenantId
    });
    res.json({ message: 'Deleted' });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}
