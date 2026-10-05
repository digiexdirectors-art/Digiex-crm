const Notification = require('../models/Notification');

// Fetch notifications for a specific user and role
exports.getNotifications = async (req, res) => {
  try {
    const { userId, roleName } = req.params;
    
    // Normalize role name for case-insensitive matching
    const roleLower = (roleName || '').toLowerCase().trim();
    
    // Find notifications target to this user specifically OR to their role
    const notifications = await Notification.find({
      $or: [
        { recipients: userId },
        { roles: { $regex: new RegExp('^' + roleLower + '$', 'i') } },
        { $and: [ { recipients: { $size: 0 } }, { roles: { $size: 0 } } ] } // General/Broadcast
      ]
    }).populate('leadId').populate('clientId').sort({ createdAt: -1 });

    const now = new Date();
    const filtered = notifications.filter(notif => {
      // 1. For 'New Appointment Fixed' notifications, apply future-date filtering
      if (notif.title === 'New Appointment Fixed') {
        if (notif.leadId && typeof notif.leadId === 'object') {
          const lead = notif.leadId;
          if (lead.appointmentHistory && lead.appointmentHistory.length > 0) {
            // Find the appointment in history that matches the date in the notification message
            const matchingAppt = lead.appointmentHistory.find(appt => {
              if (!appt.appointmentDate || appt.status !== 'Appointment Fixed') return false;
              const formattedDate = new Date(appt.appointmentDate).toLocaleString('en-GB', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              });
              return notif.message.includes(formattedDate);
            });

            if (matchingAppt) {
              const apptDate = new Date(matchingAppt.appointmentDate);
              return apptDate >= now;
            }
          }
        }
        return false;
      }

      // 2. Allow all other notification types (leave requests, system alerts, BDM assignments, etc.)
      return true;
    });

    // Clean up expired notifications from database asynchronously
    const expiredIds = notifications
      .filter(notif => notif.title === 'New Appointment Fixed' && !filtered.includes(notif))
      .map(notif => notif._id);

    if (expiredIds.length > 0) {
      Notification.deleteMany({ _id: { $in: expiredIds } })
        .catch(err => console.error('Failed to clean up expired appointment notifications:', err));
    }

    res.status(200).json({ success: true, data: filtered });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Mark a single notification as read by a user
exports.markAsRead = async (req, res) => {
  try {
    const { id, userId } = req.params;
    const notification = await Notification.findById(id);
    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    if (!notification.readBy.includes(userId)) {
      notification.readBy.push(userId);
      await notification.save();
    }

    res.status(200).json({ success: true, data: notification });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Mark all notifications as read for a user
exports.markAllAsRead = async (req, res) => {
  try {
    const { userId, roleName } = req.params;
    const roleLower = (roleName || '').toLowerCase().trim();

    // Find all notifications this user is eligible to see
    const notifications = await Notification.find({
      $or: [
        { recipients: userId },
        { roles: { $regex: new RegExp('^' + roleLower + '$', 'i') } },
        { $and: [ { recipients: { $size: 0 } }, { roles: { $size: 0 } } ] }
      ]
    });

    for (const notif of notifications) {
      if (!notif.readBy.includes(userId)) {
        notif.readBy.push(userId);
        await notif.save();
      }
    }

    res.status(200).json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
