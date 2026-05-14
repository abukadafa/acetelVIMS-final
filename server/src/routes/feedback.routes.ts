import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { createFeedback, listFeedback, addResponse, updateStatus, exportFeedback, rateFeedback } from '../controllers/feedback.controller';

const r = Router();

r.use(authenticate);

r.post('/', createFeedback);
r.get('/', listFeedback);
r.get('/export', authorize('admin', 'prog_coordinator', 'internship_coordinator', 'ict_support'), exportFeedback);
r.post('/:id/respond', addResponse);
r.put('/:id/status', authorize('admin', 'prog_coordinator', 'internship_coordinator', 'supervisor'), updateStatus);
r.post('/:id/rate', authorize('student'), rateFeedback);

export default r;
