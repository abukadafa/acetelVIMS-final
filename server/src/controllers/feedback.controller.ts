import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import Feedback from '../models/Feedback.model';
import User from '../models/User.model';
import Student from '../models/Student.model';
import Notification from '../models/notification.model';
import { sendEmail, emailTemplates } from '../utils/mail.service';
import { sendWhatsAppMessage, whatsappTemplates } from '../utils/whatsapp.service';
import { io } from '../index';
import { z } from 'zod';
import logger from '../utils/logger';

const feedbackSchema = z.object({
  subject: z.string().min(3).max(200),
  category: z.enum(['Logbook', 'Placement', 'Technical', 'Support', 'Academic']),
  message: z.string().min(10).max(4000),
  priority: z.enum(['Low', 'Medium', 'High', 'Urgent']).default('Medium'),
});

const listFeedbackQuerySchema = z.object({
  status: z.enum(['Open', 'Assigned', 'Closed']).optional(),
  category: z.enum(['Logbook', 'Placement', 'Technical', 'Support', 'Academic']).optional(),
  priority: z.enum(['Low', 'Medium', 'High', 'Urgent']).optional(),
  search: z.string().optional(),
});

const responseSchema = z.object({
  message: z.string().min(1).max(4000),
});

const statusUpdateSchema = z.object({
  status: z.enum(['Open', 'Assigned', 'Closed']),
});

const ratingSchema = z.object({
  rating: z.number().min(1).max(5),
  comment: z.string().max(500).optional(),
});

const idParamSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID format'),
});

/** POST /api/feedback — Create new feedback */
export async function createFeedback(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { subject, category, message, priority } = feedbackSchema.parse(req.body);
    const tenantId = req.user!.tenant;

    let programmeId = undefined;
    if (req.user?.role === 'student') {
      const student = await Student.findOne({ user: req.user.id, tenant: tenantId });
      programmeId = student?.programme;
    }

    const feedback = await Feedback.create({
      user: req.user!.id,
      tenant: tenantId,
      subject,
      category,
      message,
      priority: priority || 'Medium',
      programme: programmeId,
      status: 'Open',
    });

    // Notify all admins and internship coordinators of new ticket
    const staff = await User.find({
      tenant: tenantId,
      role: { $in: ['admin', 'internship_coordinator', 'prog_coordinator'] },
      isActive: true,
    }).select('_id email');

    for (const s of staff) {
      await Notification.create({
        user: s._id,
        tenant: tenantId,
        title: `New Feedback Ticket: ${subject}`,
        message: `${category} ticket from a ${req.user!.role}. Priority: ${priority}`,
        type: 'info',
        link: '/feedback',
      });
      io.to(`user:${s._id}`).emit('notification', {
        message: `New feedback ticket: "${subject}"`,
        type: 'info',
      });
    }

    res.status(201).json({ feedback, message: 'Feedback submitted successfully' });
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: 'Validation failed', details: err.errors }); return; }
    logger.error('Feedback create error: %s', (err as Error).message);
    res.status(500).json({ error: 'Server error' });
  }
}

/** GET /api/feedback — List feedback with RBAC scoping */
export async function listFeedback(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { status, category, priority, search } = listFeedbackQuerySchema.parse(req.query);
    const tenantId = req.user!.tenant;
    const filter: Record<string, any> = { tenant: tenantId };

    if (status) filter.status = status;
    if (category) filter.category = category;
    if (priority) filter.priority = priority;
    if (search) {
      const rx = new RegExp(search, 'i');
      filter.$or = [{ subject: rx }, { message: rx }];
    }

    if (req.user?.role === 'student') {
      filter.user = req.user.id;
    } else if (req.user?.role === 'prog_coordinator') {
      const coord = await User.findById(req.user.id);
      if (coord?.programme) filter.programme = coord.programme;
    } else if (req.user?.role === 'supervisor') {
      const students = await Student.find({ supervisor: req.user.id, tenant: tenantId }).select('user');
      filter.user = { $in: students.map(s => s.user) };
    }

    const feedback = await Feedback.find(filter)
      .populate('user', 'firstName lastName role email avatar')
      .populate('assignedTo', 'firstName lastName role')
      .populate('responses.user', 'firstName lastName role avatar')
      .sort({ updatedAt: -1 });

    const stats = {
      open: feedback.filter(f => f.status === 'Open').length,
      assigned: feedback.filter(f => f.status === 'Assigned').length,
      closed: feedback.filter(f => f.status === 'Closed').length,
    };

    res.json({ feedback, stats });
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: 'Validation failed', details: err.errors }); return; }
    logger.error('Feedback list error: %s', (err as Error).message);
    res.status(500).json({ error: 'Server error' });
  }
}

/** POST /api/feedback/:id/respond — Add response and notify via email + WhatsApp */
export async function addResponse(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = idParamSchema.parse(req.params);
    const { message } = responseSchema.parse(req.body);
    const tenantId = req.user!.tenant;

    const feedback = await Feedback.findOne({ _id: id, tenant: tenantId })
      .populate('user', 'firstName lastName email phone role');
    if (!feedback) { res.status(404).json({ error: 'Feedback not found' }); return; }

    if (req.user!.role === 'student' && feedback.user._id?.toString() !== req.user!.id) {
      res.status(403).json({ error: 'Access denied' }); return;
    }

    if (['admin', 'prog_coordinator', 'internship_coordinator', 'supervisor'].includes(req.user!.role)) {
      feedback.status = 'Assigned';
      feedback.assignedTo = req.user!.id as any;
    }

    feedback.responses.push({ user: req.user!.id as any, message, createdAt: new Date() });
    await feedback.save();

    const responder = await User.findById(req.user!.id).select('firstName lastName');
    const responderName = `${responder?.firstName} ${responder?.lastName}`;
    const ticketOwner = feedback.user as any;

    // Don't notify the sender about their own reply
    if (ticketOwner._id?.toString() !== req.user!.id) {
      // In-app notification
      await Notification.create({
        user: ticketOwner._id,
        tenant: tenantId,
        title: `New response on: "${feedback.subject}"`,
        message: message.length > 100 ? message.substring(0, 97) + '...' : message,
        type: 'info',
        link: '/feedback',
      });

      io.to(`user:${ticketOwner._id}`).emit('notification', {
        message: `${responderName} responded to your feedback: "${feedback.subject}"`,
        type: 'success',
      });

      // Email notification
      if (ticketOwner.email) {
        await sendEmail(
          ticketOwner.email,
          `New response on your feedback: "${feedback.subject}"`,
          emailTemplates.feedbackResponse(ticketOwner.firstName, feedback.subject, responderName, message)
        );
      }

      // WhatsApp notification
      if (ticketOwner.phone) {
        await sendWhatsAppMessage(ticketOwner.phone, whatsappTemplates.feedbackReply(ticketOwner.firstName, feedback.subject));
      }
    }

    const updated = await Feedback.findById(id)
      .populate('user', 'firstName lastName role email')
      .populate('assignedTo', 'firstName lastName role')
      .populate('responses.user', 'firstName lastName role avatar');

    res.json({ feedback: updated, message: 'Response added' });
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: 'Validation failed', details: err.errors }); return; }
    logger.error('Feedback respond error: %s', (err as Error).message);
    res.status(500).json({ error: 'Server error' });
  }
}

/** PUT /api/feedback/:id/status — Update status with notification */
export async function updateStatus(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = idParamSchema.parse(req.params);
    const { status } = statusUpdateSchema.parse(req.body);
    const tenantId = req.user!.tenant;

    const feedback = await Feedback.findOneAndUpdate(
      { _id: id, tenant: tenantId },
      { status },
      { new: true }
    ).populate('user', 'firstName lastName email phone');

    if (!feedback) { res.status(404).json({ error: 'Feedback not found' }); return; }

    const owner = feedback.user as any;

    // Notify student when closed
    if (status === 'Closed' && owner) {
      await Notification.create({
        user: owner._id,
        tenant: tenantId,
        title: `Ticket Resolved: "${feedback.subject}"`,
        message: 'Your support ticket has been marked as resolved.',
        type: 'success',
        link: '/feedback',
      });

      io.to(`user:${owner._id}`).emit('notification', {
        message: `Your ticket "${feedback.subject}" has been resolved.`,
        type: 'success',
      });

      if (owner.email) {
        await sendEmail(
          owner.email,
          `Ticket Resolved: "${feedback.subject}"`,
          emailTemplates.feedbackClosed(owner.firstName, feedback.subject)
        );
      }
    }

    res.json({ feedback, message: `Status updated to ${status}` });
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: 'Validation failed', details: err.errors }); return; }
    res.status(500).json({ error: 'Server error' });
  }
}

/** POST /api/feedback/:id/rate — Student rates a resolved ticket */
export async function rateFeedback(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = idParamSchema.parse(req.params);
    const { rating, comment } = ratingSchema.parse(req.body);
    const tenantId = req.user!.tenant;

    const feedback = await Feedback.findOne({ _id: id, tenant: tenantId, user: req.user!.id });
    if (!feedback) { res.status(404).json({ error: 'Feedback not found' }); return; }
    if (feedback.status !== 'Closed') { res.status(400).json({ error: 'Can only rate resolved tickets' }); return; }

    (feedback as any).satisfactionRating = rating;
    (feedback as any).satisfactionComment = comment;
    await feedback.save();

    res.json({ message: 'Thank you for your rating!' });
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: 'Validation failed', details: err.errors }); return; }
    res.status(500).json({ error: 'Server error' });
  }
}

/** GET /api/feedback/export — CSV export */
export async function exportFeedback(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { role: userRole, tenant: tenantId } = req.user!;
    const filter: any = { tenant: tenantId };
    if (userRole === 'student') filter.user = req.user!.id;

    const feedbacks = await Feedback.find(filter)
      .populate('user', 'firstName lastName email role')
      .populate('assignedTo', 'firstName lastName')
      .populate('responses.user', 'firstName lastName role')
      .sort({ createdAt: -1 });

    let csv = 'Ref,Date,Subject,Category,Priority,Author,Author Role,Assigned To,Responses,Latest Response,Status,Rating\n';
    for (const f of feedbacks) {
      const u = f.user as any;
      const assigned = (f as any).assignedTo as any;
      const lastResp = f.responses.length > 0 ? f.responses[f.responses.length - 1] : null;
      const lastRespTxt = lastResp ? `"${lastResp.message.replace(/"/g, '""').substring(0, 100)}"` : 'None';
      csv += `${f._id.toString().slice(-6)},${f.createdAt.toISOString().split('T')[0]},"${f.subject.replace(/"/g, '""')}",${f.category},${(f as any).priority || 'Medium'},${u?.firstName} ${u?.lastName},${u?.role},${assigned ? `${assigned.firstName} ${assigned.lastName}` : 'Unassigned'},${f.responses.length},${lastRespTxt},${f.status},${(f as any).satisfactionRating || '-'}\n`;
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=ACETEL_Feedback_${new Date().toISOString().split('T')[0]}.csv`);
    res.status(200).send(csv);
  } catch (err) {
    logger.error('Feedback export error: %s', (err as Error).message);
    res.status(500).json({ error: 'Feedback export failed' });
  }
}
