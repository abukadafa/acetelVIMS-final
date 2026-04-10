import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { createFeedback, listFeedback, addResponse, updateStatus, exportFeedback } from '../controllers/feedback.controller';

const r = Router();

r.use(authenticate); // All feedback routes require authentication

r.post('/', createFeedback);
r.get('/',  listFeedback);
r.get('/export', authorize('admin', 'prog_coordinator', 'internship_coordinator', 'ict_support'), exportFeedback);
r.post('/:id/respond', addResponse);
r.put('/:id/status', authorize('admin', 'prog_coordinator', 'internship_coordinator', 'prog_coordinator', 'supervisor'), updateStatus);

export default r;
