import dotenv from 'dotenv';
import logger from './logger';
dotenv.config();

/**
 * ACETEL VIMS - WhatsApp Service
 * Supports Twilio WhatsApp API (production) with console fallback (dev/missing creds).
 * To activate: add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM to Render ENV.
 */

const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_FROM = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886'; // Twilio sandbox default

function normalisedPhone(phone: string): string {
  // Strip spaces/dashes, ensure + prefix
  const clean = phone.replace(/[\s\-()]/g, '');
  return clean.startsWith('+') ? clean : `+${clean}`;
}

export async function sendWhatsAppMessage(phone: string, message: string): Promise<boolean> {
  const to = `whatsapp:${normalisedPhone(phone)}`;

  // Production path: Twilio WhatsApp API
  if (TWILIO_SID && TWILIO_TOKEN) {
    try {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`;
      const body = new URLSearchParams({
        To: to,
        From: TWILIO_FROM,
        Body: message,
      });

      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });

      if (resp.ok) {
        const data = await resp.json() as any;
        logger.info('📱 WhatsApp sent to %s | sid: %s', phone, data.sid);
        return true;
      } else {
        const err = await resp.json() as any;
        logger.error('❌ WhatsApp Twilio error: %s', err.message);
        return false;
      }
    } catch (error) {
      logger.error('❌ WhatsApp gateway error: %s', (error as Error).message);
      return false;
    }
  }

  // Dev / no-creds fallback: log to console
  logger.info(`
📱 [WHATSAPP SIMULATED - add Twilio creds to activate]
To: ${phone}
─────────────────────────────────────────
${message}
─────────────────────────────────────────
  `);
  return true;
}

export const whatsappTemplates = {
  placementSuccessful: (studentName: string, companyName: string, address: string, supervisorName: string) => `
*ACETEL IMS — Placement Confirmed* 🎓

Hello ${studentName}!

Your internship placement has been confirmed:

🏢 *Company:* ${companyName}
📍 *Location:* ${address}
👤 *Supervisor:* ${supervisorName}

Log in daily to record your activities:
${process.env.FRONTEND_URL}

_ACETEL Virtual Internship Management System_
`.trim(),

  logbookReminder: (studentName: string) => `
*ACETEL IMS — Daily Reminder* ✍️

Hello ${studentName},

Your logbook entry for today is pending. Please update your daily activities to stay compliant.

👉 ${process.env.FRONTEND_URL}/logbook

_This is an automated reminder._
`.trim(),

  inactivityAlert: (studentName: string, days: number) => `
*ACETEL IMS — Inactivity Warning* ⚠️

Hello ${studentName},

You have *${days} days of missed entries* on your internship logbook.

This may affect your academic record. Please log in immediately:
${process.env.FRONTEND_URL}/logbook

_ACETEL Monitoring System_
`.trim(),

  feedbackReply: (studentName: string, subject: string) => `
*ACETEL IMS — Support Update* 💬

Hello ${studentName},

Your feedback ticket *"${subject}"* has received a new response.

View the reply here:
${process.env.FRONTEND_URL}/feedback

_ACETEL Support Team_
`.trim(),

  securityAlert: (name: string, detail: string) => `
*ACETEL IMS — Security Alert* 🛡️

Hello ${name},

An administrative action was performed on your account:
*${detail}*

If this was not you, contact ICT Support immediately.

_ACETEL IMS Security_
`.trim(),

  chatNotification: (recipientName: string, senderName: string) => `
*ACETEL IMS — New Message* 💬

Hello ${recipientName},

*${senderName}* sent you a message on ACETEL IMS.

View & reply here:
${process.env.FRONTEND_URL}/chat

_ACETEL IMS_
`.trim(),
};
