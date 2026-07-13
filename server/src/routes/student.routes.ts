import { Router } from 'express';
import { authenticate, requirePermission, requireAnyPermission } from '../middleware/auth.middleware';
import { PERMISSIONS } from '../utils/permissions.util';
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
r.get('/', requirePermission(PERMISSIONS.VIEW_STUDENTS), getAllStudents);
r.get('/export', requirePermission(PERMISSIONS.MANAGE_STUDENTS), exportStudents);
r.get('/map', requireAnyPermission(PERMISSIONS.VIEW_STUDENTS, PERMISSIONS.VIEW_ANALYTICS), getAllStudentsForMap);
r.get('/dashboard', getStudentDashboard);
r.get('/programmes', getProgrammes);
r.get('/:id', getStudentById);
r.post('/:id/allocate', requirePermission(PERMISSIONS.ALLOCATE_STUDENT), requestAllocation);
r.post('/:id/approve-posting', requirePermission(PERMISSIONS.APPROVE_POSTING), approvePosting);
r.put('/location', updateStudentLocation);
r.put('/:id', requirePermission(PERMISSIONS.MANAGE_STUDENTS), updateStudent);
r.delete('/:id', requirePermission(PERMISSIONS.DELETE_STUDENT), deleteStudent);
r.post('/bulk-delete', requirePermission(PERMISSIONS.DELETE_STUDENT), bulkDeleteStudents);

r.post('/:id/flag', requirePermission(PERMISSIONS.MANAGE_STUDENTS), async (req: any, res: any) => {
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
