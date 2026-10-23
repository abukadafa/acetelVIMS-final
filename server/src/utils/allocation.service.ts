import Student from '../models/Student.model';
import Company from '../models/Company.model';
import User from '../models/User.model';
import { calculateDistance } from './geo.utils';
import { normalizeStateName, extractStateFromAddress } from './nigeria-states.util';

/**
 * Intelligent Allocation Engine
 * Assigns a student to the closest company within their state 
 * matching their industry sector and having available capacity.
 */
export async function autoAllocateStudent(studentId: string): Promise<any> {
  const student = await Student.findById(studentId).populate('programme');
  if (!student) throw new Error('Student not found');

  const resolvedState = normalizeStateName(student.stateOfOrigin) || extractStateFromAddress(student.address);
  if (!resolvedState) {
    return { success: false, message: 'Student state or address is required for auto-allocation' };
  }

  const programme = student.programme as any;
  const targetSector = getSectorFromProgramme(programme?.code);

  const prevCompanyId = student.company ? student.company.toString() : null;

  // Build query for companies with flexible tenant scoping (allow seeded or institution-specific)
  const tenantClause = student.tenant
    ? { $or: [{ tenant: student.tenant }, { tenant: { $exists: false } }, { tenant: null }] }
    : {};

  // If student was already assigned to a company, allow that company even if currently at maxStudents
  const capacityClause = prevCompanyId
    ? {
        $or: [
          { $expr: { $lt: ['$currentStudents', '$maxStudents'] } },
          { _id: prevCompanyId },
        ],
      }
    : { $expr: { $lt: ['$currentStudents', '$maxStudents'] } };

  const stateRegex = new RegExp(`^${resolvedState}(\\s+State)?$`, 'i');
  const stateQuery = resolvedState === 'FCT'
    ? { $in: [/^fct$/i, /^federal capital territory/i, /^abuja/i, 'FCT', 'Abuja', 'Federal Capital Territory'] }
    : { $in: [resolvedState, stateRegex] };

  // Find all approved companies in the same state
  let availableCompanies = await Company.find({
    ...tenantClause,
    state: stateQuery,
    isApproved: { $ne: false },
    isDeleted: { $ne: true },
    ...capacityClause,
  });

  // Fallback: check address if state field did not return matches
  if (availableCompanies.length === 0) {
    availableCompanies = await Company.find({
      ...tenantClause,
      address: { $regex: new RegExp(resolvedState, 'i') },
      isApproved: { $ne: false },
      isDeleted: { $ne: true },
      ...capacityClause,
    });
  }

  if (availableCompanies.length === 0) {
    return {
      success: false,
      message: `No available partner organisations found in ${resolvedState} with available intern capacity. Please register or verify a partner in ${resolvedState}.`,
    };
  }

  // Score companies. If GPS is present for both sides, use distance; otherwise fall back to capacity.
  const scoredCompanies = availableCompanies.map((company) => {
    const hasGps = !!(student.lat && student.lng && company.lat && company.lng);
    const distance = hasGps
      ? calculateDistance(student.lat!, student.lng!, company.lat!, company.lng!)
      : null;

    // Boost relevance if sector matches
    const sectorMatch = company.sector === targetSector;

    // Lower score is better.
    // If no distance, prioritize lower utilization in same state.
    const utilization = company.maxStudents ? company.currentStudents / company.maxStudents : 1;
    const score = (distance ?? 99999) - (sectorMatch ? 50 : 0) + utilization * 100;

    return { company, distance: distance ?? 0, score, sectorMatch };
  });

  // Sort by score (asc)
  scoredCompanies.sort((a, b) => a.score - b.score);

  const bestMatch = scoredCompanies[0];
  const newCompanyId = (bestMatch.company._id as any).toString();

  // If changing companies, decrement previous company's active intern count
  if (prevCompanyId && prevCompanyId !== newCompanyId) {
    await Company.findByIdAndUpdate(prevCompanyId, {
      $inc: { currentStudents: -1 },
    });
    await Company.updateMany({ currentStudents: { $lt: 0 } }, { $set: { currentStudents: 0 } });
  }

  // If newly assigned or moving to a different company, increment new company's count
  if (!prevCompanyId || prevCompanyId !== newCompanyId) {
    bestMatch.company.currentStudents = (bestMatch.company.currentStudents || 0) + 1;
    await bestMatch.company.save();
  }

  // Assign the company — emails only after coordinator approves posting
  student.company = bestMatch.company._id as any;
  student.postingApproved = false;
  student.postingApprovedAt = undefined;
  student.postingApprovedBy = undefined;
  student.status = 'pending';
  await student.save();

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
function getSectorFromProgramme(code?: string): string {
  const c = String(code || '').toUpperCase();
  if (c.includes('AI')) return 'AI';
  if (c.includes('CYB')) return 'Cybersecurity';
  if (c.includes('MIS')) return 'MIS';
  return 'General IT';
}
