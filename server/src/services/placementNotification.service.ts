import Student from '../models/Student.model';
import User from '../models/User.model';
import Company from '../models/Company.model';
import NotificationModel from '../models/notification.model';
import { sendEmail, emailTemplates } from '../utils/mail.service';
import { sendWhatsAppMessage, whatsappTemplates } from '../utils/whatsapp.service';
import logger from '../utils/logger';

export type PostingNotifyResult = {
  sent: boolean;
  studentEmail?: boolean;
  partnerEmail?: boolean;
  reason?: string;
};

/**
 * Send placement detail emails/WhatsApp to student and partner only after
 * coordinator approval (postingApproved) and company is approved.
 */
export async function sendApprovedPostingNotifications(
  studentId: string,
  approvedByUserId?: string
): Promise<PostingNotifyResult> {
  const student = await Student.findById(studentId);
  if (!student) return { sent: false, reason: 'student_not_found' };
  if (!student.company) return { sent: false, reason: 'no_company_assigned' };
  if (!student.postingApproved) return { sent: false, reason: 'posting_not_approved' };

  const company = await Company.findOne({
    _id: student.company,
    tenant: student.tenant,
    isDeleted: false,
  });
  if (!company) return { sent: false, reason: 'company_not_found' };
  if (!company.isApproved) return { sent: false, reason: 'company_not_approved' };

  const user = await User.findById(student.user).select('firstName lastName email phone');
  if (!user) return { sent: false, reason: 'user_not_found' };

  const appUrl = process.env.FRONTEND_URL || 'https://acetel-vims.onrender.com';
  const studentName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Student';
  const supervisor = company.contactPerson || 'Industry Supervisor';

  await NotificationModel.create({
    tenant: student.tenant,
    user: user._id,
    title: 'Internship Posting Confirmed',
    message: `Your placement at ${company.name} has been approved. Check your email for full details.`,
    type: 'success',
    channel: 'in-app',
    link: '/dashboard',
  }).catch(() => {});

  const studentEmailOk = await sendEmail(
    user.email,
    'ACETEL VIMS — Internship Posting Confirmed',
    emailTemplates.studentPostingConfirmed(
      studentName,
      company.name,
      company.address || 'See portal',
      supervisor,
      appUrl
    )
  ).catch(() => false);

  let partnerEmailOk = false;
  if (company.contactEmail) {
    partnerEmailOk = await sendEmail(
      company.contactEmail,
      `New Intern Assigned — ${studentName}`,
      emailTemplates.companyPlacementNotice(
        company.name,
        studentName,
        student.matricNumber,
        user.email,
        user.phone || 'N/A',
        appUrl
      )
    ).catch(() => false);
  }

  if (company.contactPhone) {
    await sendWhatsAppMessage(
      company.contactPhone,
      whatsappTemplates.partnerPlacementNotice(
        company.name,
        studentName,
        student.matricNumber,
        user.email,
        user.phone || 'N/A'
      )
    ).catch(() => false);
  }

  if (user.phone) {
    const waMsg = whatsappTemplates.placementSuccessful(
      studentName,
      company.name,
      company.address || 'Company Location',
      supervisor
    );
    await sendWhatsAppMessage(user.phone, waMsg).catch(() => false);
  }

  logger.info(
    'Posting notifications sent for student %s (studentEmail=%s partnerEmail=%s)',
    student.matricNumber,
    studentEmailOk,
    partnerEmailOk
  );

  if (!studentEmailOk && !partnerEmailOk) {
    return {
      sent: false,
      reason: 'email_delivery_failed',
      studentEmail: false,
      partnerEmail: false,
    };
  }

  return {
    sent: true,
    studentEmail: studentEmailOk,
    partnerEmail: partnerEmailOk,
    reason: !partnerEmailOk && company.contactEmail ? 'partner_email_failed' : undefined,
  };
}
