import { Router } from 'express';
import { protect, authorize } from '../middleware/auth.middleware';
import {
  createApplication,
  getMyApplications,
  getAllApplications,
  updateApplicationStatus
} from '../controllers/application.controller';

const router = Router();

router.post('/', protect, createApplication);
router.get('/my', protect, getMyApplications);
router.get('/', protect, authorize('coordinator', 'admin'), getAllApplications);
router.patch('/:id/status', protect, authorize('coordinator', 'admin'), updateApplicationStatus);

export default router;
