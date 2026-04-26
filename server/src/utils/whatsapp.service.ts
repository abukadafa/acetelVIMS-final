export async function sendWhatsAppMessage(phone: string, message: string): Promise<boolean> {
  try {
    // Production: integrate with Twilio or Meta WhatsApp Business API
    // Replace this block with actual API call using process.env.TWILIO_* or META_WA_* vars
    console.log(`[WHATSAPP OUTGOING] To: ${phone}\n${message}`);
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

  securityAlert: (name: string, detail: string) =>
`*ACETEL VIMS — Security Alert* 🛡️

Hello ${name},

An action was performed on your account:
*${detail}*

If this was not you, contact ICT Support immediately.

_ACETEL VIMS_`,
};
