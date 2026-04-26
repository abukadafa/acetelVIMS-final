import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import Chat from '../models/Chat.model';
import NotificationModel from '../models/notification.model';
import User from '../models/User.model';
import { sendEmail, emailTemplates } from '../utils/mail.service';
import { sendWhatsAppMessage, whatsappTemplates } from '../utils/whatsapp.service';
import logger from '../utils/logger';

export async function getRooms(req: AuthRequest, res: Response): Promise<void> {
  try {
    const rooms = await Chat.find({ participants: req.user!.id, tenant: req.user!.tenant })
      .populate('participants', 'firstName lastName role avatar')
      .populate('lastMessage')
      .sort({ updatedAt: -1 });
    res.json({ rooms });
  } catch (err) {
    logger.error('getRooms: %s', (err as Error).message);
    res.status(500).json({ error: 'Server error' });
  }
}

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

export async function sendMessage(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { roomId } = req.params;
    const { content } = req.body;
    if (!content?.trim()) { res.status(400).json({ error: 'Message content is required' }); return; }

    const room = await Chat.findOne({ _id: roomId, participants: req.user!.id, tenant: req.user!.tenant });
    if (!room) { res.status(404).json({ error: 'Chat room not found' }); return; }

    const message = { sender: req.user!.id, content: content.trim(), createdAt: new Date(), isRead: false };
    (room.messages as any[]).push(message);
    room.lastMessage = message as any;
    room.updatedAt = new Date();
    await room.save();

    // Notify other participants
    const appUrl = process.env.FRONTEND_URL || 'https://acetel-vims.onrender.com';
    const sender = await User.findById(req.user!.id).select('firstName lastName email phone');
    const senderName = sender ? `${sender.firstName} ${sender.lastName}` : req.user!.email;
    const otherParticipants = room.participants.filter((p: any) => p.toString() !== req.user!.id);

    for (const participantId of otherParticipants) {
      const participant = await User.findById(participantId).select('firstName lastName email phone');
      if (!participant) continue;
      await NotificationModel.create({
        user: participantId, title: `New message from ${senderName}`,
        message: content.trim().substring(0, 100), type: 'info', channel: 'in-app'
      });
      if (participant.email) {
        await sendEmail(participant.email, `New message from ${senderName}`,
          emailTemplates.chatMessage(`${participant.firstName} ${participant.lastName}`, senderName, content, appUrl));
      }
    }

    res.json({ message: 'Message sent', data: message });
  } catch (err) {
    logger.error('sendMessage: %s', (err as Error).message);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function createRoom(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { participantId, name } = req.body;
    if (!participantId) { res.status(400).json({ error: 'Participant required' }); return; }

    const participant = await User.findOne({ _id: participantId, tenant: req.user!.tenant });
    if (!participant) { res.status(404).json({ error: 'User not found' }); return; }

    const existing = await Chat.findOne({
      tenant: req.user!.tenant,
      participants: { $all: [req.user!.id, participantId], $size: 2 }
    });
    if (existing) { res.json({ room: existing }); return; }

    const room = new Chat({
      tenant: req.user!.tenant,
      name: name || `${req.user!.email} & ${participant.email}`,
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
