const nodemailer = require('nodemailer');
const axios = require('axios');
const Lead = require('../models/Lead');
const User = require('../models/User');

/**
 * Format date-time for human readability
 */
const formatDateTime = (dateStr) => {
  if (!dateStr) return 'N/A';
  try {
    return new Date(dateStr).toLocaleString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } catch (e) {
    return dateStr;
  }
};

/**
 * Send email helper
 */
const sendEmail = async ({ to, subject, html }) => {
  if (!to) {
    console.log('[Notification Helper] No recipient email address provided.');
    return;
  }

  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT || 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || '"DIGIEX HRMS" <noreply@digiexweb.com>';

  if (!user || !pass) {
    console.log('\n--- [MOCK EMAIL LOG] ---');
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`Content:\n${html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()}`);
    console.log('------------------------\n');
    return;
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user, pass }
    });

    const info = await transporter.sendMail({
      from,
      to,
      subject,
      html
    });

    console.log(`[Notification Helper] Email sent successfully to ${to}: ${info.messageId}`);
  } catch (error) {
    console.error(`[Notification Helper] Error sending email to ${to}:`, error.message);
  }
};

/**
 * Send SMS helper
 */
const sendSMS = async ({ to, message }) => {
  if (!to) {
    console.log('[Notification Helper] No recipient phone number provided.');
    return;
  }

  const smsApiUrl = process.env.SMS_API_URL;
  const smsApiKey = process.env.SMS_API_KEY;
  const smsSenderId = process.env.SMS_SENDER_ID || 'DIGIEX';

  if (!smsApiUrl) {
    console.log('\n--- [MOCK SMS LOG] ---');
    console.log(`To: ${to}`);
    console.log(`Message: ${message}`);
    console.log('----------------------\n');
    return;
  }

  try {
    // Send a standard payload to SMS gateway.
    // Modify configuration/parameters based on the specific SMS vendor API (e.g. MSG91, Twilio).
    await axios.post(smsApiUrl, {
      apiKey: smsApiKey,
      sender: smsSenderId,
      to,
      message
    });
    console.log(`[Notification Helper] SMS sent successfully to ${to}`);
  } catch (error) {
    console.error(`[Notification Helper] Error sending SMS to ${to}:`, error.message);
  }
};

/**
 * Main trigger function for Lead notifications
 * @param {string} leadId - The ID of the lead
 * @param {('BDM_ASSIGNED'|'APPOINTMENT_FIXED'|'BOTH')} triggerType - Type of trigger
 */
const sendLeadNotifications = async (leadId, triggerType) => {
  try {
    const lead = await Lead.findById(leadId).populate('assignedSales');
    if (!lead) {
      console.error(`[Notification Helper] Lead not found: ${leadId}`);
      return;
    }

    const bdm = lead.assignedSales;
    const clientEmail = lead.email;
    const clientPhone = lead.phone;
    const clientName = lead.contactPerson || 'Client';
    const businessName = lead.businessName || 'Business';

    if (!bdm) {
      console.log(`[Notification Helper] No BDM assigned to lead: ${leadId}. Skipping BDM notifications.`);
      return;
    }

    const bdmName = bdm.name || 'BDM';
    const bdmEmail = bdm.email;
    const bdmPhone = bdm.phone || 'N/A';

    // Get latest appointment details if available
    const latestAppt = lead.appointmentHistory && lead.appointmentHistory[0];
    const apptDateStr = formatDateTime(latestAppt?.appointmentDate);
    const apptAddress = lead.address || 'N/A';
    const apptRemarks = latestAppt?.remarks || 'N/A';

    if (triggerType === 'BDM_ASSIGNED' || triggerType === 'BOTH') {
      // 1. Send BDM Assignment notification to BDM
      const bdmEmailSubject = `New Lead Assigned: ${businessName}`;
      const bdmEmailHtml = `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <h3 style="color: #2563eb;">Hello ${bdmName},</h3>
          <p>A new lead has been assigned to you in DIGIEX HRMS.</p>
          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 15px; border-radius: 8px; margin: 15px 0;">
            <table cellpadding="5" cellspacing="0">
              <tr><td><b>Business Name:</b></td><td>${businessName}</td></tr>
              <tr><td><b>Contact Person:</b></td><td>${clientName}</td></tr>
              <tr><td><b>Phone:</b></td><td>${clientPhone || 'N/A'}</td></tr>
              <tr><td><b>Email:</b></td><td>${clientEmail || 'N/A'}</td></tr>
              <tr><td><b>Location:</b></td><td>${lead.location || 'N/A'}</td></tr>
            </table>
          </div>
          <p>Please log in to your dashboard to review and contact the client.</p>
          <p>Best regards,<br/><b>DIGIEX HRMS Team</b></p>
        </div>
      `;
      const bdmSMSMessage = `Hello ${bdmName}, a new lead '${businessName}' (${clientName}, ${clientPhone}) has been assigned to you. Please check your dashboard. - DIGIEX`;

      await sendEmail({ to: bdmEmail, subject: bdmEmailSubject, html: bdmEmailHtml });
      await sendSMS({ to: bdmPhone, message: bdmSMSMessage });

      // 2. Send BDM Assignment notification to Client
      if (clientEmail || clientPhone) {
        const clientEmailSubject = `Your DIGIEX Account Executive Assigned`;
        const clientEmailHtml = `
          <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <h3 style="color: #2563eb;">Hello ${clientName},</h3>
            <p>Thank you for choosing DIGIEX. We have assigned a Business Development Manager to assist you with your requirements for <b>${businessName}</b>.</p>
            <p>Our representative, <b>${bdmName}</b>, will get in touch with you shortly. You can also contact them directly at:</p>
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 15px; border-radius: 8px; margin: 15px 0;">
              <table cellpadding="5" cellspacing="0">
                <tr><td><b>Name:</b></td><td>${bdmName}</td></tr>
                <tr><td><b>Phone:</b></td><td>${bdmPhone}</td></tr>
                <tr><td><b>Email:</b></td><td>${bdmEmail || 'N/A'}</td></tr>
              </table>
            </div>
            <p>We look forward to working with you.</p>
            <p>Thank you,<br/><b>DIGIEX Team</b></p>
          </div>
        `;
        const clientSMSMessage = `Hello ${clientName}, our representative ${bdmName} (${bdmPhone}) has been assigned to assist you with '${businessName}'. We will contact you soon. - DIGIEX`;

        await sendEmail({ to: clientEmail, subject: clientEmailSubject, html: clientEmailHtml });
        await sendSMS({ to: clientPhone, message: clientSMSMessage });
      }
    }

    if (triggerType === 'APPOINTMENT_FIXED' || triggerType === 'BOTH') {
      // 1. Send Appointment Fixed notification to BDM
      const bdmApptSubject = `Appointment Scheduled: ${businessName}`;
      const bdmApptHtml = `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <h3 style="color: #7c3aed;">Hello ${bdmName},</h3>
          <p>An appointment has been scheduled/fixed for lead <b>${businessName}</b>.</p>
          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 15px; border-radius: 8px; margin: 15px 0;">
            <table cellpadding="5" cellspacing="0">
              <tr><td><b>Business Name:</b></td><td>${businessName}</td></tr>
              <tr><td><b>Contact Person:</b></td><td>${clientName}</td></tr>
              <tr><td><b>Phone:</b></td><td>${clientPhone || 'N/A'}</td></tr>
              <tr><td><b>Date & Time:</b></td><td style="color: #7c3aed; font-weight: bold;">${apptDateStr}</td></tr>
              <tr><td><b>Address/Venue:</b></td><td>${apptAddress}</td></tr>
              <tr><td><b>Remarks:</b></td><td>${apptRemarks}</td></tr>
            </table>
          </div>
          <p>Please review details and prepare for the meeting.</p>
          <p>Best regards,<br/><b>DIGIEX HRMS Team</b></p>
        </div>
      `;
      const bdmApptSMS = `Hello ${bdmName}, appointment with '${businessName}' (${clientName}) is fixed on ${apptDateStr} at ${apptAddress}. - DIGIEX`;

      await sendEmail({ to: bdmEmail, subject: bdmApptSubject, html: bdmApptHtml });
      await sendSMS({ to: bdmPhone, message: bdmApptSMS });

      // 2. Send Appointment Fixed notification to Client
      if (clientEmail || clientPhone) {
        const clientApptSubject = `Appointment Confirmed - DIGIEX`;
        const clientApptHtml = `
          <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <h3 style="color: #7c3aed;">Hello ${clientName},</h3>
            <p>Your appointment with DIGIEX for <b>${businessName}</b> has been confirmed.</p>
            <p><b>Meeting Details:</b></p>
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 15px; border-radius: 8px; margin: 15px 0;">
              <table cellpadding="5" cellspacing="0">
                <tr><td><b>Representative:</b></td><td>${bdmName} (${bdmPhone})</td></tr>
                <tr><td><b>Date & Time:</b></td><td style="color: #7c3aed; font-weight: bold;">${apptDateStr}</td></tr>
                <tr><td><b>Address/Venue:</b></td><td>${apptAddress}</td></tr>
              </table>
            </div>
            <p>Our BDM will contact you at the scheduled time. If you need to make changes, please get in touch with us.</p>
            <p>Thank you,<br/><b>DIGIEX Team</b></p>
          </div>
        `;
        const clientApptSMS = `Hello ${clientName}, your appointment with DIGIEX for '${businessName}' is confirmed on ${apptDateStr} with representative ${bdmName} (${bdmPhone}). - DIGIEX`;

        await sendEmail({ to: clientEmail, subject: clientApptSubject, html: clientApptHtml });
        await sendSMS({ to: clientPhone, message: clientApptSMS });
      }
    }
  } catch (error) {
    console.error('[Notification Helper] Failed to process lead notifications:', error);
  }
};

module.exports = {
  sendLeadNotifications,
  sendSMS,
  sendEmail
};
