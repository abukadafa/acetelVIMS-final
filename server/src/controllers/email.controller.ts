import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import User from '../models/User.model';
import Student from '../models/Student.model';
import Programme from '../models/Programme.model';
import EmailRecord from '../models/EmailRecord.model';
import { sendEmail } from '../utils/mail.service';
import { z } from 'zod';
import logger from '../utils/logger';

const STAFF_ROLES = ['admin', 'prog_coordinator', 'internship_coordinator', 'supervisor', 'ict_support'];

const BASE_STYLE = `font-family:'Segoe UI',Arial,sans-serif;background:#f4f6f9;margin:0;padding:0;`;
const CARD = `max-width:600px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);`;
const HEADER = `<div style="background:linear-gradient(135deg,#0a5c36 0%,#147a4a 100%);padding:28px 40px;"><h1 style="color:#fff;margin:0;font-size:20px;">ACETEL IMS</h1></div>`;
const FOOTER = `<div style="background:#f9fafb;padding:16px 40px;text-align:center;border-top:1px solid #eee;"><p style="color:#999;font-size:11px;margin:0;">© ${new Date().getFullYear()} ACETEL Virtual Internship Management System · NOUN</p></div>`;

function buildHtml(senderName: string, body: string): string {
  const bodyHtml = body
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');
  return `<html><body style="${BASE_STYLE}"><div style="${CARD}">${HEADER}<div style="padding:28px 40px;"><p style="margin:0 0 16px;color:#555;font-size:13px;">From: <strong>${senderName}</strong></p><div style="font-size:15px;line-height:1.7;color:#1a1a1a;">${bodyHtml}</div></div>${FOOTER}</div></body></html>`;
}

const composeSchema = z.object({
  subject: z.string().min(1).max(300),
  body: z.string().min(1).max(10000),
  recipientScope: z.enum(['individual', 'all_students', 'all_staff', 'programme', 'custom']),
  recipientIds: z.array(z.string().regex(/^[0-9a-fA-F]{24}$/)).optional(),
  programmeId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
});

/** POST /api/email/compose — all authenticated users can send email */
export async function composeEmail(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { subject, body, recipientScope, recipientIds, programmeId } = composeSchema.parse(req.body);
    const tenantId = req.user!.tenant;
    const userRole = req.user!.role;
    const isStaff = STAFF_ROLES.includes(userRole);

    const sender = await User.findById(req.user!.id).select('firstName lastName email');
    if (!sender) { res.status(404).json({ error: 'Sender not found' }); return; }
    const senderName = `${sender.firstName} ${sender.lastName}`;
    const html = buildHtml(senderName, body);

    // Students can ONLY send to individual contacts (their supervisor/coordinator)
    // They cannot broadcast to all_students / all_staff / programme
    if (!isStaff && ['all_students', 'all_staff', 'programme'].includes(recipientScope)) {
      res.status(403).json({ error: 'Students can only send emails to individual contacts' });
      return;
    }

    let recipientUsers: { _id: any; email: string; firstName: string; lastName: string; }[] = [];

    if (recipientScope === 'all_students') {
      const students = await User.find({ tenant: tenantId, role: 'student', isActive: true }).select('email firstName lastName');
      recipientUsers = students as any[];
    } else if (recipientScope === 'all_staff') {
      const staff = await User.find({ tenant: tenantId, role: { $in: STAFF_ROLES }, isActive: true }).select('email firstName lastName');
      recipientUsers = staff as any[];
    } else if (recipientScope === 'programme' && programmeId) {
      const students = await Student.find({ programme: programmeId, tenant: tenantId }).populate('user', 'email firstName lastName');
      recipientUsers = students.map(s => s.user as any).filter(Boolean);
    } else if ((recipientScope === 'individual' || recipientScope === 'custom') && recipientIds?.length) {
      // For students: validate they can only email staff or their own supervisor
      let allowedIds = recipientIds;
      if (!isStaff) {
        const studentRecord = await Student.findOne({ user: req.user!.id, tenant: tenantId });
        const allowedUsers = await User.find({
          tenant: tenantId,
          isActive: true,
          $or: [
            { role: { $in: ['admin', 'prog_coordinator', 'internship_coordinator', 'ict_support'] } },
            { _id: studentRecord?.supervisor },
          ],
        }).select('_id');
        const allowedSet = new Set(allowedUsers.map(u => u._id.toString()));
        allowedIds = recipientIds.filter(id => allowedSet.has(id));
        if (allowedIds.length === 0) {
          res.status(403).json({ error: 'You can only email your supervisor or institutional coordinators' });
          return;
        }
      }
      const users = await User.find({ _id: { $in: allowedIds }, tenant: tenantId, isActive: true }).select('email firstName lastName');
      recipientUsers = users as any[];
    }

    if (recipientUsers.length === 0) {
      res.status(400).json({ error: 'No valid recipients found' });
      return;
    }

    const record = await EmailRecord.create({
      tenant: tenantId,
      sender: req.user!.id,
      subject,
      body,
      bodyHtml: html,
      recipientScope,
      programme: programmeId,
      recipients: recipientUsers.map(u => ({ userId: u._id, email: u.email, name: `${u.firstName} ${u.lastName}` })),
      sentCount: 0,
      failedCount: 0,
      status: 'sending',
    });

    let sent = 0;
    let failed = 0;
    const isLarge = recipientUsers.length > 20;

    if (isLarge) {
      res.status(202).json({
        message: `Sending to ${recipientUsers.length} recipients in the background. Check Email History for delivery status.`,
        emailId: record._id,
        recipientCount: recipientUsers.length,
      });
    }

    for (const user of recipientUsers) {
      const ok = await sendEmail(user.email, subject, html);
      if (ok) sent++; else failed++;
    }

    await EmailRecord.findByIdAndUpdate(record._id, {
      sentCount: sent,
      failedCount: failed,
      status: failed === 0 ? 'sent' : sent === 0 ? 'failed' : 'partial',
    });

    if (!isLarge) {
      res.status(200).json({
        message: `Email sent to ${sent} recipient${sent !== 1 ? 's' : ''}${failed > 0 ? ` (${failed} failed)` : ''}.`,
        emailId: record._id,
        sentCount: sent,
        failedCount: failed,
      });
    }
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: 'Validation failed', details: err.errors }); return; }
    logger.error('Email compose error: %s', (err as Error).message);
    res.status(500).json({ error: 'Server error' });
  }
}

/** GET /api/email/history — all users see their own sent emails; staff see all */
export async function getEmailHistory(req: AuthRequest, res: Response): Promise<void> {
  try {
    const tenantId = req.user!.tenant;
    const isStaff = STAFF_ROLES.includes(req.user!.role);
    const filter: any = { tenant: tenantId };
    if (!isStaff) filter.sender = req.user!.id;

    const emails = await EmailRecord.find(filter)
      .populate('sender', 'firstName lastName role')
      .populate('programme', 'name')
      .sort({ createdAt: -1 })
      .limit(100);

    res.json({ emails });
  } catch (err) {
    logger.error('Email history error: %s', (err as Error).message);
    res.status(500).json({ error: 'Server error' });
  }
}

/** GET /api/email/contacts — scoped by role */
export async function getEmailContacts(req: AuthRequest, res: Response): Promise<void> {
  try {
    const tenantId = req.user!.tenant;
    const userRole = req.user!.role;
    const isStaff = STAFF_ROLES.includes(userRole);

    let userFilter: any = { tenant: tenantId, isActive: true, _id: { $ne: req.user!.id } };

    if (!isStaff) {
      // Students can only contact staff + their own supervisor
      const studentRecord = await Student.findOne({ user: req.user!.id, tenant: tenantId });
      userFilter.$or = [
        { role: { $in: ['admin', 'prog_coordinator', 'internship_coordinator', 'ict_support', 'supervisor'] } },
        ...(studentRecord?.supervisor ? [{ _id: studentRecord.supervisor }] : []),
      ];
    }

    const users = await User.find(userFilter)
      .select('firstName lastName email role')
      .sort({ role: 1, firstName: 1 });

    const programmes = isStaff
      ? await Programme.find({ tenant: tenantId, isActive: true }).select('name code')
      : [];

    res.json({ users, programmes });
  } catch (err) {
    logger.error('Email contacts error: %s', (err as Error).message);
    res.status(500).json({ error: 'Server error' });
  }
}
