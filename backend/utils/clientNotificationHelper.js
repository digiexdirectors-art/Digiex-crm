const User = require('../models/User');
const Notification = require('../models/Notification');
const Client = require('../models/Client');

/**
 * Triggers a notification for Customer Care Executives when a new client is added to the system.
 * Attaches the assigned Customer Care Executive profile to the client and notification message.
 */
async function notifyCustomerCareNewClient(client, creatorUser) {
  try {
    if (!client) return;

    // 1. Fetch Customer Care Executive users
    const allUsers = await User.find({ employmentStatus: { $ne: 'Terminated' } }).populate('role');
    const ccUsers = allUsers.filter(u => {
      const rName = (typeof u.role === 'object' ? u.role?.name : (u.role || '')).toLowerCase();
      return rName.includes('customer care') || rName.includes('customer support') || rName.includes('support');
    });

    const primaryCC = ccUsers.length > 0 ? ccUsers[0] : null;

    // 2. Assign Customer Care Executive to client if not already assigned
    if (primaryCC && !client.assignedCustomerCareExecutive) {
      await Client.findByIdAndUpdate(client._id, {
        assignedCustomerCareExecutive: primaryCC._id
      });
    }

    const ccProfileText = primaryCC
      ? `Customer Care Executive Profile: ${primaryCC.name} (Emp ID: ${primaryCC.employeeId || 'N/A'}, Email: ${primaryCC.email}${primaryCC.phone ? ', Mobile: ' + primaryCC.phone : ''})`
      : 'Customer Care Team Assigned';

    const clientName = client.companyName || client.name || 'New Client';
    const contactPerson = client.name || 'N/A';
    const contactPhone = client.phone || 'N/A';
    const contactEmail = client.email || 'N/A';

    // 3. Collect recipient IDs (Customer Care team, Account Manager, Creator, Admins)
    const recipientIds = ccUsers.map(u => u._id);
    if (client.assignedAccountManager) {
      recipientIds.push(client.assignedAccountManager);
    }
    if (creatorUser && (creatorUser.id || creatorUser._id)) {
      recipientIds.push(creatorUser.id || creatorUser._id);
    }

    // 4. Create Notification
    const notifMessage = `New client "${clientName}" (${contactPerson}, Mobile: ${contactPhone}, Email: ${contactEmail}) has been added to the system. 👤 ${ccProfileText}.`;

    await Notification.create({
      title: `🎉 New Client Added: ${clientName}`,
      message: notifMessage,
      clientId: client._id,
      recipients: Array.from(new Set(recipientIds.map(id => String(id)))),
      roles: ['customer care', 'customer care executive', 'customer support', 'support', 'admin', 'super admin', 'account manager']
    });

    console.log(`Notification sent for new client "${clientName}" with Customer Care Executive profile (${primaryCC?.name || 'Team'}).`);
  } catch (err) {
    console.error('Error triggering Customer Care notification for new client:', err);
  }
}

module.exports = { notifyCustomerCareNewClient };
