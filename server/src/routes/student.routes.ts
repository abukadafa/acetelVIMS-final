import { Router } from 'express';
import { authenticate, authorize, requirePermission } from '../middleware/auth.middleware';
import { PERMISSIONS } from '../config/permissions';
import {
  getAllStudents,
  getStudentById,
  updateStudent,
  getAllStudentsForMap,
  updateStudentLocation,
  getStudentDashboard,
  deleteStudent,
  getProgrammes,
  requestAllocation,
  exportStudents,
  approvePosting,
  bulkDeleteStudents,
} from '../controllers/student.controller';

const r = Router();

r.use(authenticate);
// Visibility/edit access is now permission-based (admin-editable via
// PUT /api/admin/users/:id/permissions) instead of a fixed role list, so a
// student enrolled by one user shows for anyone granted the right permission.
r.get('/', requirePermission(PERMISSIONS.STUDENTS_VIEW, PERMISSIONS.STUDENTS_VIEW_ALL), getAllStudents);
r.get('/export', requirePermission(PERMISSIONS.STUDENTS_EXPORT), exportStudents);
r.get('/map', requirePermission(PERMISSIONS.STUDENTS_VIEW_ALL), getAllStudentsForMap);
r.get('/dashboard', getStudentDashboard);
r.get('/programmes', getProgrammes);
r.get('/:id', getStudentById);
r.post('/:id/allocate', requirePermission(PERMISSIONS.STUDENTS_MANAGE), requestAllocation);
r.post('/:id/approve-posting', requirePermission(PERMISSIONS.STUDENTS_MANAGE), approvePosting);
r.put('/location', updateStudentLocation);
r.put('/:id', requirePermission(PERMISSIONS.STUDENTS_MANAGE), updateStudent);
r.delete('/:id', authorize('admin'), deleteStudent);
r.post('/bulk-delete', authorize('admin'), bulkDeleteStudents);

r.post('/:id/flag', requirePermission(PERMISSIONS.STUDENTS_MANAGE, PERMISSIONS.STUDENTS_VIEW_ALL), async (req: any, res: any) => {
  try {
    const Student = (await import('../models/Student.model')).default;
    const student = await Student.findByIdAndUpdate(
      req.params.id,
      { riskLevel: 'High', riskScore: 80 },
      { new: true }
    );
    if (!student) {
      res.status(404).json({ error: 'Student not found' });
      return;
    }
    res.json({ message: 'Student flagged for review', student });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default r;
