import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { listChats, startChat, getChatMessages, sendMessage, getChatContacts, deleteMessage } from '../controllers/chat.controller';

const r = Router();

r.use(authenticate);

r.get('/', listChats);
r.get('/contacts', getChatContacts);
r.post('/start', startChat);
r.get('/:id/messages', getChatMessages);
r.post('/:id/send', sendMessage);
r.delete('/:id/messages/:msgId', deleteMessage);

export default r;
