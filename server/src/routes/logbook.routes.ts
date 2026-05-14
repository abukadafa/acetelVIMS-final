import { Router } from 'express';
import {
  getLogbookEntries, createLogbookEntry, reviewLogbookEntry,
  syncOfflineEntries, deleteLogbookEntry, updateLogbookEntry,
  getSupervisorStudents, getWeeklyPerformance,
  industryReviewLogbook, finalSubmitLogbook, getIndustryLogbooks
} from '../controllers/logbook.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { upload } from '../middleware/upload.middleware';

const r = Router();

r.use(authenticate);
r.get('/',                    getLogbookEntries);
r.get('/supervisor/students', authorize('supervisor', 'admin'), getSupervisorStudents);
r.get('/industry',            authorize('industry_supervisor', 'admin'), getIndustryLogbooks);
r.get('/performance',         authorize('internship_coordinator', 'admin'), getWeeklyPerformance);
r.post('/',                   authorize('student'), upload.array('attachments', 5), createLogbookEntry);
r.post('/sync',               authorize('student'), syncOfflineEntries);
r.put('/:id',                 authorize('student'), upload.array('attachments', 5), updateLogbookEntry);
r.put('/:id/review',          authorize('supervisor', 'prog_coordinator', 'internship_coordinator', 'admin', 'ict_support'), reviewLogbookEntry);
r.put('/:id/industry-review', authorize('industry_supervisor', 'admin'), industryReviewLogbook);
r.post('/:id/final-submit',   authorize('student'), finalSubmitLogbook);
r.delete('/:id',              authorize('student', 'admin'), deleteLogbookEntry);

export default r;
