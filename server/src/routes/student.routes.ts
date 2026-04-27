import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { getAllStudents, getStudentById, updateStudent, getAllStudentsForMap, updateStudentLocation, getStudentDashboard, deleteStudent, getProgrammes, requestAllocation, exportStudents } from '../controllers/student.controller';
const r = Router();

const STUDENT_VIEWERS = ['admin', 'prog_coordinator', 'internship_coordinator', 'ict_support', 'supervisor'];
const STUDENT_EDITORS = ['admin', 'prog_coordinator', 'internship_coordinator', 'ict_support'];

r.use(authenticate);
r.get('/',          authorize(...STUDENT_VIEWERS), getAllStudents);
r.get('/export',    authorize(...STUDENT_EDITORS), exportStudents);        // new export route
r.get('/map',       authorize('admin', 'prog_coordinator', 'internship_coordinator'), getAllStudentsForMap);
r.get('/dashboard', getStudentDashboard);
r.get('/programmes', getProgrammes);
r.get('/:id',        getStudentById);
r.post('/:id/allocate', authorize('admin'), requestAllocation);             // ADMIN ONLY: role allocation
r.put('/location',   updateStudentLocation);
r.put('/:id',        authorize(...STUDENT_EDITORS), updateStudent);
r.delete('/:id',     authorize('admin'), deleteStudent);

export default r;

// Flag student for review
router.post('/:id/flag', authenticate, authorize('admin', 'supervisor', 'prog_coordinator', 'internship_coordinator'), async (req, res) => {
  try {
    const Student = (await import('../models/Student.model')).default;
    const student = await Student.findByIdAndUpdate(req.params.id, { riskLevel: 'High', riskScore: 80 }, { new: true });
    if (!student) { res.status(404).json({ error: 'Student not found' }); return; }
    res.json({ message: 'Student flagged for review', student });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Auto-allocate single student
router.post('/:id/allocate', authenticate, authorize('admin', 'internship_coordinator', 'prog_coordinator'), async (req, res) => {
  try {
    const { autoAllocateStudent } = await import('../utils/allocation.service');
    const result = await autoAllocateStudent(req.params.id);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
