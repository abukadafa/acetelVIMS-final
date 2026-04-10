import { Router } from 'express';
import { generateStudentReport, exportAuditCSV } from '../controllers/report.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
const r = Router();
r.use(authenticate);
r.get('/student/:studentId', authorize('admin', 'prog_coordinator', 'internship_coordinator', 'ict_support', 'supervisor'), generateStudentReport);
r.get('/audit', authorize('admin', 'prog_coordinator', 'internship_coordinator', 'ict_support'), exportAuditCSV);
export default r;
