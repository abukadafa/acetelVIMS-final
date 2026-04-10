import dotenv from 'dotenv';
dotenv.config();

/**
 * ACETEL VIMS - Institutional WhatsApp Simulator
 * In a production environment, this would integrate with Twilio or Meta WhatsApp Business API.
 */
export async function sendWhatsAppMessage(phone: string, message: string): Promise<boolean> {
  try {
    // Formatting for the logs to look realistic
    console.log(`
📱 [WHATSAPP OUTGOING]
To: ${phone}
--------------------------------------------------
${message}
--------------------------------------------------
✅ Message Handed Over to Gateway
    `);
    
    // In dev, we always return success. In prod, this would wait for the API response.
    return true;
  } catch (error) {
    console.error('❌ WhatsApp Gateway Error:', error);
    return false;
  }
}

export const whatsappTemplates = {
  placementSuccessful: (studentName: string, companyName: string, address: string, supervisorName: string) => `
*ACETEL VIMS - Internship Placement Successful* 🏢

Hello ${studentName}! 🎓

Institutional placement for your internship is complete. 🎊

*Assigned Company:* ${companyName}
*Location:* ${address}
*Supervisor:* ${supervisorName}

Please log in to the ACETEL IMS Mobile App to confirm your resumption and begin your daily biometric attendance. 📱

Congratulations on your placement!
_ACETEL Virtual Internship Management System_
  `,
  
  logbookReminder: (studentName: string) => `
*ACETEL VIMS - Daily Logbook Reminder* ✍️

Hello ${studentName}, 

Our system shows you haven't updated your logbook for yesterday. 

Please ensure all daily activities are recorded to avoid academic delay. 

Log in here: ${process.env.FRONTEND_URL || 'http://localhost:5173'}
  `,

  securityAlert: (studentName: string, detail: string) => `
*ACETEL VIMS - Automated Security Alert* 🛡️

Hello ${studentName}, 

An administrative action was performed on your account: 
*Action:* ${detail}

If this was not you, please contact the ACETEL ICT Support desk immediately.
  `
};
