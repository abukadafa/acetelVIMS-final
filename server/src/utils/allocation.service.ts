import Student from '../models/Student.model';
import Company from '../models/Company.model';
import User from '../models/User.model';
import { calculateDistance } from './geo.utils';
import { notifyPlacement } from './placement.service';

/**
 * Intelligent Allocation Engine
 * Assigns a student to the closest company within their state 
 * matching their industry sector and having available capacity.
 */
export async function autoAllocateStudent(studentId: string): Promise<any> {
  const student = await Student.findById(studentId).populate('programme');
  if (!student) throw new Error('Student not found');
  if (!student.stateOfOrigin) {
    return { success: false, message: 'Student state is required for auto-allocation' };
  }
  if (student.company) {
    return {
      success: false,
      message: 'Student is already assigned to a company',
      company: student.company.toString(),
    };
  }

  const programme = student.programme as any;
  const targetSector = getSectorFromProgramme(programme.code);

  // Find all approved companies in the same state (tenant-scoped, not deleted)
  const availableCompanies = await Company.find({
    tenant: student.tenant,
    state: student.stateOfOrigin,
    isApproved: true,
    isDeleted: false,
    $expr: { $lt: ['$currentStudents', '$maxStudents'] }
  });

  if (availableCompanies.length === 0) {
    return { success: false, message: `No available companies found in ${student.stateOfOrigin}` };
  }

  // Score companies. If GPS is present for both sides, use distance; otherwise fall back to capacity.
  const scoredCompanies = availableCompanies.map(company => {
    const hasGps = !!(student.lat && student.lng && company.lat && company.lng);
    const distance = hasGps
      ? calculateDistance(student.lat!, student.lng!, company.lat!, company.lng!)
      : null;

    // Boost relevance if sector matches
    const sectorMatch = company.sector === targetSector;

    // Lower score is better.
    // If no distance, prioritize lower utilization in same state.
    const utilization = company.maxStudents ? (company.currentStudents / company.maxStudents) : 1;
    const score = (distance ?? 99999) - (sectorMatch ? 50 : 0) + utilization * 100;

    return { company, distance: distance ?? 0, score, sectorMatch };
  });

  // Sort by score (asc)
  scoredCompanies.sort((a, b) => a.score - b.score);

  const bestMatch = scoredCompanies[0];

  // Assign the company
  student.company = bestMatch.company._id as any;
  student.status = 'active';
  await student.save();

  // Increment company count
  bestMatch.company.currentStudents += 1;
  await bestMatch.company.save();

  const user = await User.findById(student.user);
  if (user) {
    const programme = student.programme as any;
    const company = bestMatch.company as any;
    const postingDate = new Date().toLocaleDateString('en-GB');
    const reportingDate = process.env.INTERNSHIP_START_DATE
      ? new Date(process.env.INTERNSHIP_START_DATE).toLocaleDateString('en-GB')
      : postingDate;
    const reportingInstructions = `Report to ${company.contactPerson || 'your assigned supervisor'} at ${company.name} on your first day. Bring your ID card and your ACETEL VIMS placement confirmation.`;

    await notifyPlacement({
      tenantId: student.tenant,
      studentId: user._id,
      studentName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Student',
      studentEmail: user.email,
      studentPhone: user.phone,
      matricNumber: student.matricNumber,
      programmeName: programme?.name || 'Programme',
      programmeLevel: programme?.level || 'N/A',
      programmeDurationMonths: programme?.durationMonths,
      companyName: company.name,
      companyAddress: company.address || 'N/A',
      companyContactPerson: company.contactPerson,
      companyContactEmail: company.contactEmail,
      companyContactPhone: company.contactPhone,
      postingDate,
      reportingDate,
      reportingInstructions,
      appUrl: process.env.FRONTEND_URL || 'https://acetel.vims.nou.ng'
    });
  }

  return {
    success: true,
    company: bestMatch.company.name,
    distance: bestMatch.distance.toFixed(2),
    sectorMatch: bestMatch.sectorMatch,
  };
}


/**
 * Mapping ACETEL Programmes to Industry Sectors
 */
function getSectorFromProgramme(code: string): string {
  if (code.includes('AI')) return 'AI';
  if (code.includes('CYB')) return 'Cybersecurity';
  if (code.includes('MIS')) return 'MIS';
  return 'General IT';
}
