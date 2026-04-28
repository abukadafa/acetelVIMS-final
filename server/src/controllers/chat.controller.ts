import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import Chat from '../models/Chat.model';
import NotificationModel from '../models/notification.model';
import User from '../models/User.model';
import { sendEmail, emailTemplates } from '../utils/mail.service';
import logger from '../utils/logger';

// ── listChats (alias for getRooms) ──────────────────────────────────────────
export async function listChats(req: AuthRequest, res: Response): Promise<void> {
  return getRooms(req, res);
}

// ── getRooms ────────────────────────────────────────────────────────────────
export async function getRooms(req: AuthRequest, res: Response): Promise<void> {
  try {
    const rooms = await Chat.find({ participants: req.user!.id, tenant: req.user!.tenant })
      .populate('participants', 'firstName lastName role avatar')
      .sort({ updatedAt: -1 });
    res.json({ rooms });
  } catch (err) {
    logger.error('getRooms: %s', (err as Error).message);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── getChatContacts ─────────────────────────────────────────────────────────
export async function getChatContacts(req: AuthRequest, res: Response): Promise<void> {
  try {
    const users = await User.find({
      tenant: req.user!.tenant,
      isActive: true,
      _id: { $ne: req.user!.id }
    }).select('firstName lastName role email avatar').limit(100);
    res.json({ contacts: users });
  } catch (err) {
    logger.error('getChatContacts: %s', (err as Error).message);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── startChat (alias for createRoom) ────────────────────────────────────────
export async function startChat(req: AuthRequest, res: Response): Promise<void> {
  return createRoom(req, res);
}

// ── createRoom ──────────────────────────────────────────────────────────────
export async function createRoom(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { participantId, name } = req.body;
    if (!participantId) { res.status(400).json({ error: 'Participant required' }); return; }

    const participant = await User.findOne({ _id: participantId, tenant: req.user!.tenant, isActive: true });
    if (!participant) { res.status(404).json({ error: 'User not found' }); return; }

    // Return existing room if already exists
    const existing = await Chat.findOne({
      tenant: req.user!.tenant,
      participants: { $all: [req.user!.id, participantId] }
    });
    if (existing) { res.json({ room: existing }); return; }

    const room = new Chat({
      tenant: req.user!.tenant,
      name: name || `Chat: ${req.user!.email}`,
      participants: [req.user!.id, participantId],
      messages: [],
    });
    await room.save();
    res.status(201).json({ room });
  } catch (err) {
    logger.error('createRoom: %s', (err as Error).message);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── getChatMessages (alias for getMessages) ──────────────────────────────────
export async function getChatMessages(req: AuthRequest, res: Response): Promise<void> {
  return getMessages(req, res);
}

// ── getMessages ──────────────────────────────────────────────────────────────
export async function getMessages(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { roomId } = req.params;
    const room = await Chat.findOne({ _id: roomId, participants: req.user!.id, tenant: req.user!.tenant })
      .populate('messages.sender', 'firstName lastName role avatar');
    if (!room) { res.status(404).json({ error: 'Chat room not found' }); return; }
    res.json({ messages: room.messages || [] });
  } catch (err) {
    logger.error('getMessages: %s', (err as Error).message);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── sendMessage ──────────────────────────────────────────────────────────────
export async function sendMessage(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { roomId } = req.params;
    const { content } = req.body;
    if (!content?.trim()) { res.status(400).json({ error: 'Message content is required' }); return; }

    const room = await Chat.findOne({ _id: roomId, participants: req.user!.id, tenant: req.user!.tenant });
    if (!room) { res.status(404).json({ error: 'Chat room not found' }); return; }

    const sentAt = new Date();
    const message = { sender: req.user!.id as any, content: content.trim(), createdAt: sentAt, isRead: false };
    (room.messages as any[]).push(message);
    room.lastMessage = content.trim();
    room.lastMessageAt = sentAt;
    room.lastMessageBy = req.user!.id as any;
    (room as any).updatedAt = sentAt;
    await room.save();

    // Notify other participants
    const appUrl = process.env.FRONTEND_URL || 'https://acetel-vims.onrender.com';
    const sender = await User.findById(req.user!.id).select('firstName lastName');
    const senderName = sender ? `${sender.firstName} ${sender.lastName}` : req.user!.email;
    const otherParticipants = (room.participants as any[]).filter((p: any) => p.toString() !== req.user!.id);

    for (const participantId of otherParticipants) {
      const participant = await User.findById(participantId).select('firstName lastName email');
      if (!participant) continue;
      await NotificationModel.create({
        user: participantId,
        title: `New message from ${senderName}`,
        message: content.trim().substring(0, 100),
        type: 'info',
        channel: 'in-app',
      }).catch(() => {});
      if (participant.email) {
        await sendEmail(
          participant.email,
          `New message from ${senderName}`,
          emailTemplates.chatMessage(
            `${participant.firstName} ${participant.lastName}`,
            senderName,
            content.trim(),
            appUrl
          )
        ).catch(() => {});
      }
    }
    res.json({ message: 'Message sent', data: message });
  } catch (err) {
    logger.error('sendMessage: %s', (err as Error).message);
    res.status(500).json({ error: 'Server error' });
  }
}

// ── deleteMessage ────────────────────────────────────────────────────────────
export async function deleteMessage(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const rooms = await Chat.find({ tenant: req.user!.tenant, 'messages._id': id });
    for (const room of rooms) {
      (room.messages as any[]) = (room.messages as any[]).filter((m: any) => m._id.toString() !== id);
      await room.save();
    }
    res.json({ message: 'Message deleted' });
  } catch (err) {
    logger.error('deleteMessage: %s', (err as Error).message);
    res.status(500).json({ error: 'Server error' });
  }
}
