import { Router } from 'express';
import { getAllCompanies, createCompany, updateCompany, deleteCompany, getCompanyById, getCompanyMetadata } from '../controllers/company.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import Company from '../models/Company.model';
import Student from '../models/Student.model';
import { normalizeStateName, studentStateMatchesCompany } from '../utils/nigeria-states.util';
import logger from '../utils/logger';

const r = Router();
r.use(authenticate);
r.get('/', getAllCompanies);
r.get('/meta', getCompanyMetadata);
r.get('/:id', getCompanyById);
r.post('/', authorize('admin', 'prog_coordinator', 'internship_coordinator'), createCompany);
r.put('/:id', authorize('admin', 'prog_coordinator', 'internship_coordinator'), updateCompany);
r.delete('/:id', authorize('admin'), deleteCompany);

/** Bulk assign pending students to a company — emails only after coordinator approves each posting */
r.post(
  '/:id/auto-allocate',
  authorize('admin', 'internship_coordinator', 'prog_coordinator'),
  async (req: any, res: any) => {
    try {
      const company = await Company.findById(req.params.id);
      if (!company) {
        res.status(404).json({ error: 'Company not found' });
        return;
      }

      const normalizedCompanyState = normalizeStateName(company.state || '');
      if (!normalizedCompanyState) {
        res.status(400).json({ error: 'Company state is required for allocation' });
        return;
      }

      const capacity = Math.max(0, (company.maxStudents || 0) - (company.currentStudents || 0));
      if (capacity === 0) {
        res.status(400).json({ error: 'This company has reached its maximum intern capacity' });
        return;
      }

      const candidates = await Student.find({
        tenant: req.user!.tenant,
        $or: [{ company: { $exists: false } }, { company: null }],
        status: { $in: ['pending', 'active'] },
        postingApproved: { $ne: true },
      });

      const matchedStudents = candidates.filter((student) =>
        studentStateMatchesCompany(normalizedCompanyState, student.stateOfOrigin, student.address)
      ).slice(0, capacity);

      if (matchedStudents.length === 0) {
        res.json({
          message: `No pending students found in ${normalizedCompanyState} for this company`,
          count: 0,
          pendingApproval: false,
        });
        return;
      }

      let count = 0;
      for (const student of matchedStudents) {
        student.company = company._id as any;
        student.postingApproved = false;
        student.postingApprovedAt = undefined;
        student.postingApprovedBy = undefined;
        student.status = 'pending';
        await student.save();
        count++;
      }
      company.currentStudents = (company.currentStudents || 0) + count;
      await company.save();

      res.json({
        message: `${count} student(s) matched to ${company.name}. Approve each posting to email students and partners.`,
        count,
        pendingApproval: true,
      });
    } catch (err: any) {
      logger.error('Company auto-allocate: %s', err.message);
      res.status(500).json({ error: err.message || 'Auto-allocation failed' });
    }
  }
);

export default r;
