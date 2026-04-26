import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  try {
    await transporter.sendMail({
      from: `"ACETEL VIMS" <${process.env.SMTP_USER}>`,
      to, subject, html,
    });
    return true;
  } catch (error) {
    console.error('Email failed:', error);
    return false;
  }
}

const base = (content: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #f4f7f4; margin: 0; padding: 0; }
    .wrapper { max-width: 600px; margin: 32px auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #14532d, #166534); padding: 32px 36px; color: #fff; }
    .header h1 { margin: 0; font-size: 1.4rem; font-weight: 800; letter-spacing: -0.02em; }
    .header p  { margin: 6px 0 0; font-size: 0.85rem; color: #bbf7d0; }
    .body { padding: 32px 36px; color: #111827; font-size: 0.95rem; line-height: 1.7; }
    .info-box { background: #f0fdf4; border: 1.5px solid #bbf7d0; border-radius: 10px; padding: 18px 22px; margin: 20px 0; }
    .info-row { display: flex; gap: 12px; margin-bottom: 10px; align-items: baseline; }
    .info-label { font-weight: 700; color: #166534; min-width: 140px; font-size: 0.85rem; }
    .info-value { color: #111827; font-size: 0.9rem; }
    .btn { display: inline-block; margin-top: 24px; padding: 14px 28px; background: #166534; color: #fff; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 0.95rem; }
    .footer { background: #f9fafb; padding: 18px 36px; font-size: 0.78rem; color: #6b7280; border-top: 1px solid #e5e7eb; }
    h2 { color: #14532d; margin-top: 0; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>ACETEL VIMS</h1>
      <p>Africa Centre of Excellence for Technology Enhanced Learning — Virtual Internship Management System</p>
    </div>
    <div class="body">${content}</div>
    <div class="footer">
      This is an automated message from ACETEL VIMS. Do not reply to this email.<br/>
      National Open University of Nigeria (NOUN) · ACETEL · Abuja, Nigeria
    </div>
  </div>
</body>
</html>`;

export const emailTemplates = {

  welcomeStudent: (name: string, email: string, password: string, appUrl: string, company: string) => base(`
    <h2>Welcome to ACETEL VIMS, ${name}!</h2>
    <p>Your Virtual Internship Management System account has been successfully created. Below are your login credentials and placement details:</p>
    <div class="info-box">
      <div class="info-row"><span class="info-label">Full Name</span><span class="info-value">${name}</span></div>
      <div class="info-row"><span class="info-label">Login Email</span><span class="info-value">${email}</span></div>
      <div class="info-row"><span class="info-label">Temporary Password</span><span class="info-value"><strong>${password}</strong></span></div>
      <div class="info-row"><span class="info-label">Placed At</span><span class="info-value"><strong>${company}</strong></span></div>
      <div class="info-row"><span class="info-label">Portal URL</span><span class="info-value"><a href="${appUrl}">${appUrl}</a></span></div>
    </div>
    <p><strong>Important:</strong> Please change your password immediately after your first login.</p>
    <p>You are required to update your logbook daily and mark your biometric attendance every working day.</p>
    <a class="btn" href="${appUrl}">Access ACETEL VIMS Portal</a>
    <p style="margin-top:24px; color: #6b7280; font-size: 0.85rem;">If you have any issues, contact your Programme Coordinator or the ICT Support desk.</p>
  `),

  welcomeStaff: (name: string, email: string, password: string, role: string, appUrl: string) => base(`
    <h2>Welcome to ACETEL VIMS, ${name}!</h2>
    <p>A staff account has been created for you on the ACETEL Virtual Internship Management System.</p>
    <div class="info-box">
      <div class="info-row"><span class="info-label">Name</span><span class="info-value">${name}</span></div>
      <div class="info-row"><span class="info-label">Email</span><span class="info-value">${email}</span></div>
      <div class="info-row"><span class="info-label">Password</span><span class="info-value"><strong>${password}</strong></span></div>
      <div class="info-row"><span class="info-label">Role</span><span class="info-value">${role.replace(/_/g, ' ').toUpperCase()}</span></div>
      <div class="info-row"><span class="info-label">Portal URL</span><span class="info-value"><a href="${appUrl}">${appUrl}</a></span></div>
    </div>
    <p>Please log in and change your password immediately.</p>
    <a class="btn" href="${appUrl}">Access ACETEL VIMS Portal</a>
  `),

  companyPlacementNotice: (company: string, studentName: string, matric: string, email: string, phone: string) => base(`
    <h2>New Intern Assigned to ${company}</h2>
    <p>A new intern has been assigned to your organisation through the ACETEL Virtual Internship Management System.</p>
    <div class="info-box">
      <div class="info-row"><span class="info-label">Student Name</span><span class="info-value">${studentName}</span></div>
      <div class="info-row"><span class="info-label">Matric Number</span><span class="info-value">${matric}</span></div>
      <div class="info-row"><span class="info-label">Email</span><span class="info-value">${email}</span></div>
      <div class="info-row"><span class="info-label">Phone</span><span class="info-value">${phone}</span></div>
    </div>
    <p>The student will be submitting daily logbook entries which you are required to review and approve. You will receive notifications for each submission.</p>
    <p>Please ensure you designate an Industry-Based Supervisor for this intern.</p>
  `),

  logbookSubmitted: (supervisorName: string, studentName: string, entryDate: string, appUrl: string) => base(`
    <h2>Logbook Entry Submitted for Review</h2>
    <p>Dear ${supervisorName},</p>
    <p>Student <strong>${studentName}</strong> has submitted a logbook entry for <strong>${entryDate}</strong> and it is awaiting your review.</p>
    <a class="btn" href="${appUrl}">Review Logbook Entry</a>
  `),

  logbookApproved: (studentName: string, entryDate: string, comment: string, appUrl: string) => base(`
    <h2>Your Logbook Entry Has Been Approved</h2>
    <p>Dear ${studentName},</p>
    <p>Your logbook entry for <strong>${entryDate}</strong> has been approved by your supervisor.</p>
    ${comment ? `<div class="info-box"><strong>Supervisor Comment:</strong><p>${comment}</p></div>` : ''}
    <a class="btn" href="${appUrl}">View Your Logbook</a>
  `),

  logbookRejected: (studentName: string, entryDate: string, comment: string, appUrl: string) => base(`
    <h2>Logbook Entry Requires Revision</h2>
    <p>Dear ${studentName},</p>
    <p>Your logbook entry for <strong>${entryDate}</strong> has been returned for revision.</p>
    <div class="info-box"><strong>Supervisor Comment:</strong><p>${comment}</p></div>
    <p>Please update your entry and resubmit.</p>
    <a class="btn" href="${appUrl}">Update Logbook Entry</a>
  `),

  inactivityWarning: (name: string, days: number) => base(`
    <h2>Internship Activity Warning</h2>
    <p>Dear ${name},</p>
    <p>Our system has detected <strong>${days} consecutive days of inactivity</strong> on your internship logbook.</p>
    <p>Please log in immediately and update your daily entries to maintain compliance with ACETEL standards.</p>
  `),

  supervisorEscalation: (studentName: string, supervisorName: string, days: number) => base(`
    <h2>Urgent: Student Inactivity Escalation</h2>
    <p>Dear ${supervisorName},</p>
    <p>Student <strong>${studentName}</strong> has been inactive for <strong>${days} consecutive days</strong>.</p>
    <p>Please reach out to confirm their status at the workplace.</p>
  `),

  coordinatorEscalation: (studentName: string, coordName: string, days: number) => base(`
    <h2>High Priority: Missing Internship Reports</h2>
    <p>Dear ${coordName},</p>
    <p>Student <strong>${studentName}</strong> has reached <strong>${days} days</strong> of non-submission.</p>
    <p>Further action may be required according to institutional policy.</p>
  `),

  missingWeeklySubmission: (name: string) => base(`
    <h2>Missing Weekly Submission</h2>
    <p>Dear ${name},</p>
    <p>Your weekly logbook submission is overdue. This has been escalated to your Programme Coordinator.</p>
    <p>Please submit your entries immediately for supervisor review.</p>
  `),

  feedbackResponse: (name: string, subject: string, response: string, appUrl?: string) => base(`
    <h2>Response to Your Feedback</h2>
    <p>Dear ${name},</p>
    <p>Your feedback regarding <strong>${subject}</strong> has received a response:</p>
    <div class="info-box"><p>${response}</p></div>
    <p>Thank you for helping us improve ACETEL VIMS.</p>
  `),

  feedbackReply: (name: string, subject: string, reply?: string) => base(`
    <h2>Feedback Update</h2>
    <p>Dear ${name},</p>
    <p>There is an update on your feedback: <strong>${subject}</strong></p>
    ${reply ? `<div class="info-box"><p>${reply}</p></div>` : ''}
    <p>Log in to ACETEL VIMS to view your feedback thread.</p>
  `),

  feedbackClosed: (name: string, subject: string) => base(`
    <h2>Feedback Resolved</h2>
    <p>Dear ${name},</p>
    <p>Your feedback regarding <strong>${subject}</strong> has been marked as resolved.</p>
    <p>Thank you for your contribution to improving ACETEL VIMS.</p>
  `),

  chatMessage: (name: string, senderName: string, message: string, appUrl: string) => base(`
    <h2>New Message from ${senderName}</h2>
    <p>Dear ${name},</p>
    <div class="info-box"><p>${message}</p></div>
    <a class="btn" href="${appUrl}">Reply in ACETEL VIMS</a>
  `),

  chatNotification: (name: string, roomName: string, appUrl: string) => base(`
    <h2>New Activity in ${roomName}</h2>
    <p>Dear ${name}, there is new activity in your chat room.</p>
    <a class="btn" href="${appUrl}">Open Chat</a>
  `),
};
