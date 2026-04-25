import { Response } from 'express';
import mongoose from 'mongoose';
import { AuthRequest } from '../middleware/auth.middleware';
import Chat from '../models/Chat.model';
import Student from '../models/Student.model';
import User from '../models/User.model';
import Notification from '../models/notification.model';
import { sendEmail, emailTemplates } from '../utils/mail.service';
import { sendWhatsAppMessage, whatsappTemplates } from '../utils/whatsapp.service';
import { io } from '../index';
import { z } from 'zod';
import logger from '../utils/logger';

const idParamSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID format'),
});

const sendMessageSchema = z.object({
  content: z.string().min(1).max(4000).trim(),
  type: z.enum(['text', 'file', 'image']).default('text'),
  fileUrl: z.string().url().optional(),
});

/** GET /api/chat — list all conversations for the current user */
export async function listChats(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = new mongoose.Types.ObjectId(req.user!.id);
    const tenantId = req.user!.tenant;

    const chats = await Chat.find({ participants: userId, tenant: tenantId })
      .populate('participants', 'firstName lastName role avatar email')
      .sort({ lastMessageAt: -1 })
      .select('-messages'); // omit messages array for the list view — load lazily

    res.json({ chats });
  } catch (err) {
    logger.error('Chat listChats error: %s', (err as Error).message);
    res.status(500).json({ error: 'Server error' });
  }
}

/** POST /api/chat/start — start or resume a DM with another user */
export async function startChat(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { targetUserId } = z.object({ targetUserId: z.string().regex(/^[0-9a-fA-F]{24}$/) }).parse(req.body);
    const myId = new mongoose.Types.ObjectId(req.user!.id);
    const theirId = new mongoose.Types.ObjectId(targetUserId);
    const tenantId = req.user!.tenant;

    if (myId.equals(theirId)) {
      res.status(400).json({ error: 'Cannot start a chat with yourself' });
      return;
    }

    const targetUser = await User.findOne({ _id: theirId, tenant: tenantId, isActive: true });
    if (!targetUser) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Find existing DM or create new one
    let chat = await Chat.findOne({
      tenant: tenantId,
      participants: { $all: [myId, theirId], $size: 2 },
    }).populate('participants', 'firstName lastName role avatar email');

    if (!chat) {
      chat = await Chat.create({ tenant: tenantId, participants: [myId, theirId] });
      chat = await Chat.findById(chat._id).populate('participants', 'firstName lastName role avatar email') as any;
    }

    res.json({ chat });
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: err.errors }); return; }
    logger.error('Chat startChat error: %s', (err as Error).message);
    res.status(500).json({ error: 'Server error' });
  }
}

/** GET /api/chat/:id/messages — load messages for a chat */
export async function getChatMessages(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = idParamSchema.parse(req.params);
    const userId = new mongoose.Types.ObjectId(req.user!.id);
    const tenantId = req.user!.tenant;

    const chat = await Chat.findOne({ _id: id, tenant: tenantId, participants: userId });
    if (!chat) { res.status(404).json({ error: 'Chat not found' }); return; }

    // Mark all messages as read by this user
    await Chat.updateOne(
      { _id: id },
      { $addToSet: { 'messages.$[].readBy': userId } }
    );

    const populated = await Chat.findById(id)
      .populate('participants', 'firstName lastName role avatar email')
      .populate('messages.sender', 'firstName lastName role avatar');

    res.json({ messages: populated?.messages || [], participants: populated?.participants || [] });
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: err.errors }); return; }
    logger.error('Chat getMessages error: %s', (err as Error).message);
    res.status(500).json({ error: 'Server error' });
  }
}

/** POST /api/chat/:id/send — send a message */
export async function sendMessage(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = idParamSchema.parse(req.params);
    const { content, type, fileUrl } = sendMessageSchema.parse(req.body);
    const userId = new mongoose.Types.ObjectId(req.user!.id);
    const tenantId = req.user!.tenant;

    const chat = await Chat.findOne({ _id: id, tenant: tenantId, participants: userId })
      .populate('participants', 'firstName lastName email phone role');
    if (!chat) { res.status(404).json({ error: 'Chat not found' }); return; }

    const newMsg: any = {
      _id: new mongoose.Types.ObjectId(),
      sender: userId,
      content,
      type: type || 'text',
      fileUrl,
      readBy: [userId],
      createdAt: new Date(),
    };

    chat.messages.push(newMsg);
    chat.lastMessage = content.substring(0, 100);
    chat.lastMessageAt = new Date();
    chat.lastMessageBy = userId;
    await chat.save();

    const sender = await User.findById(userId).select('firstName lastName email phone');
    const senderName = `${sender?.firstName} ${sender?.lastName}`;

    // Notify all other participants
    const others = (chat.participants as any[]).filter(p => !p._id.equals(userId));
    for (const recipient of others) {
      // Real-time socket notification
      io.to(`user:${recipient._id}`).emit('chat:new_message', {
        chatId: id,
        message: { ...newMsg, sender: { _id: userId, firstName: sender?.firstName, lastName: sender?.lastName } },
      });

      // In-app notification
      await Notification.create({
        user: recipient._id,
        tenant: tenantId,
        title: `New message from ${senderName}`,
        message: content.length > 80 ? content.substring(0, 77) + '...' : content,
        type: 'info',
        link: '/chat',
      });

      // Email notification (only if recipient is offline — simple heuristic: always send)
      if (recipient.email) {
        await sendEmail(
          recipient.email,
          `New message from ${senderName} — ACETEL IMS`,
          emailTemplates.chatMessage(
            recipient.firstName,
            senderName,
            content,
            `${process.env.FRONTEND_URL}/chat`
          )
        );
      }

      // WhatsApp notification
      if (recipient.phone) {
        await sendWhatsAppMessage(
          recipient.phone,
          whatsappTemplates.chatNotification(recipient.firstName, senderName)
        );
      }
    }

    res.status(201).json({ message: newMsg });
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: err.errors }); return; }
    logger.error('Chat sendMessage error: %s', (err as Error).message);
    res.status(500).json({ error: 'Server error' });
  }
}

/** GET /api/chat/contacts — list users the current user can chat with */
export async function getChatContacts(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.id;
    const tenantId = req.user!.tenant;
    const role = req.user!.role;

    // Role-based contact scope
    const filter: Record<string, any> = {
      tenant: tenantId,
      isActive: true,
      _id: { $ne: userId },
      isDeleted: { $ne: true },
    };

    // Students can chat with staff + fellow students in same programme
    if (role === 'student') {
      const studentRecord = await Student.findOne({ user: userId, tenant: tenantId });
      if (studentRecord?.programme) {
        // Get fellow students in same programme
        const fellowStudents = await Student.find({
          programme: studentRecord.programme,
          tenant: tenantId,
          user: { $ne: userId },
        }).select('user');
        const fellowIds = fellowStudents.map(s => s.user);
        filter.$or = [
          { role: { $in: ['supervisor', 'prog_coordinator', 'internship_coordinator', 'admin', 'ict_support'] } },
          { _id: { $in: fellowIds } },
          ...(studentRecord.supervisor ? [{ _id: studentRecord.supervisor }] : []),
        ];
      } else {
        filter.role = { $in: ['supervisor', 'prog_coordinator', 'internship_coordinator', 'admin', 'ict_support'] };
      }
    }

    const contacts = await User.find(filter)
      .select('firstName lastName role email avatar')
      .sort({ role: 1, firstName: 1 });

    res.json({ contacts });
  } catch (err) {
    logger.error('Chat getContacts error: %s', (err as Error).message);
    res.status(500).json({ error: 'Server error' });
  }
}

/** DELETE /api/chat/:id/messages/:msgId — delete own message */
export async function deleteMessage(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = idParamSchema.parse(req.params);
    const { msgId } = z.object({ msgId: z.string().regex(/^[0-9a-fA-F]{24}$/) }).parse(req.params);
    const userId = req.user!.id;
    const tenantId = req.user!.tenant;

    const chat = await Chat.findOne({ _id: id, tenant: tenantId, participants: userId });
    if (!chat) { res.status(404).json({ error: 'Chat not found' }); return; }

    const msg = chat.messages.find(m => m._id.toString() === msgId);
    if (!msg) { res.status(404).json({ error: 'Message not found' }); return; }

    if (msg.sender.toString() !== userId && req.user!.role !== 'admin') {
      res.status(403).json({ error: 'Cannot delete another user\'s message' });
      return;
    }

    chat.messages = chat.messages.filter(m => m._id.toString() !== msgId) as any;
    await chat.save();

    res.json({ message: 'Message deleted' });
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: err.errors }); return; }
    logger.error('Chat deleteMessage error: %s', (err as Error).message);
    res.status(500).json({ error: 'Server error' });
  }
}
