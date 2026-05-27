import { Router } from 'express';
import { protect, authorize } from '../middleware/auth.middleware';
import { getAnalytics } from '../controllers/analytics.controller';

const router = Router();

router.get('/', protect, authorize('coordinator', 'admin'), getAnalytics);

export default router;
