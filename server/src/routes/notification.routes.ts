import { Router } from 'express';
import { getNotifications, markAsRead, deleteNotification } from '../controllers/notification.controller';
import { authenticate } from '../middleware/auth.middleware';
const r = Router();
r.use(authenticate);
r.get('/', getNotifications);
r.put('/:id/read', markAsRead);
r.delete('/:id', deleteNotification);
export default r;
