import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  try {
    const info = await transporter.sendMail({
      from: `"ACETEL IMS" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
    });
    console.log(`📧 Email sent: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error('❌ Email failed:', error);
    return false;
  }
}

export const emailTemplates = {
  inactivityWarning: (name: string, days: number) => `
    <h2>Internship Activity Warning: ${days} Days</h2>
    <p>Dear ${name},</p>
    <p>Our system has detected <strong>${days} days of inactivity</strong> on your internship logbook.</p>
    <p>Please log in and update your daily entries to maintain compliance with ACETEL standards.</p>
    <br/>
    <p>Regards,<br/>Internship Coordinator</p>
  `,
  supervisorEscalation: (studentName: string, supervisorName: string, days: number) => `
    <h2>Urgent: Student Inactivity Escalation</h2>
    <p>Dear ${supervisorName},</p>
    <p>This is to notify you that student <strong>${studentName}</strong> has been inactive for <strong>${days} consecutive days</strong>.</p>
    <p>As their Industry Supervisor, please reach out to confirm their status at the workplace.</p>
    <br/>
    <p>Regards,<br/>ACETEL Monitoring System</p>
  `,
  coordinatorEscalation: (studentName: string, coordName: string, days: number) => `
    <h2>High Priority: Missing Internship Reports</h2>
    <p>Dear Coordinator ${coordName},</p>
    <p>Student <strong>${studentName}</strong> has reached <strong>${days} days</strong> of non-submission.</p>
    <p>The student's risk level has been elevated. Further action may be required according to institutional policy.</p>
    <br/>
    <p>Regards,<br/>ACETEL IMS Compliance Bot</p>
  `,
  missingWeeklySubmission: (name: string) => `
    <h2>Missing Weekly Submission</h2>
    <p>Dear ${name},</p>
    <p>Your weekly logbook submission is overdue. This has been escalated to your Programme Coordinator.</p>
    <p>Please submit your entries immediately for supervisor review.</p>
    <br/>
    <p>Regards,<br/>ACETEL IMS Bot</p>
  `
};
