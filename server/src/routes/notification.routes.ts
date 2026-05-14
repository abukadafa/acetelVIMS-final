import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import * as ctrl from '../controllers/notification.controller';

const router = Router();

router.get('/',           authenticate, ctrl.getNotifications);
router.put('/:id/read',   authenticate, ctrl.markRead);
router.put('/read-all',   authenticate, ctrl.markAllRead);
router.post('/send',      authenticate, authorize('admin', 'prog_coordinator', 'internship_coordinator', 'supervisor', 'industry_supervisor', 'ict_support', 'student'), ctrl.sendNotification);

export default router;
