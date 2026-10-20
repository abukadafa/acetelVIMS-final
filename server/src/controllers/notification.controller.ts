import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import NotificationModel from '../models/notification.model';
import User from '../models/User.model';
import { sendEmail } from '../utils/mail.service';
import { sendWhatsAppMessage } from '../utils/whatsapp.service';
import logger from '../utils/logger';
import { io } from '../index';

import mongoose from 'mongoose';
import { getDefaultTenantId } from '../utils/tenant.util';

export async function getNotifications(req: AuthRequest, res: Response): Promise<void> {
  try {
    const tenantId = req.user?.tenant || (await getDefaultTenantId().catch(() => undefined));
    const filter: any = { user: req.user!.id };
    if (tenantId) filter.tenant = tenantId;

    const notifications = await NotificationModel.find(filter)
      .sort({ createdAt: -1 }).limit(100);
    const unreadCount = await NotificationModel.countDocuments({ ...filter, isRead: false });
    res.json({ notifications: notifications || [], unreadCount });
  } catch (err) {
    logger.error('getNotifications: %s', (err as Error).message);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function markRead(req: AuthRequest, res: Response): Promise<void> {
  try {
    const tenantId = req.user?.tenant || (await getDefaultTenantId().catch(() => undefined));
    await NotificationModel.findOneAndUpdate(
      { _id: req.params.id, user: req.user!.id, ...(tenantId ? { tenant: tenantId } : {}) },
      { isRead: true, readAt: new Date() }
    );
    res.json({ message: 'Marked as read' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
}

export async function markAllRead(req: AuthRequest, res: Response): Promise<void> {
  try {
    const tenantId = req.user?.tenant || (await getDefaultTenantId().catch(() => undefined));
    await NotificationModel.updateMany(
      { user: req.user!.id, ...(tenantId ? { tenant: tenantId } : {}), isRead: false },
      { isRead: true, readAt: new Date() }
    );
    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
}

export async function sendNotification(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { recipientId, subject, body, channel } = req.body;
    if (!body?.trim()) { res.status(400).json({ error: 'Message body is required' }); return; }

    const tenantId = req.user?.tenant || (await getDefaultTenantId().catch(() => undefined));
    const senderName = req.user?.email || 'System';

    // Determine recipients
    let recipients: any[] = [];
    if (recipientId && recipientId !== 'all' && recipientId !== 'broadcast' && mongoose.Types.ObjectId.isValid(String(recipientId))) {
      const u = await User.findOne({ _id: recipientId, ...(tenantId ? { tenant: tenantId } : {}), isActive: true });
      if (!u) { res.status(404).json({ error: 'Recipient not found' }); return; }
      recipients = [u];
    } else {
      // Broadcast to all active users in tenant
      recipients = await User.find({ ...(tenantId ? { tenant: tenantId } : {}), isActive: true });
    }

    const appUrl = process.env.FRONTEND_URL || 'https://acetel-vims.onrender.com';
    let sent = 0;

    for (const recipient of recipients) {
      const notifBody = `${senderName}: ${body}`;
      const baseTitle = subject || `Message from ${senderName}`;

      if (channel === 'in-app' || !channel) {
        const created = await NotificationModel.create({
          ...(tenantId ? { tenant: tenantId } : {}),
          user: recipient._id,
          title: baseTitle,
          message: notifBody,
          type: 'info',
          channel: 'in-app',
          link: '/communication',
        });
        io.to(`user:${recipient._id}`).emit('notification', {
          _id: created._id,
          title: created.title,
          message: created.message,
          channel: created.channel,
          link: created.link,
        });
        sent++;
      }

      if (channel === 'email') {
        const html = `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px;">
            <h2 style="color:#166534;">Message from ${senderName}</h2>
            ${subject ? `<p><strong>Subject:</strong> ${subject}</p>` : ''}
            <div style="background:#f0fdf4;border:1.5px solid #bbf7d0;border-radius:10px;padding:20px;margin:16px 0;">
              <p style="margin:0;color:#111827;line-height:1.7;">${body}</p>
            </div>
            <a href="${appUrl}" style="display:inline-block;padding:12px 24px;background:#166534;color:#fff;border-radius:8px;text-decoration:none;font-weight:700;">
              Open ACETEL VIMS
            </a>
          </div>`;
        try {
          await sendEmail(recipient.email, subject || `Message from ${senderName}`, html);
        } catch (e: any) {
          logger.warn('sendEmail error in sendNotification: %s', e.message);
        }
        const created = await NotificationModel.create({
          ...(tenantId ? { tenant: tenantId } : {}),
          user: recipient._id,
          title: subject || `Email from ${senderName}`,
          message: notifBody,
          type: 'info',
          channel: 'email',
          link: '/communication',
        });
        io.to(`user:${recipient._id}`).emit('notification', {
          _id: created._id,
          title: created.title,
          message: created.message,
          channel: created.channel,
          link: created.link,
        });
        sent++;
      }

      if (channel === 'whatsapp' && recipient.phone) {
        const msg = `*ACETEL VIMS Message*\n\nFrom: ${senderName}\n\n${body}\n\n${appUrl}`;
        try {
          await sendWhatsAppMessage(recipient.phone, msg);
        } catch (e: any) {
          logger.warn('sendWhatsAppMessage error in sendNotification: %s', e.message);
        }
        const created = await NotificationModel.create({
          ...(tenantId ? { tenant: tenantId } : {}),
          user: recipient._id,
          title: subject || `WhatsApp from ${senderName}`,
          message: notifBody,
          type: 'info',
          channel: 'whatsapp',
          link: '/communication',
        });
        io.to(`user:${recipient._id}`).emit('notification', {
          _id: created._id,
          title: created.title,
          message: created.message,
          channel: created.channel,
          link: created.link,
        });
        sent++;
      }
    }

    res.json({ message: `Message sent to ${sent} recipient(s)` });
  } catch (err) {
    logger.error('sendNotification: %s', (err as Error).message);
    res.status(500).json({ error: 'Server error' });
  }
}
