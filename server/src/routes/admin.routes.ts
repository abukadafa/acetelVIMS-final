import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { upload } from '../middleware/upload.middleware';
import {
  listUsers, createUser, createStudent, updateUser, deactivateUser, listProgrammes,
  restoreUser, listRecycleBin, getAuditLogs, exportSecurityAudit,
  permanentDeleteUser, bulkOnboard,
  restoreStudent, permanentDeleteStudent,
  restoreCompany, permanentDeleteCompany,
} from '../controllers/admin.controller';

const r = Router();
const GOVERNANCE_ROLES = ['admin', 'prog_coordinator', 'internship_coordinator', 'ict_support'];

// All governance routes require authentication
r.use(authenticate);

// Read — all governance roles can list users and programmes scoped to their programme
r.get('/users',       authorize(...GOVERNANCE_ROLES), listUsers);
r.get('/programmes',  authorize(...GOVERNANCE_ROLES), listProgrammes);
r.get('/audit-logs/export', authorize(...GOVERNANCE_ROLES), exportSecurityAudit);
r.get('/audit-logs',  authorize(...GOVERNANCE_ROLES), getAuditLogs);
r.get('/recycle-bin', authorize('admin'), listRecycleBin);

// Write — coordinators & ICT support can create users/students within their programme
r.post('/users',     authorize(...GOVERNANCE_ROLES), createUser);
r.post('/students',  authorize(...GOVERNANCE_ROLES), createStudent);
r.post('/bulk-onboard', authorize(...GOVERNANCE_ROLES), bulkOnboard);
r.put('/users/:id',  authorize(...GOVERNANCE_ROLES), updateUser);

// Destructive — ADMIN ONLY (soft delete)
r.delete('/users/:id', authorize('admin'), deactivateUser);

// Recycle Bin Actions — ADMIN ONLY, require approval memo upload
const memoUpload = upload.single('approvalMemo');

// User restore / permanent delete
r.post('/users/restore/:id',          authorize('admin'), memoUpload, restoreUser);
r.post('/users/permanent-delete/:id', authorize('admin'), memoUpload, permanentDeleteUser);

// Student restore / permanent delete
r.post('/students/restore/:id',          authorize('admin'), memoUpload, restoreStudent);
r.post('/students/permanent-delete/:id', authorize('admin'), memoUpload, permanentDeleteStudent);

// Company restore / permanent delete
r.post('/companies/restore/:id',          authorize('admin'), memoUpload, restoreCompany);
r.post('/companies/permanent-delete/:id', authorize('admin'), memoUpload, permanentDeleteCompany);

export default r;
