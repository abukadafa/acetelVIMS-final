import { Router } from 'express';
import { authenticate, authorize, requirePermission } from '../middleware/auth.middleware';
import { upload, validateUploadedFile } from '../middleware/upload.middleware';
import { PERMISSIONS } from '../config/permissions';
import {
  listUsers, createUser, createStudent, updateUser, deactivateUser, listProgrammes, releaseEmail, releaseMatric,
  restoreUser, listRecycleBin, getAuditLogs, exportSecurityAudit,
  permanentDeleteUser, bulkOnboard,
  restoreStudent, permanentDeleteStudent,
  restoreCompany, permanentDeleteCompany,
  bulkRestoreUsers, bulkPermanentDeleteUsers,
  bulkRestoreStudents, bulkPermanentDeleteStudents,
  bulkRestoreCompanies, bulkPermanentDeleteCompanies,
  resetForTesting,
  getPermissionCatalog, getUserPermissions, updateUserPermissions,
  sendEnrollmentEmails, sendStaffEnrollmentEmails,
} from '../controllers/admin.controller';

const r = Router();

// All governance routes require authentication
r.use(authenticate);

// Read — STAFF_VIEW (or admin) lists users/programmes; visibility scope
// (own programme vs tenant-wide) is resolved inside the controller.
r.get('/users',       requirePermission(PERMISSIONS.STAFF_VIEW), listUsers);
r.get('/programmes',  requirePermission(PERMISSIONS.STAFF_VIEW, PERMISSIONS.STUDENTS_VIEW, PERMISSIONS.STUDENTS_VIEW_ALL), listProgrammes);
r.get('/audit-logs/export', requirePermission(PERMISSIONS.AUDIT_VIEW), exportSecurityAudit);
r.get('/audit-logs',  requirePermission(PERMISSIONS.AUDIT_VIEW), getAuditLogs);
r.get('/recycle-bin', authorize('admin', 'ict_support', 'internship_coordinator', 'prog_coordinator'), listRecycleBin);

// Write — STAFF_MANAGE / STUDENTS_ADD govern who can create staff/students
r.post('/users',     requirePermission(PERMISSIONS.STAFF_MANAGE), createUser);
r.post('/staff/send-enrollment-emails', requirePermission(PERMISSIONS.STAFF_MANAGE), sendStaffEnrollmentEmails);
r.post('/users/release-email', authorize('admin', 'ict_support', 'internship_coordinator', 'prog_coordinator'), releaseEmail);
r.post('/students/release-matric', authorize('admin', 'ict_support', 'internship_coordinator', 'prog_coordinator'), releaseMatric);
r.post('/students',  requirePermission(PERMISSIONS.STUDENTS_ADD), createStudent);
r.post('/students/send-enrollment-emails', requirePermission(PERMISSIONS.STUDENTS_MANAGE, PERMISSIONS.STUDENTS_ADD), sendEnrollmentEmails);
r.post('/bulk-onboard', requirePermission(PERMISSIONS.STUDENTS_ADD, PERMISSIONS.STAFF_MANAGE), bulkOnboard);
r.put('/users/:id',  requirePermission(PERMISSIONS.STAFF_MANAGE), updateUser);

// Destructive — ADMIN ONLY (soft delete)
r.delete('/users/:id', authorize('admin'), deactivateUser);

// Recycle Bin Actions — require approval memo upload
const memoUpload = [upload.single('approvalMemo'), validateUploadedFile];

// User restore / permanent delete
r.post('/users/restore/:id',          authorize('admin', 'ict_support', 'internship_coordinator', 'prog_coordinator'), memoUpload, restoreUser);
r.post('/users/permanent-delete/:id', authorize('admin', 'ict_support', 'internship_coordinator', 'prog_coordinator'), memoUpload, permanentDeleteUser);

// Student restore / permanent delete
r.post('/students/restore/:id',          authorize('admin', 'ict_support', 'internship_coordinator', 'prog_coordinator'), memoUpload, restoreStudent);
r.post('/students/permanent-delete/:id', authorize('admin', 'ict_support', 'internship_coordinator', 'prog_coordinator'), memoUpload, permanentDeleteStudent);

// Company restore / permanent delete
r.post('/companies/restore/:id',          authorize('admin', 'ict_support', 'internship_coordinator', 'prog_coordinator'), memoUpload, restoreCompany);
r.post('/companies/permanent-delete/:id', authorize('admin', 'ict_support', 'internship_coordinator', 'prog_coordinator'), memoUpload, permanentDeleteCompany);

// Bulk Recycle Bin Actions
r.post('/users/bulk-restore',             authorize('admin', 'ict_support', 'internship_coordinator', 'prog_coordinator'), memoUpload, bulkRestoreUsers);
r.post('/users/bulk-permanent-delete',    authorize('admin', 'ict_support', 'internship_coordinator', 'prog_coordinator'), memoUpload, bulkPermanentDeleteUsers);
r.post('/students/bulk-restore',          authorize('admin', 'ict_support', 'internship_coordinator', 'prog_coordinator'), memoUpload, bulkRestoreStudents);
r.post('/students/bulk-permanent-delete', authorize('admin', 'ict_support', 'internship_coordinator', 'prog_coordinator'), memoUpload, bulkPermanentDeleteStudents);
r.post('/companies/bulk-restore',         authorize('admin', 'ict_support', 'internship_coordinator', 'prog_coordinator'), memoUpload, bulkRestoreCompanies);
r.post('/companies/bulk-permanent-delete', authorize('admin', 'ict_support', 'internship_coordinator', 'prog_coordinator'), memoUpload, bulkPermanentDeleteCompanies);

// ⚠️  Testing-only reset — wipes all dynamic data and reseeds baseline
r.post('/reset-for-testing', authorize('admin'), resetForTesting);

// Access control — granular, admin-editable permission grants
// Any authenticated staff member can read the catalog (needed to render their own
// read-only permissions view); only admin can view/edit another user's grants.
r.get('/permissions/catalog', getPermissionCatalog);
r.get('/users/:id/permissions', authorize('admin'), getUserPermissions);
r.put('/users/:id/permissions', authorize('admin'), updateUserPermissions);

export default r;
