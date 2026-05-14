import mongoose from 'mongoose';
import logger from './logger';
import NotificationModel from '../models/notification.model';
import { sendEmailWithRetry, emailTemplates } from './mail.service';
import { sendWhatsAppWithRetry, whatsappTemplates } from './whatsapp.service';

export interface PlacementPayload {
  tenantId: mongoose.Types.ObjectId | string;
  studentId: mongoose.Types.ObjectId | string;
  studentName: string;
  studentEmail: string;
  studentPhone?: string;
  matricNumber: string;
  programmeName: string;
  programmeLevel: string;
  programmeDurationMonths?: number;
  companyName: string;
  companyAddress: string;
  companyContactPerson?: string;
  companyContactEmail?: string;
  companyContactPhone?: string;
  postingDate: string;
  reportingDate: string;
  reportingInstructions: string;
  appUrl: string;
}

function formatPhone(phone?: string): string {
  if (!phone) return 'N/A';
  return phone.trim();
}

export async function notifyPlacement(payload: PlacementPayload): Promise<{ studentEmail: boolean; studentWhatsApp: boolean; partnerEmail: boolean; partnerWhatsApp: boolean; }> {
  const {
    tenantId, studentId,
    studentName, studentEmail, studentPhone,
    matricNumber, programmeName, programmeLevel, programmeDurationMonths,
    companyName, companyAddress, companyContactPerson, companyContactEmail, companyContactPhone,
    postingDate, reportingDate, reportingInstructions, appUrl
  } = payload;

  const studentSubject = `ACETEL VIMS — Internship Placement Confirmed for ${companyName}`;
  const studentBody = emailTemplates.studentPlacementNotice(
    studentName,
    companyName,
    companyAddress,
    postingDate,
    reportingDate,
    reportingInstructions,
    programmeName,
    programmeLevel,
    programmeDurationMonths,
    matricNumber
  );

  const studentEmailOk = await sendEmailWithRetry(studentEmail, studentSubject, studentBody);
  const studentWhatsAppOk = studentPhone
    ? await sendWhatsAppWithRetry(studentPhone, whatsappTemplates.placementSuccessfulStudent(
        studentName,
        companyName,
        companyAddress,
        companyContactPerson || 'Company Supervisor',
        postingDate,
        reportingInstructions,
        appUrl
      ))
    : false;

  try {
    await NotificationModel.create({
      tenant: tenantId,
      user: studentId,
      title: 'Internship Placement Confirmed',
      message: `You have been placed at ${companyName}. Reporting date: ${reportingDate}.`,
      type: 'success',
      channel: 'email',
      link: '/dashboard'
    });
  } catch (notifyErr: any) {
    logger.warn('Failed to save student placement in-app notification: %s', notifyErr.message);
  }

  let partnerEmailOk = false;
  let partnerWhatsAppOk = false;

  if (companyContactEmail) {
    const partnerSubject = `ACETEL VIMS — New Intern Assigned to ${companyName}`;
    const partnerBody = emailTemplates.partnerPlacementNotice(
      companyName,
      studentName,
      matricNumber,
      programmeName,
      programmeLevel,
      programmeDurationMonths,
      studentEmail,
      formatPhone(studentPhone),
      postingDate,
      reportingDate,
      reportingInstructions,
      companyAddress,
      companyContactPerson || 'Company Supervisor'
    );
    partnerEmailOk = await sendEmailWithRetry(companyContactEmail, partnerSubject, partnerBody);
  }

  if (companyContactPhone) {
    partnerWhatsAppOk = await sendWhatsAppWithRetry(companyContactPhone, whatsappTemplates.partnerPlacementNotice(
      companyContactPerson || 'Company Supervisor',
      studentName,
      matricNumber,
      programmeName,
      programmeLevel,
      programmeDurationMonths,
      studentEmail,
      formatPhone(studentPhone),
      postingDate,
      reportingDate,
      reportingInstructions,
      companyName,
      companyAddress,
      appUrl
    ));
  }

  if (!studentEmailOk && !studentWhatsAppOk) {
    logger.error('Placement notification failed for student %s (%s)', studentName, studentEmail);
  }

  if (companyContactEmail && !partnerEmailOk) {
    logger.error('Partner notification email failed for %s (%s)', companyName, companyContactEmail);
  }

  if (companyContactPhone && !partnerWhatsAppOk) {
    logger.error('Partner WhatsApp notification failed for %s (%s)', companyName, companyContactPhone);
  }

  return { studentEmail: studentEmailOk, studentWhatsApp: studentWhatsAppOk, partnerEmail: partnerEmailOk, partnerWhatsApp: partnerWhatsAppOk };
}
