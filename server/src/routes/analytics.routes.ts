import { Router } from 'express';
import { getAnalyticsSummary, getStudentAnalytics } from '../controllers/analytics.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
const r = Router();
r.use(authenticate);
r.get('/summary', authorize('admin', 'prog_coordinator', 'internship_coordinator', 'ict_support'), getAnalyticsSummary);
r.get('/student/:studentId', authorize('admin', 'prog_coordinator', 'internship_coordinator', 'ict_support', 'supervisor'), getStudentAnalytics);
export default r;
