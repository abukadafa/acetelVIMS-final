import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import logger from './logger';
dotenv.config();


// SMTP INJECTION GUARD — strip CR/LF/TAB from addresses and subject lines
// Prevents SMTP header injection attacks (CVE-2023 nodemailer variants)
function sanitiseEmailAddress(addr: string): string {
  return addr.replace(/\r|\n|\t/g, '').trim();
}
function sanitiseSubject(subject: string): string {
  return subject.replace(/\r|\n/g, ' ').trim().substring(0, 998);
}

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const BASE_STYLE = `
  font-family: 'Segoe UI', Arial, sans-serif;
  background: #f4f6f9;
  margin: 0; padding: 0;
`;

const CARD_STYLE = `
  max-width: 600px; margin: 32px auto; background: #ffffff;
  border-radius: 12px; overflow: hidden;
  box-shadow: 0 4px 24px rgba(0,0,0,0.08);
`;

const HEADER_HTML = `
  <div style="background: linear-gradient(135deg, #0a5c36 0%, #147a4a 100%); padding: 32px 40px; text-align: center;">
    <h1 style="color: #ffffff; margin: 0; font-size: 22px; letter-spacing: 0.5px;">ACETEL IMS</h1>
    <p style="color: rgba(255,255,255,0.8); margin: 6px 0 0; font-size: 13px;">
      African Centre of Excellence for Technology Enhanced Learning
    </p>
  </div>
`;

const FOOTER_HTML = `
  <div style="background: #f9fafb; padding: 20px 40px; text-align: center; border-top: 1px solid #eee;">
    <p style="color: #999; font-size: 11px; margin: 0;">
      © ${new Date().getFullYear()} ACETEL Virtual Internship Management System · National Open University of Nigeria
    </p>
    <p style="color: #bbb; font-size: 10px; margin: 4px 0 0;">
      This is an automated message. Please do not reply directly to this email.
    </p>
  </div>
`;

function wrap(content: string): string {
  return `<html><body style="${BASE_STYLE}"><div style="${CARD_STYLE}">${HEADER_HTML}<div style="padding:32px 40px;">${content}</div>${FOOTER_HTML}</div></body></html>`;
}

export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  try {
    const safeTo      = sanitiseEmailAddress(to);
    const safeSubject = sanitiseSubject(subject);
    // Basic email format check before sending
    if (!safeTo.includes('@') || !safeTo.includes('.') || safeTo.length < 5) {
      logger.warn('sendEmail: invalid address skipped: %s', to);
      return false;
    }
    const info = await transporter.sendMail({
      from: `"ACETEL IMS" <${process.env.SMTP_USER}>`,
      to: safeTo,
      subject: safeSubject,
      html,
    });
    logger.info('📧 Email sent to %s | id: %s', to, info.messageId);
    return true;
  } catch (error) {
    logger.error('❌ Email failed to %s: %s', to, (error as Error).message);
    return false;
  }
}

export const emailTemplates = {
  welcomeAdmin: (name: string) => wrap(`
    <h2 style="color:#0a5c36;margin-top:0;">Welcome, ${name} 👋</h2>
    <p>Your ACETEL IMS administrator account is active and ready.</p>
    <p>You have full institutional access to manage students, staff, companies, and system settings.</p>
    <a href="${process.env.FRONTEND_URL}" style="display:inline-block;margin-top:16px;padding:12px 28px;background:#0a5c36;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">
      Access Dashboard →
    </a>
  `),

  passwordReset: (name: string, token: string) => wrap(`
    <h2 style="color:#0a5c36;margin-top:0;">Password Reset Request</h2>
    <p>Dear ${name},</p>
    <p>We received a request to reset your ACETEL IMS password. Click the button below within <strong>1 hour</strong>:</p>
    <div style="text-align:center;margin:28px 0;">
      <a href="${process.env.FRONTEND_URL}/reset?token=${token}" style="display:inline-block;padding:14px 32px;background:#0a5c36;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">
        Reset My Password
      </a>
    </div>
    <p style="color:#888;font-size:13px;">If you did not request this, please ignore this email — your account remains secure.</p>
  `),

  newAccountStaff: (name: string, email: string, tempPassword: string, role: string) => wrap(`
    <h2 style="color:#0a5c36;margin-top:0;">Your ACETEL IMS Account is Ready</h2>
    <p>Dear ${name},</p>
    <p>An account has been created for you on the ACETEL Virtual Internship Management System as <strong>${role.replace(/_/g, ' ')}</strong>.</p>
    <div style="background:#f0f7f3;border-left:4px solid #0a5c36;border-radius:8px;padding:20px;margin:20px 0;">
      <p style="margin:0 0 8px;font-size:14px;"><strong>Login Email:</strong> ${email}</p>
      <p style="margin:0;font-size:14px;"><strong>Temporary Password:</strong> <code style="background:#e0efe8;padding:2px 8px;border-radius:4px;">${tempPassword}</code></p>
    </div>
    <p style="color:#e53e3e;font-size:13px;">⚠️ Please change your password immediately after first login.</p>
    <a href="${process.env.FRONTEND_URL}/login" style="display:inline-block;margin-top:16px;padding:12px 28px;background:#0a5c36;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">
      Login Now →
    </a>
  `),

  studentRegistered: (name: string, matricNumber: string) => wrap(`
    <h2 style="color:#0a5c36;margin-top:0;">Registration Successful 🎓</h2>
    <p>Dear ${name},</p>
    <p>Your student account has been created on the ACETEL IMS. Your matric number <strong>${matricNumber}</strong> is your portal login ID.</p>
    <p>Once your placement is confirmed, you will receive further instructions via this email and WhatsApp.</p>
    <a href="${process.env.FRONTEND_URL}/login" style="display:inline-block;margin-top:16px;padding:12px 28px;background:#0a5c36;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">
      Access Your Portal →
    </a>
  `),

  placementConfirmed: (studentName: string, companyName: string, address: string, supervisorName: string, supervisorEmail: string) => wrap(`
    <h2 style="color:#0a5c36;margin-top:0;">🏢 Internship Placement Confirmed!</h2>
    <p>Dear ${studentName},</p>
    <p>Your internship placement has been officially confirmed. Here are your placement details:</p>
    <div style="background:#f0f7f3;border-radius:8px;padding:20px;margin:20px 0;">
      <p style="margin:0 0 8px;"><strong>🏢 Company:</strong> ${companyName}</p>
      <p style="margin:0 0 8px;"><strong>📍 Address:</strong> ${address}</p>
      <p style="margin:0;"><strong>👤 Supervisor:</strong> ${supervisorName} (${supervisorEmail})</p>
    </div>
    <p>Please resume on the agreed date and log in daily to record your internship activities.</p>
    <a href="${process.env.FRONTEND_URL}" style="display:inline-block;margin-top:16px;padding:12px 28px;background:#0a5c36;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">
      Start Logging Activities →
    </a>
  `),

  feedbackResponse: (studentName: string, subject: string, responderName: string, responseMessage: string) => wrap(`
    <h2 style="color:#0a5c36;margin-top:0;">💬 New Response on Your Feedback</h2>
    <p>Dear ${studentName},</p>
    <p>You have a new response on your support ticket: <strong>"${subject}"</strong></p>
    <div style="background:#f9fafb;border-left:4px solid #0a5c36;border-radius:8px;padding:20px;margin:20px 0;">
      <p style="margin:0 0 4px;font-size:13px;color:#888;"><strong>${responderName}</strong> responded:</p>
      <p style="margin:0;font-size:15px;line-height:1.6;">${responseMessage}</p>
    </div>
    <a href="${process.env.FRONTEND_URL}/feedback" style="display:inline-block;margin-top:16px;padding:12px 28px;background:#0a5c36;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">
      View Full Conversation →
    </a>
  `),

  feedbackClosed: (studentName: string, subject: string) => wrap(`
    <h2 style="color:#0a5c36;margin-top:0;">✅ Support Ticket Resolved</h2>
    <p>Dear ${studentName},</p>
    <p>Your support ticket <strong>"${subject}"</strong> has been marked as resolved.</p>
    <p>If your issue persists, please open a new ticket via the Feedback Portal.</p>
    <a href="${process.env.FRONTEND_URL}/feedback" style="display:inline-block;margin-top:16px;padding:12px 28px;background:#0a5c36;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">
      Open New Ticket
    </a>
  `),

  inactivityWarning: (name: string, days: number) => wrap(`
    <h2 style="color:#c05200;margin-top:0;">⚠️ Internship Activity Warning</h2>
    <p>Dear ${name},</p>
    <p>Our monitoring system detected <strong>${days} days of inactivity</strong> on your internship logbook.</p>
    <p>Failure to maintain regular entries may affect your academic record. Please log in immediately to update your activities.</p>
    <a href="${process.env.FRONTEND_URL}/logbook" style="display:inline-block;margin-top:16px;padding:12px 28px;background:#c05200;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">
      Update My Logbook →
    </a>
  `),

  supervisorEscalation: (studentName: string, supervisorName: string, days: number) => wrap(`
    <h2 style="color:#c05200;margin-top:0;">🚨 Student Inactivity Alert</h2>
    <p>Dear ${supervisorName},</p>
    <p>Student <strong>${studentName}</strong> has been inactive for <strong>${days} consecutive days</strong> on the ACETEL IMS.</p>
    <p>As their Industry Supervisor, please reach out to confirm their status at the workplace.</p>
    <a href="${process.env.FRONTEND_URL}" style="display:inline-block;margin-top:16px;padding:12px 28px;background:#0a5c36;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">
      View Student →
    </a>
  `),

  coordinatorEscalation: (studentName: string, coordName: string, days: number) => wrap(`
    <h2 style="color:#c00000;margin-top:0;">🔴 High Priority: Student Non-Compliance</h2>
    <p>Dear Coordinator ${coordName},</p>
    <p>Student <strong>${studentName}</strong> has reached <strong>${days} days</strong> of non-submission. Their risk level has been elevated.</p>
    <p>Institutional intervention may be required per ACETEL policy.</p>
    <a href="${process.env.FRONTEND_URL}/all-students" style="display:inline-block;margin-top:16px;padding:12px 28px;background:#c00000;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">
      Review Student Profile →
    </a>
  `),

  chatMessage: (recipientName: string, senderName: string, preview: string, chatLink: string) => wrap(`
    <h2 style="color:#0a5c36;margin-top:0;">💬 New Chat Message</h2>
    <p>Dear ${recipientName},</p>
    <p><strong>${senderName}</strong> sent you a message on ACETEL IMS:</p>
    <div style="background:#f0f7f3;border-left:4px solid #0a5c36;border-radius:8px;padding:16px 20px;margin:20px 0;font-style:italic;color:#333;">
      "${preview.length > 200 ? preview.substring(0, 197) + '...' : preview}"
    </div>
    <a href="${chatLink}" style="display:inline-block;margin-top:16px;padding:12px 28px;background:#0a5c36;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">
      Reply in Chat →
    </a>
  `),
};
