import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { getRooms, getMessages, sendMessage, createRoom, listChats, startChat, getChatMessages, getChatContacts, deleteMessage } from '../controllers/chat.controller';

const r = Router();
r.use(authenticate);

r.get('/',              listChats);
r.get('/contacts',      getChatContacts);
r.post('/start',        startChat);
r.get('/:roomId',       getChatMessages);
r.post('/:roomId',      sendMessage);
r.delete('/:id',        deleteMessage);
// aliases
r.get('/rooms',         getRooms);
r.get('/rooms/:roomId', getMessages);
r.post('/rooms',        createRoom);

export default r;
