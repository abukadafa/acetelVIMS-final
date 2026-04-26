import dotenv from 'dotenv';
import logger from './logger';
dotenv.config();

/**
 * ACETEL VIMS — WhatsApp Cloud API (Meta/Facebook) — 100% FREE
 *
 * Setup (one-time, ~15 minutes, no credit card):
 *  1. Go to https://developers.facebook.com → My Apps → Create App → Business
 *  2. Add "WhatsApp" product to your app
 *  3. In WhatsApp → Getting Started:
 *       - Copy "Phone number ID"  → WA_PHONE_NUMBER_ID
 *       - Copy "Temporary access token" → WA_ACCESS_TOKEN (or generate permanent one)
 *  4. Add both to Render ENV vars
 *  5. To use your own number (not the Meta test number):
 *       - Add a real phone number in WhatsApp → Phone Numbers
 *       - Apply for permanent token via System Users
 *
 * Free limits: 1,000 conversations/month on free tier — more than enough for ACETEL.
 */

const WA_PHONE_NUMBER_ID = process.env.WA_PHONE_NUMBER_ID;
const WA_ACCESS_TOKEN    = process.env.WA_ACCESS_TOKEN;
const WA_API_VERSION     = 'v20.0';

export function isWhatsAppConfigured(): boolean {
  return !!(WA_PHONE_NUMBER_ID && WA_ACCESS_TOKEN);
}

function normalisedPhone(phone: string): string {
  const clean = phone.replace(/[\s\-()]/g, '');
  // Remove leading 0 for Nigerian numbers and add country code
  if (clean.startsWith('0') && !clean.startsWith('+')) {
    return `+234${clean.substring(1)}`;
  }
  return clean.startsWith('+') ? clean : `+${clean}`;
}

export async function sendWhatsAppMessage(phone: string, message: string): Promise<boolean> {
  const cleanPhone = normalisedPhone(phone);

  // ── Production: Meta WhatsApp Cloud API ──────────────────────────────────
  if (isWhatsAppConfigured()) {
    try {
      const url = `https://graph.facebook.com/${WA_API_VERSION}/${WA_PHONE_NUMBER_ID}/messages`;

      const payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: cleanPhone,
        type: 'text',
        text: { preview_url: false, body: message },
      };

      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${WA_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await resp.json() as any;

      if (resp.ok && data.messages?.[0]?.id) {
        logger.info('📱 WhatsApp sent to %s | msgId: %s', cleanPhone, data.messages[0].id);
        return true;
      } else {
        logger.error('❌ WhatsApp API error: %s | code: %s', data?.error?.message || 'Unknown', data?.error?.code);
        return false;
      }
    } catch (error) {
      logger.error('❌ WhatsApp network error: %s', (error as Error).message);
      return false;
    }
  }

  // ── Dev fallback: log to console (shows exactly what would be sent) ───────
  logger.info('📱 [WHATSAPP — NOT CONFIGURED]\nTo: %s\n%s\n%s\n%s',
    cleanPhone,
    '─'.repeat(50),
    message,
    '─'.repeat(50)
  );
  return true;
}

// ── Test function called from admin UI ────────────────────────────────────────
export async function sendTestWhatsApp(phone: string): Promise<{ success: boolean; message: string; configured: boolean }> {
  const configured = isWhatsAppConfigured();

  if (!configured) {
    return {
      success: false,
      configured: false,
      message: 'WhatsApp not configured. Add WA_PHONE_NUMBER_ID and WA_ACCESS_TOKEN to your Render ENV vars.',
    };
  }

  const testMsg = `*ACETEL IMS — Test Message* ✅\n\nThis is a test notification from your ACETEL Virtual Internship Management System.\n\nIf you received this, WhatsApp notifications are working correctly!\n\n_Sent at ${new Date().toLocaleString('en-NG', { timeZone: 'Africa/Lagos' })} (WAT)_`;

  const ok = await sendWhatsAppMessage(phone, testMsg);
  return {
    success: ok,
    configured: true,
    message: ok
      ? `Test message sent successfully to ${normalisedPhone(phone)}`
      : 'Message failed to send. Check your WA_ACCESS_TOKEN and phone number.',
  };
}

// ── Message templates ─────────────────────────────────────────────────────────
export const whatsappTemplates = {
  placementSuccessful: (studentName: string, companyName: string, address: string, supervisorName: string) =>
`*ACETEL IMS — Placement Confirmed* 🎓

Hello ${studentName}!

Your internship placement has been confirmed:

🏢 *Company:* ${companyName}
📍 *Location:* ${address}
👤 *Supervisor:* ${supervisorName}

Log in daily to record your activities:
${process.env.FRONTEND_URL}

_ACETEL Virtual Internship Management System_`.trim(),

  logbookReminder: (studentName: string) =>
`*ACETEL IMS — Daily Reminder* ✍️

Hello ${studentName},

Your logbook entry for today is pending. Please update your daily activities to stay compliant.

👉 ${process.env.FRONTEND_URL}/logbook

_This is an automated reminder._`.trim(),

  inactivityAlert: (studentName: string, days: number) =>
`*ACETEL IMS — Inactivity Warning* ⚠️

Hello ${studentName},

You have *${days} days of missed entries* on your internship logbook.

This may affect your academic record. Please log in immediately:
${process.env.FRONTEND_URL}/logbook

_ACETEL Monitoring System_`.trim(),

  feedbackReply: (studentName: string, subject: string) =>
`*ACETEL IMS — Support Update* 💬

Hello ${studentName},

Your feedback ticket *"${subject}"* has received a new response.

View the reply here:
${process.env.FRONTEND_URL}/feedback

_ACETEL Support Team_`.trim(),

  securityAlert: (name: string, detail: string) =>
`*ACETEL IMS — Security Alert* 🛡️

Hello ${name},

An administrative action was performed on your account:
*${detail}*

If this was not you, contact ICT Support immediately.

_ACETEL IMS Security_`.trim(),

  chatNotification: (recipientName: string, senderName: string) =>
`*ACETEL IMS — New Message* 💬

Hello ${recipientName},

*${senderName}* sent you a message on ACETEL IMS.

View & reply here:
${process.env.FRONTEND_URL}/chat

_ACETEL IMS_`.trim(),
};
