import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import Student from '../models/Student.model';
import Logbook from '../models/Logbook.model';
import Assessment from '../models/Assessment.model';
import Setting from '../models/Setting.model';
import { z } from 'zod';
import logger from '../utils/logger';

const studentIdParamSchema = z.object({
  studentId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID format'),
});

const exportQuerySchema = z.object({
  programmeId: z.string().optional(),
  session: z.string().optional(),
});

export async function generateStudentReport(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { studentId } = studentIdParamSchema.parse(req.params);
    const tenantId = req.user!.tenant;

    const student = await Student.findOne({ _id: studentId, tenant: tenantId })
      .populate('user', '-password')
      .populate('programme')
      .populate('company')
      .populate('supervisor', 'firstName lastName email phone');

    if (!student) {
      res.status(404).json({ error: 'Student not found in your institution' });
      return;
    }

    // RBAC: Students can only view their own report
    if (req.user!.role === 'student' && student.user?._id.toString() !== req.user!.id) {
       res.status(403).json({ error: 'Access denied' });
       return;
    }

    const logbooks = await Logbook.find({ student: studentId, tenant: tenantId }).sort({ entryDate: 1 });
    const assessments = await Assessment.find({ student: studentId, tenant: tenantId }).sort({ createdAt: 1 });

    const totalLogbookEntries = logbooks.length;
    const approvedLogbooks = logbooks.filter(l => l.status === 'approved').length;
    const ratings = logbooks.filter(l => l.supervisorRating).map(l => l.supervisorRating!);
    const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;

    const settings = await Setting.find({ tenant: tenantId });
    const settingsMap = settings.reduce((acc: any, s) => {
      acc[s.key] = s.value;
      return acc;
    }, {});

    res.json({
      student,
      logbooks,
      assessments,
      summary: {
        totalLogbookEntries,
        approvedLogbooks,
        averageRating: avgRating.toFixed(1),
        overallScore: student.overallScore,
        riskLevel: student.riskLevel,
        riskScore: student.riskScore
      },
      institution: {
        title: settingsMap['INSTITUTION_NAME'] || 'National Open University of Nigeria (NOUN)',
        subtitle: settingsMap['INSTITUTION_SUBTITLE'] || 'Africa Centre of Excellence on Technology Enhanced Learning (ACETEL)',
        documentTitle: settingsMap['REPORT_TITLE'] || 'POSTGRADUATE STUDENT INTERNSHIP LOGBOOK',
        branding: {
          nounLogo: '/assets/noun-logo.png',
          acetelLogo: '/assets/acetel-logo.png'
        }
      }
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    logger.error('Error: %s', (err as Error).message);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function exportAuditCSV(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { programmeId, session } = exportQuerySchema.parse(req.query);
    const tenantId = req.user!.tenant;

    let query: any = { tenant: tenantId };
    if (programmeId) query.programme = programmeId;
    if (session) query.academicSession = session;

    const students = await Student.find(query)
      .populate('user', 'firstName lastName email phone')
      .populate('programme', 'name')
      .populate('company', 'name state')
      .populate('supervisor', 'firstName lastName email');

    // CSV Headers
    const headers = [
      'Student Name', 'Matric Number', 'Programme', 'Academic Session',
      'Company Name', 'Company Location', 'Supervisor Name', 'Supervisor Email',
      'Total Logbook Entries', 'Days Present', 'Days Missed', 'Last Activity Date',
      'Performance Rating', 'Risk Status', 'Internship Status'
    ];

    const rows = await Promise.all(students.map(async (s) => {
      const u = s.user as any;
      const prog = s.programme as any;
      const comp = s.company as any;
      const sup = s.supervisor as any;

      const logbookEntries = await Logbook.find({ student: s._id, tenant: tenantId });
      const totalEntries = logbookEntries.length;
      const approvedEntries = logbookEntries.filter(l => l.status === 'approved').length;
      
      const ratings = logbookEntries.filter(l => l.supervisorRating).map(l => l.supervisorRating!);
      const avgRating = ratings.length > 0 ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : 'N/A';
      
      const lastEntry = logbookEntries.sort((a, b) => b.entryDate.getTime() - a.entryDate.getTime())[0];

      return [
        `"${u.firstName} ${u.lastName}"`,
        `"${s.matricNumber}"`,
        `"${prog?.name || 'N/A'}"`,
        `"${s.academicSession}"`,
        `"${comp?.name || 'N/A'}"`,
        `"${comp?.state || 'N/A'}"`,
        `"${sup ? `${sup.firstName} ${sup.lastName}` : 'N/A'}"`,
        `"${sup?.email || 'N/A'}"`,
        totalEntries,
        approvedEntries,
        totalEntries - approvedEntries, // Simplified Missed calculation
        lastEntry ? lastEntry.entryDate.toLocaleDateString() : 'Never',
        avgRating,
        s.riskLevel,
        s.status.toUpperCase()
      ];
    }));

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=acetel_audit_${new Date().getTime()}.csv`);
    res.status(200).send(csvContent);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: err.errors });
      return;
    }
    logger.error('Error: %s', (err as Error).message);
    res.status(500).json({ error: 'Server error' });
  }
}
