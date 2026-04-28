function normalizeToE164Like(input: string): string {
  // Keep digits only; Meta expects international format digits, Twilio works with +.
  const digits = String(input || '').replace(/[^\d]/g, '');
  return digits;
}

export async function sendWhatsAppMessage(phone: string, message: string): Promise<boolean> {
  try {
    const toDigits = normalizeToE164Like(phone);
    if (!toDigits) return false;

    // Option A: Meta WhatsApp Cloud API
    if (process.env.WA_PHONE_NUMBER_ID && process.env.WA_ACCESS_TOKEN) {
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
        console.error('WhatsApp(Meta) failed:', resp.status, body);
        return false;
      }
      return true;
    }

    // Option B: Twilio WhatsApp (no SDK required)
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_WHATSAPP_FROM) {
      const sid = process.env.TWILIO_ACCOUNT_SID;
      const token = process.env.TWILIO_AUTH_TOKEN;
      const from = process.env.TWILIO_WHATSAPP_FROM;
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
        console.error('WhatsApp(Twilio) failed:', resp.status, body);
        return false;
      }
      return true;
    }

    // Fallback: simulated (dev)
    console.log(`[WHATSAPP OUTGOING - SIMULATED] To: ${phone}\n${message}`);
    return true;
  } catch (error) {
    console.error('WhatsApp error:', error);
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

// Additional templates used by chat and feedback controllers
export const emailTemplates = { ...whatsappTemplates }; // re-export alias if needed
