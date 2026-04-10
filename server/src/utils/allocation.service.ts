import Student from '../models/Student.model';
import Company from '../models/Company.model';
import User from '../models/User.model';
import NotificationModel from '../models/notification.model';
import { calculateDistance } from './geo.utils';
import { sendEmail } from './mail.service';
import { sendWhatsAppMessage, whatsappTemplates } from './whatsapp.service';

/**
 * Intelligent Allocation Engine
 * Assigns a student to the closest company within their state 
 * matching their industry sector and having available capacity.
 */
export async function autoAllocateStudent(studentId: string): Promise<any> {
  const student = await Student.findById(studentId).populate('programme');
  if (!student) throw new Error('Student not found');
  if (!student.lat || !student.lng || !student.stateOfOrigin) {
    throw new Error('Student address and coordinates are required for auto-allocation');
  }

  const programme = student.programme as any;
  const targetSector = getSectorFromProgramme(programme.code);

  // Find all approved companies in the same state
  const availableCompanies = await Company.find({ 
    state: student.stateOfOrigin,
    isApproved: true,
    $expr: { $lt: ['$currentStudents', '$maxStudents'] } 
  });

  if (availableCompanies.length === 0) {
    return { success: false, message: `No available companies found in ${student.stateOfOrigin}` };
  }

  // Calculate distances and score relevance
  const scoredCompanies = availableCompanies.map(company => {
    const distance = calculateDistance(
      student.lat!, student.lng!, 
      company.lat!, company.lng!
    );
    
    // Boost relevance if sector matches
    const sectorMatch = company.sector === targetSector;
    const score = distance - (sectorMatch ? 50 : 0); // 50km 'bonus' for sector match

    return { company, distance, score };
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

  // Get User Details for notifications
  const user = await User.findById(student.user);
  if (user) {
    const supervisor = (bestMatch.company as any).contactPerson || 'Departmental Supervisor';
    const studentName = user.firstName || 'Student';
    const message = `Congratulations! You have been placed at ${bestMatch.company.name} for your internship.`;
    
    // 1. Internal Notification
    await NotificationModel.create({
      user: user._id,
      title: 'Internship Placement Successful',
      message: message,
      type: 'success'
    });

    // 2. Email Notification
    await sendEmail(
      user.email,
      'Institutional Placement - ACETEL VIMS',
      `<h2>Placement Successful</h2><p>Hello ${studentName}, you have been placed at <strong>${bestMatch.company.name}</strong>.</p>`
    );

    // 3. WhatsApp Notification
    if (user.phone) {
      const waMsg = whatsappTemplates.placementSuccessful(
        studentName, 
        bestMatch.company.name, 
        bestMatch.company.address || 'Company Location', 
        supervisor
      );
      await sendWhatsAppMessage(user.phone, waMsg);
    }
  }

  return { 
    success: true, 
    company: bestMatch.company.name, 
    distance: bestMatch.distance.toFixed(2),
    sectorMatch: bestMatch.company.sector === targetSector
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
