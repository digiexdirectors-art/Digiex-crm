const nodemailer = require('nodemailer');
const Client = require('../models/Client');
const ClientPackage = require('../models/ClientPackage');
const EmailLog = require('../models/EmailLog');

/**
 * Sends a professional verification confirmation email to the client's registered address.
 * Run asynchronously in the background.
 */
exports.sendVerificationEmail = async (clientId) => {
  try {
    // 1. Fetch client data
    const client = await Client.findById(clientId);
    if (!client) {
      console.error(`[EmailHelper] Client ${clientId} not found`);
      return;
    }

    const recipientEmail = client.companyEmail || client.email;
    if (!recipientEmail) {
      console.warn(`[EmailHelper] No registered email for client ${client.companyName}`);
      return;
    }

    // 2. Fetch purchased packages/services with features
    const packages = await ClientPackage.find({ client: clientId });

    // 3. Format services HTML
    let servicesListHTML = '';
    if (packages && packages.length > 0) {
      packages.forEach(pkg => {
        const serviceName = pkg.services?.[0]?.name || pkg.package?.name || 'Custom Service';
        let featuresHTML = '';
        if (pkg.features && pkg.features.length > 0) {
          featuresHTML = '<ul style="margin: 5px 0; padding-left: 20px; color: #475569; font-size: 13px; line-height: 1.5;">';
          pkg.features.forEach(feat => {
            featuresHTML += `<li><strong>${feat.name}</strong>${feat.description ? ': ' + feat.description : ''} <span style="font-size: 11px; color: #94a3b8;">(${feat.status})</span></li>`;
          });
          featuresHTML += '</ul>';
        } else {
          featuresHTML = '<p style="margin: 5px 0; font-size: 13px; color: #94a3b8; font-style: italic;">No specific features registered.</p>';
        }
        servicesListHTML += `
          <div style="margin-bottom: 15px; padding: 12px; border: 1px solid #e2e8f0; border-radius: 8px; background: #f8fafc;">
            <h4 style="margin: 0 0 8px 0; color: #1e293b; font-size: 14px;">${serviceName} (Rs. ${(pkg.price || 0).toLocaleString('en-IN')})</h4>
            ${featuresHTML}
          </div>
        `;
      });
    } else {
      servicesListHTML = '<p style="color: #94a3b8; font-style: italic; font-size: 14px;">No purchased services currently registered.</p>';
    }

    // 4. Build professional email body
    const emailSubject = 'Your Business Profile Has Been Verified – Digiex Web Services';
    const verifiedOnStr = client.verificationDetails?.verifiedAt 
      ? new Date(client.verificationDetails.verifiedAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) 
      : new Date().toLocaleString('en-IN');

    const emailBodyHTML = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 16px; background: #ffffff; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
        <div style="text-align: center; margin-bottom: 20px;">
          <h2 style="color: #0f172a; margin: 0; font-size: 22px; border-bottom: 2px solid #10b981; padding-bottom: 10px;">Verification Confirmed</h2>
        </div>
        
        <p style="font-size: 15px; color: #334155; line-height: 1.5;">Dear ${client.contactPerson || client.name || 'Client'},</p>
        <p style="font-size: 15px; color: #334155; line-height: 1.5;">
          We are pleased to inform you that your business profile has been successfully verified by the Customer Care team at <strong>Digiex Web Services</strong>.
        </p>

        <h3 style="color: #1e293b; margin-top: 25px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; font-size: 16px;">Business Information</h3>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 14px; line-height: 1.6;">
          <tr>
            <td style="padding: 6px 0; color: #64748b; width: 35%;"><strong>Business Name:</strong></td>
            <td style="padding: 6px 0; color: #1e293b;">${client.companyName}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b;"><strong>Owner Name:</strong></td>
            <td style="padding: 6px 0; color: #1e293b;">${client.name}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b;"><strong>Contact Number:</strong></td>
            <td style="padding: 6px 0; color: #1e293b;">${client.phone || 'N/A'}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b;"><strong>WhatsApp Number:</strong></td>
            <td style="padding: 6px 0; color: #1e293b;">${client.whatsAppNumber || 'N/A'}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b;"><strong>Email:</strong></td>
            <td style="padding: 6px 0; color: #1e293b;">${recipientEmail}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b; vertical-align: top;"><strong>Business Address:</strong></td>
            <td style="padding: 6px 0; color: #1e293b;">
              ${client.addressLine1 || client.address || 'N/A'}${client.addressLine2 ? ', ' + client.addressLine2 : ''}${client.city ? ', ' + client.city : ''}${client.state ? ', ' + client.state : ''}${client.pinCode ? ' - ' + client.pinCode : ''}
            </td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b;"><strong>GST Number:</strong></td>
            <td style="padding: 6px 0; color: #1e293b;">${client.gstNumber || 'N/A'}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b;"><strong>Website URL:</strong></td>
            <td style="padding: 6px 0; color: #1e293b;">
              ${client.websiteUrl ? `<a href="${client.websiteUrl.startsWith('http') ? client.websiteUrl : 'https://' + client.websiteUrl}" target="_blank" style="color: #3b82f6; text-decoration: none;">${client.websiteUrl}</a>` : 'N/A'}
            </td>
          </tr>
        </table>

        <h3 style="color: #1e293b; margin-top: 25px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; font-size: 16px;">Purchased Services</h3>
        <div style="margin-bottom: 20px;">
          ${servicesListHTML}
        </div>

        <h3 style="color: #1e293b; margin-top: 25px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; font-size: 16px;">Verification Details</h3>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px; font-size: 14px; line-height: 1.6;">
          <tr>
            <td style="padding: 6px 0; color: #64748b; width: 35%;"><strong>Verified By:</strong></td>
            <td style="padding: 6px 0; color: #1e293b;">${client.verificationDetails?.verifiedBy || 'Customer Care Team'}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b;"><strong>Verification Date:</strong></td>
            <td style="padding: 6px 0; color: #1e293b;">${verifiedOnStr}</td>
          </tr>
        </table>

        <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; text-align: center; font-size: 13px; color: #64748b; line-height: 1.5;">
          <p style="margin: 0 0 5px 0;">Thank you for partnering with Digiex Web Services.</p>
          <p style="margin: 0;">For any support or query regarding your services, please reply to this email or reach us at <a href="mailto:support@digiexweb.com" style="color: #3b82f6; text-decoration: none;">support@digiexweb.com</a>.</p>
        </div>
      </div>
    `;

    // 5. Send using configured SMTP
    const host = process.env.SMTP_HOST || 'smtp.ethereal.email';
    const port = Number(process.env.SMTP_PORT) || 587;
    const secure = process.env.SMTP_SECURE === 'true';
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const from = process.env.SMTP_FROM || '"DIGIEX HRMS" <noreply@digiexweb.com>';

    let sendError = null;

    if (user && pass) {
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: { user, pass }
      });

      try {
        await transporter.sendMail({
          from,
          to: recipientEmail,
          subject: emailSubject,
          html: emailBodyHTML
        });
        console.log(`[EmailHelper] Verification email successfully sent to ${recipientEmail}`);
      } catch (err) {
        sendError = err;
        console.error(`[EmailHelper] Failed to send email via SMTP:`, err);
      }
    } else {
      // Mock sending (log to console as specified in .env comments)
      console.log('========================================================================');
      console.log(`[EmailHelper] (SMTP credentials missing - logging mail to console)`);
      console.log(`From: ${from}`);
      console.log(`To: ${recipientEmail}`);
      console.log(`Subject: ${emailSubject}`);
      console.log(`Body length: ${emailBodyHTML.length} bytes`);
      console.log('========================================================================');
    }

    // 6. Write to EmailLog
    const status = sendError ? 'Failed' : 'Sent';
    const emailLog = new EmailLog({
      client: clientId,
      recipient: recipientEmail,
      subject: emailSubject,
      body: emailBodyHTML,
      status,
      errorMessage: sendError ? sendError.message : undefined
    });
    await emailLog.save();

  } catch (globalErr) {
    console.error(`[EmailHelper] Unexpected error in sendVerificationEmail:`, globalErr);
  }
};

/**
 * Sends a verification request email containing full details and a clickable verification link token.
 */
exports.sendVerificationLinkEmail = async (clientId, token, originUrl = 'http://localhost:5173') => {
  try {
    const client = await Client.findById(clientId);
    if (!client) {
      console.error(`[EmailHelper] Client ${clientId} not found`);
      return { success: false, message: 'Client not found' };
    }

    const recipientEmail = client.companyEmail || client.email;
    if (!recipientEmail) {
      console.warn(`[EmailHelper] No registered email for client ${client.companyName}`);
      return { success: false, message: 'Client has no registered email' };
    }

    const packages = await ClientPackage.find({ client: clientId });

    let servicesListHTML = '';
    if (packages && packages.length > 0) {
      packages.forEach(pkg => {
        const serviceName = pkg.services?.[0]?.name || pkg.packageName || pkg.package?.name || 'Custom Service';
        let featuresHTML = '';
        if (pkg.features && pkg.features.length > 0) {
          featuresHTML = '<ul style="margin: 5px 0; padding-left: 20px; color: #475569; font-size: 13px; line-height: 1.5;">';
          pkg.features.forEach(feat => {
            featuresHTML += `<li><strong>${feat.name}</strong>${feat.description ? ': ' + feat.description : ''}</li>`;
          });
          featuresHTML += '</ul>';
        } else {
          featuresHTML = '<p style="margin: 5px 0; font-size: 13px; color: #94a3b8; font-style: italic;">Standard Service Package</p>';
        }
        servicesListHTML += `
          <div style="margin-bottom: 12px; padding: 12px; border: 1px solid #e2e8f0; border-radius: 8px; background: #f8fafc;">
            <h4 style="margin: 0 0 6px 0; color: #1e293b; font-size: 14px;">${serviceName} (Rs. ${(pkg.total || pkg.price || 0).toLocaleString('en-IN')})</h4>
            ${featuresHTML}
          </div>
        `;
      });
    } else {
      servicesListHTML = '<p style="color: #94a3b8; font-style: italic; font-size: 14px;">No active purchased services currently registered.</p>';
    }

    const verificationUrl = `${originUrl.replace(/\/$/, '')}/verify-client-email?token=${token}`;
    const emailSubject = `Action Required: Verify Your Business Details – ${client.companyName}`;

    const emailBodyHTML = `
      <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 16px; background: #ffffff; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.05);">
        <div style="text-align: center; margin-bottom: 25px; background: #059669; padding: 20px; border-radius: 12px; color: #ffffff;">
          <h2 style="margin: 0; font-size: 24px; font-weight: 700;">Digiex Web Services</h2>
          <p style="margin: 6px 0 0 0; font-size: 14px; opacity: 0.9;">Business Profile Verification Request</p>
        </div>
        
        <p style="font-size: 15px; color: #334155; line-height: 1.6;">Dear <strong>${client.contactPerson || client.name || 'Client'}</strong>,</p>
        <p style="font-size: 15px; color: #334155; line-height: 1.6;">
          Please review and verify your registered business details below. Click the green verification button to confirm and complete your profile verification.
        </p>

        <!-- VERIFICATION CALL TO ACTION BUTTON -->
        <div style="text-align: center; margin: 30px 0; padding: 20px; background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 12px;">
          <p style="margin: 0 0 14px 0; font-size: 14px; font-weight: 600; color: #065f46;">Please click below to confirm your profile verification:</p>
          <a href="${verificationUrl}" target="_blank" style="background-color: #059669; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 15px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(5, 150, 105, 0.3);">
            ✔ Verify & Confirm Details
          </a>
          <p style="margin: 12px 0 0 0; font-size: 12px; color: #047857;">Or copy and paste this link in your browser:<br/><a href="${verificationUrl}" style="color: #059669; word-break: break-all;">${verificationUrl}</a></p>
        </div>

        <h3 style="color: #1e293b; margin-top: 25px; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; font-size: 16px;">Registered Business Information</h3>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 14px; line-height: 1.6;">
          <tr>
            <td style="padding: 8px 0; color: #64748b; width: 38%;"><strong>Company / Business Name:</strong></td>
            <td style="padding: 8px 0; color: #1e293b; font-weight: 600;">${client.companyName}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b;"><strong>Primary Contact Person:</strong></td>
            <td style="padding: 8px 0; color: #1e293b;">${client.name} ${client.designation ? `(${client.designation})` : ''}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b;"><strong>Mobile Number:</strong></td>
            <td style="padding: 8px 0; color: #1e293b;">${client.phone || 'N/A'}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b;"><strong>Email Address:</strong></td>
            <td style="padding: 8px 0; color: #1e293b;">${recipientEmail}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b; vertical-align: top;"><strong>Business Address:</strong></td>
            <td style="padding: 8px 0; color: #1e293b;">
              ${client.addressLine1 || client.address || 'N/A'}${client.addressLine2 ? ', ' + client.addressLine2 : ''}${client.city ? ', ' + client.city : ''}${client.state ? ', ' + client.state : ''}${client.pinCode ? ' - ' + client.pinCode : ''}
            </td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b;"><strong>GST Number:</strong></td>
            <td style="padding: 8px 0; color: #1e293b;">${client.gstNumber || 'N/A'}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b;"><strong>PAN Number:</strong></td>
            <td style="padding: 8px 0; color: #1e293b;">${client.panNumber || 'N/A'}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b;"><strong>Website URL:</strong></td>
            <td style="padding: 8px 0; color: #1e293b;">${client.websiteUrl || 'N/A'}</td>
          </tr>
        </table>

        <h3 style="color: #1e293b; margin-top: 25px; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; font-size: 16px;">Purchased Services Overview</h3>
        <div style="margin-bottom: 25px;">
          ${servicesListHTML}
        </div>

        <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; text-align: center; font-size: 13px; color: #64748b; line-height: 1.5;">
          <p style="margin: 0 0 5px 0;">If any of the above information requires modification, please contact Customer Care.</p>
          <p style="margin: 0;">Support Email: <a href="mailto:support@digiexweb.com" style="color: #059669; text-decoration: none;">support@digiexweb.com</a></p>
        </div>
      </div>
    `;

    const host = process.env.SMTP_HOST || 'smtp.ethereal.email';
    const port = Number(process.env.SMTP_PORT) || 587;
    const secure = process.env.SMTP_SECURE === 'true';
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const from = process.env.SMTP_FROM || '"DIGIEX HRMS" <noreply@digiexweb.com>';

    let sendError = null;

    if (user && pass) {
      const transporter = nodemailer.createTransport({ host, port, secure, auth: { user, pass } });
      try {
        await transporter.sendMail({ from, to: recipientEmail, subject: emailSubject, html: emailBodyHTML });
        console.log(`[EmailHelper] Verification link email sent to ${recipientEmail}`);
      } catch (err) {
        sendError = err;
        console.error(`[EmailHelper] Failed to send email via SMTP:`, err);
      }
    } else {
      console.log('========================================================================');
      console.log(`[EmailHelper] CLIENT VERIFICATION LINK EMAIL LOGGED TO CONSOLE`);
      console.log(`To: ${recipientEmail}`);
      console.log(`Subject: ${emailSubject}`);
      console.log(`Verification URL: ${verificationUrl}`);
      console.log('========================================================================');
    }

    const emailLog = new EmailLog({
      client: clientId,
      recipient: recipientEmail,
      subject: emailSubject,
      body: emailBodyHTML,
      status: sendError ? 'Failed' : 'Sent',
      errorMessage: sendError ? sendError.message : undefined
    });
    await emailLog.save();

    return { success: !sendError, recipientEmail, verificationUrl };
  } catch (err) {
    console.error(`[EmailHelper] Error in sendVerificationLinkEmail:`, err);
    return { success: false, message: err.message };
  }
};
