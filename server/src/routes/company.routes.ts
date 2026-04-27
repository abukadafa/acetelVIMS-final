import { Router } from 'express';
import { getAllCompanies, createCompany, updateCompany, deleteCompany, getCompanyById, getCompanyMetadata } from '../controllers/company.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
const r = Router();
r.use(authenticate);
r.get('/', getAllCompanies);
r.get('/meta', getCompanyMetadata);
r.get('/:id', getCompanyById);
r.post('/', authorize('admin','prog_coordinator', 'internship_coordinator'), createCompany);
r.put('/:id', authorize('admin','prog_coordinator', 'internship_coordinator'), updateCompany);
r.delete('/:id', authorize('admin'), deleteCompany);
export default r;

// Auto-allocate students to a specific company
router.post('/:id/auto-allocate', authenticate, authorize('admin', 'internship_coordinator', 'prog_coordinator'), async (req, res) => {
  try {
    const company = await (await import('../models/Company.model')).default.findById(req.params.id);
    if (!company) { res.status(404).json({ error: 'Company not found' }); return; }
    // Find unallocated students in same state
    const Student = (await import('../models/Student.model')).default;
    const unallocated = await Student.find({
      tenant: req.user!.tenant, company: { $exists: false }, status: 'pending'
    }).limit(company.maxStudents - (company.currentStudents || 0));
    if (unallocated.length === 0) {
      res.json({ message: 'No unallocated students available for this company' }); return;
    }
    let count = 0;
    for (const student of unallocated) {
      student.company = company._id as any;
      student.status = 'active';
      await student.save();
      count++;
    }
    company.currentStudents = (company.currentStudents || 0) + count;
    await company.save();
    res.json({ message: `${count} student(s) allocated to ${company.name}` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Student self-allocate endpoint
router.post('/students/:id/allocate', authenticate, authorize('admin', 'internship_coordinator'), async (req, res) => {
  try {
    const { autoAllocateStudent } = await import('../utils/allocation.service');
    const result = await autoAllocateStudent(req.params.id);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
