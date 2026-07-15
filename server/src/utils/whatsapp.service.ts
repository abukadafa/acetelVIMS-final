import logger from './logger';

function normalizeToE164Like(input: string): string {
  // Keep digits only; Meta expects international format digits, Twilio works with +.
  let digits = String(input || '').replace(/[^\d]/g, '');
  if (!digits) return '';

  // Common local input handling (default country code fallback for local numbers)
  // Example: 08012345678 -> 2348012345678 (default NG)
  const defaultCountry = (process.env.DEFAULT_COUNTRY_CODE || '234').replace(/[^\d]/g, '');
  if (digits.startsWith('0') && digits.length >= 10 && defaultCountry) {
    digits = `${defaultCountry}${digits.slice(1)}`;
  }

  return digits;
}

type WaProvider = 'meta' | 'twilio' | 'none';

/** Which provider (if any) is configured via environment variables. */
export function getWhatsAppProvider(): WaProvider {
  if (process.env.WA_PHONE_NUMBER_ID && process.env.WA_ACCESS_TOKEN) return 'meta';
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_WHATSAPP_FROM) return 'twilio';
  return 'none';
}

export function isWhatsAppConfigured(): boolean {
  return getWhatsAppProvider() !== 'none';
}

let lastWhatsAppError: string | null = null;
export function getLastWhatsAppError(): string | null {
  return lastWhatsAppError;
}

/**
 * Sends a WhatsApp message via Meta Cloud API or Twilio, whichever is
 * configured. IMPORTANT: previously, when NEITHER provider was configured,
 * this function logged a "simulated" message and returned `true` — meaning
 * every caller (staff/student welcome messages, placement notices, logbook
 * reminders, etc.) believed the message had been delivered even though
 * nothing was actually sent, in every environment including production.
 * That is the root cause of "WhatsApp is not working" being invisible to
 * admins. Now: outside production, sends are simulated (logged) and clearly
 * reported as NOT delivered; in production, an unconfigured provider is
 * always reported as a failed send with a descriptive error.
 */
export async function sendWhatsAppMessage(phone: string, message: string): Promise<boolean> {
  try {
    const toDigits = normalizeToE164Like(phone);
    if (!toDigits) {
      lastWhatsAppError = `Invalid/empty phone number: "${phone}"`;
      logger.warn('WhatsApp skipped: %s', lastWhatsAppError);
      return false;
    }

    const provider = getWhatsAppProvider();

    // Option A: Meta WhatsApp Cloud API
    if (provider === 'meta') {
      const url = `https://graph.facebook.com/v19.0/${process.env.WA_PHONE_NUMBER_ID}/messages`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.WA_ACCESS_TOKEN}`,
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: toDigits,
          type: 'text',
          text: { body: message },
        }),
      });
      if (!resp.ok) {
        const body = await resp.text().catch(() => '');
        lastWhatsAppError = `Meta API ${resp.status}: ${body}`;
        logger.error('WhatsApp(Meta) failed: %s', lastWhatsAppError);
        return false;
      }
      lastWhatsAppError = null;
      return true;
    }

    // Option B: Twilio WhatsApp (no SDK required)
    if (provider === 'twilio') {
      const sid = process.env.TWILIO_ACCOUNT_SID!;
      const token = process.env.TWILIO_AUTH_TOKEN!;
      const from = process.env.TWILIO_WHATSAPP_FROM!;
      const auth = Buffer.from(`${sid}:${token}`).toString('base64');
      const form = new URLSearchParams();
      form.set('From', from.startsWith('whatsapp:') ? from : `whatsapp:${from}`);
      form.set('To', `whatsapp:+${toDigits}`);
      form.set('Body', message);

      const resp = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: form.toString(),
      });
      if (!resp.ok) {
        const body = await resp.text().catch(() => '');
        lastWhatsAppError = `Twilio API ${resp.status}: ${body}`;
        logger.error('WhatsApp(Twilio) failed: %s', lastWhatsAppError);
        return false;
      }
      lastWhatsAppError = null;
      return true;
    }

    // No provider configured.
    if (process.env.NODE_ENV === 'production') {
      lastWhatsAppError = 'WhatsApp is not configured (missing WA_PHONE_NUMBER_ID/WA_ACCESS_TOKEN or TWILIO_* env vars)';
      logger.warn('WhatsApp send skipped — %s. To: %s', lastWhatsAppError, phone);
      return false;
    }

    // Development/staging convenience only: log instead of sending, and say so honestly.
    logger.info('[WHATSAPP SIMULATED — dev only, NOT delivered] To: %s\n%s', phone, message);
    lastWhatsAppError = 'WhatsApp not configured — message only simulated in logs (non-production)';
    return false;
  } catch (error) {
    lastWhatsAppError = (error as Error).message;
    logger.error('WhatsApp error: %s', lastWhatsAppError);
    return false;
  }
}

const appUrl = process.env.FRONTEND_URL || 'https://acetel-vims.onrender.com';

export const whatsappTemplates = {

  welcomeStudent: (name: string, email: string, password: string, url: string, company: string) =>
`*Welcome to ACETEL VIMS* 🎓

Hello ${name}!

Your Virtual Internship account is ready.

*Login Email:* ${email}
*Password:* ${password}
*Placed At:* ${company}
*Portal:* ${url}

⚠️ Please change your password after first login.
Log your daily activities and mark biometric attendance every working day.

_ACETEL Virtual Internship Management System_`,

  welcomeStaff: (name: string, email: string, password: string, role: string, url: string) =>
`*Welcome to ACETEL VIMS* 🏛️

Hello ${name}!

Your staff account has been created.

*Role:* ${role.replace(/_/g, ' ').toUpperCase()}
*Email:* ${email}
*Password:* ${password}
*Portal:* ${url}

Please log in and change your password immediately.

_ACETEL Virtual Internship Management System_`,

  placementSuccessful: (name: string, company: string, address: string, supervisor: string) =>
`*ACETEL VIMS — Placement Confirmed* 🏢

Hello ${name}!

You have been placed at *${company}*.
📍 Location: ${address}
👤 Supervisor: ${supervisor}

Log in to confirm your resumption and begin daily attendance.
${appUrl}

_ACETEL VIMS_`,

  partnerPlacementNotice: (company: string, studentName: string, matric: string, email: string, phone: string) =>
`*ACETEL VIMS — New Intern Assigned* 🏢

Hello ${company} team,

A new intern has been assigned to your organisation:
*Name:* ${studentName}
*Matric:* ${matric}
*Email:* ${email}
*Phone:* ${phone}

Please log in to ACETEL VIMS to assign a supervisor and confirm the placement.
${appUrl}

_ACETEL VIMS_`,

  logbookReminder: (name: string) =>
`*ACETEL VIMS — Logbook Reminder* ✍️

Hello ${name},

Your daily logbook entry is overdue. Please update it now to avoid escalation.

${appUrl}

_ACETEL VIMS_`,

  logbookSubmitted: (supervisorName: string, studentName: string, date: string) =>
`*ACETEL VIMS — Logbook Review Required* 📋

Hello ${supervisorName},

${studentName} has submitted a logbook entry for *${date}* awaiting your review.

${appUrl}

_ACETEL VIMS_`,

  logbookReviewed: (studentName: string, status: string, date: string) =>
`*ACETEL VIMS — Logbook ${status}* ${status === 'Approved' ? '✅' : '⚠️'}

Hello ${studentName},

Your logbook entry for *${date}* has been *${status}* by your supervisor.

Log in to view feedback.
${appUrl}

_ACETEL VIMS_`,

  chatNotification: (name: string, sender: string, message: string) =>
`*ACETEL VIMS — New Message* 💬

Hello ${name},

New message from *${sender}*:
"${message}"

${appUrl}

_ACETEL VIMS_`,

  feedbackReply: (name: string, subject: string, reply: string) =>
`*ACETEL VIMS — Feedback Update* 📋

Hello ${name},

Your feedback on "${subject}" has been updated:
"${reply}"

${appUrl}

_ACETEL VIMS_`,

  securityAlert: (name: string, detail: string) =>
`*ACETEL VIMS — Security Alert* 🛡️

Hello ${name},

An action was performed on your account:
*${detail}*

If this was not you, contact ICT Support immediately.

_ACETEL VIMS_`,
};
