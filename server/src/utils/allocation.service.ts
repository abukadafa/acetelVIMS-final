import Student from '../models/Student.model';
import Company from '../models/Company.model';
import User from '../models/User.model';
import { calculateDistance } from './geo.utils';
import { companyStatesMatching } from './nigeria-states.util';

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

  const programme = student.programme as any;
  const targetSector = getSectorFromProgramme(programme.code);

  // Find all approved companies in the same state (tenant-scoped, not deleted)
  const stateFilter = companyStatesMatching(student.stateOfOrigin);
  const availableCompanies = await Company.find({
    tenant: student.tenant,
    state: stateFilter,
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

  // Assign the company — emails only after coordinator approves posting
  student.company = bestMatch.company._id as any;
  student.postingApproved = false;
  student.postingApprovedAt = undefined;
  student.postingApprovedBy = undefined;
  student.status = 'pending';
  await student.save();

  // Increment company count
  bestMatch.company.currentStudents += 1;
  await bestMatch.company.save();

  const user = await User.findById(student.user).select('firstName lastName');
  if (user) {
    const { default: NotificationModel } = await import('../models/notification.model');
    await NotificationModel.create({
      tenant: student.tenant,
      user: user._id,
      title: 'Placement Assigned — Pending Approval',
      message: `You have been matched to ${bestMatch.company.name}. Your coordinator will confirm the posting; you will receive email with full details once approved.`,
      type: 'info',
      channel: 'in-app',
      link: '/dashboard',
    }).catch(() => {});
  }

  return {
    success: true,
    company: bestMatch.company.name,
    distance: bestMatch.distance.toFixed(2),
    sectorMatch: bestMatch.sectorMatch,
    pendingApproval: true,
    message: 'Placement assigned. Coordinator must approve before student and partner receive posting details by email.',
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
