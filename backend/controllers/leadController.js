const Lead = require('../models/Lead');

const getLocationPrefix = (location) => {
  if (!location) return 'OTH';
  const loc = location.toUpperCase().trim();
  if (loc.startsWith('KOLKATA')) return 'KOL';
  if (loc.startsWith('BHUBANESWAR')) return 'BHU';
  if (loc.startsWith('DELHI')) return 'DEL';
  if (loc.startsWith('MUMBAI')) return 'MUM';
  if (loc.startsWith('BANGALORE') || loc.startsWith('BENGALURU')) return 'BLR';
  if (loc.startsWith('OTHER')) return 'OTH';
  return loc.slice(0, 3);
};

const getLeadVisibilityFilter = (user) => {
  if (!user) return { _id: null };

  const roleName = (user.role?.name || '').toLowerCase().trim();
  const deptName = (user.role?.department?.name || user.role?.department || '').toLowerCase().trim();
  const userTypeName = (user.role?.userType?.name || user.role?.userType || '').toLowerCase().trim();

  // 1. Super Admin, Admin, HR can view all leads
  const isAdmin = ['admin', 'super admin'].includes(roleName) || ['admin', 'super admin'].includes(userTypeName);
  const isHR = roleName.includes('hr') || roleName.includes('human resource') || deptName.includes('hr');

  if (isAdmin || isHR) {
    return {};
  }

  // 2. Telesales: only leads created by or assigned to them
  const isTelesales = roleName.includes('tele') || roleName.includes('tme') || deptName.includes('tele');
  if (isTelesales) {
    return {
      $or: [
        { assignedTelecaller: user._id },
        { dataFeedBy: user.name }
      ]
    };
  }

  // 3. BDM / Marketing Manager / Marketing Executive / Sales
  const isBDMOrMarketing = ['bdm', 'marketing', 'business development', 'sales'].some(keyword => 
    roleName.includes(keyword) || deptName.includes(keyword)
  );
  if (isBDMOrMarketing) {
    return {
      $or: [
        { assignedSales: user._id },
        { dataFeedBy: user.name }
      ]
    };
  }

  // Default fallback: restrict to user's assigned/created leads
  return {
    $or: [
      { assignedTelecaller: user._id },
      { assignedSales: user._id },
      { dataFeedBy: user.name }
    ]
  };
};

exports.createLead = async (req, res) => {
  try {
    if (req.body.assignedTelecaller === '') req.body.assignedTelecaller = null;
    if (req.body.assignedSales === '') req.body.assignedSales = null;

    // Force dataFeedBy to be the logged-in user's name
    req.body.dataFeedBy = req.user?.name || req.body.dataFeedBy || 'System';

    const roleName = (req.user?.role?.name || '').toLowerCase().trim();
    const isMarketingUser = roleName.includes('marketing manager') || roleName.includes('marketing executive');
    if (isMarketingUser) {
      const isApptFixed = req.body.stage === 'Appointment Fixed' || 
                          (req.body.appointmentHistory && req.body.appointmentHistory[0]?.status === 'Appointment Fixed');
      if (isApptFixed) {
        req.body.assignedSales = req.user._id;
      } else {
        delete req.body.assignedSales;
      }
    }

    const { email, phone, location } = req.body;

    if (!email || !email.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Email address is required.'
      });
    }

    // Duplicate detection based on email or phone
    const orConditions = [{ phone }];
    if (email) {
      orConditions.push({ email });
    }
    const existingLead = await Lead.findOne({ 
      $or: orConditions 
    }).populate('assignedTelecaller assignedSales', 'name email');

    if (existingLead) {
      return res.status(400).json({ 
        success: false, 
        message: 'Lead with this Email or Phone number already exists.',
        duplicate: true,
        existingLead
      });
    }

    // Generate dynamic sequential dataId
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0);
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
    
    // Find the latest lead created today with a dataId
    const latestLead = await Lead.findOne({
      createdAt: { $gte: startOfDay, $lte: endOfDay },
      dataId: { $exists: true, $ne: null }
    }).sort({ createdAt: -1 });

    let nextNum = 1;
    if (latestLead && latestLead.dataId) {
      const parts = latestLead.dataId.split('-');
      if (parts.length > 1) {
        const lastPart = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(lastPart)) {
          nextNum = lastPart + 1;
        }
      }
    }

    const prefix = getLocationPrefix(location);
    const d = today.getDate();
    const m = today.getMonth() + 1;
    const y = String(today.getFullYear()).slice(-2);
    const dateStr = `${d}${m}${y}`;
    const seqStr = String(nextNum).padStart(4, '0');
    const generatedDataId = `${prefix}${dateStr}-${seqStr}`;

    const lead = new Lead({
      ...req.body,
      dataId: generatedDataId
    });

    if (lead.assignedTelecaller) {
      try {
        const User = require('../models/User');
        const newTelecaller = await User.findById(lead.assignedTelecaller);
        const telecallerName = newTelecaller ? newTelecaller.name : 'Unassigned';
        lead.appointmentHistory = [{
          status: lead.stage || 'Data',
          remarks: `Lead created and assigned to telecaller ${telecallerName} by ${req.user?.name || lead.dataFeedBy || 'System'}.`,
          changedBy: req.user ? `${req.user.name} [${req.user.role?.name || 'User'}]` : `${lead.dataFeedBy} [User]`,
          changedAt: new Date()
        }];
      } catch (err) {
        console.error('Error initializing appointmentHistory on creation:', err);
      }
    }

    await lead.save();

    // Handle Notification upon BDM/BDE assignment during creation
    if (lead.assignedSales) {
      try {
        const User = require('../models/User');
        const bdmUser = await User.findById(lead.assignedSales);
        if (bdmUser) {
          const businessName = lead.businessName || 'a Lead';
          const assignedBy = req.user?.name || 'System';
          const title = 'New Lead Assigned';
          const message = `Lead "${businessName}" has been assigned to BDM ${bdmUser.name} by ${assignedBy}.`;

          const recipients = [bdmUser._id];

          const Role = require('../models/Role');
          const matchedRoles = await Role.find({
            name: { $regex: /admin/i }
          });
          const roles = matchedRoles.map(r => r.name.toLowerCase());

          const Notification = require('../models/Notification');
          const notification = new Notification({
            title,
            message,
            leadId: lead._id,
            recipients,
            roles
          });
          await notification.save();
        }
      } catch (notifErr) {
        console.error('Error generating assignment notification:', notifErr);
      }
    }

    // Trigger external Email/SMS notifications if BDM assigned or Appointment Fixed/Fit
    try {
      const isApptFixed = lead.stage === 'Appointment Fixed' || lead.stage === 'Appointment Fit' ||
                          (lead.appointmentHistory && (lead.appointmentHistory[0]?.status === 'Appointment Fixed' || lead.appointmentHistory[0]?.status === 'Appointment Fit'));
      
      const { sendLeadNotifications } = require('../utils/notificationHelper');
      if (lead.assignedSales && isApptFixed) {
        sendLeadNotifications(lead._id, 'BOTH').catch(err => console.error('Error sending lead notifications:', err));
      } else if (lead.assignedSales) {
        sendLeadNotifications(lead._id, 'BDM_ASSIGNED').catch(err => console.error('Error sending lead notifications:', err));
      } else if (isApptFixed) {
        sendLeadNotifications(lead._id, 'APPOINTMENT_FIXED').catch(err => console.error('Error sending lead notifications:', err));
      }
    } catch (notifHelperErr) {
      console.error('Error triggering lead notifications helper:', notifHelperErr);
    }

    res.status(201).json({ success: true, data: lead });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getLeads = async (req, res) => {
  try {
    const filter = getLeadVisibilityFilter(req.user);
    const leads = await Lead.find(filter).populate('assignedTelecaller assignedSales', 'name email').sort({ createdAt: -1 });
    
    // Dynamically assign retroactive dataId for legacy leads that don't have one
    let updatedAny = false;
    for (let i = 0; i < leads.length; i++) {
      if (!leads[i].dataId) {
        const MathLead = leads[i];
        const date = MathLead.createdAt || new Date();
        const d = date.getDate();
        const m = date.getMonth() + 1;
        const y = String(date.getFullYear()).slice(-2);
        const dateStr = `${d}${m}${y}`;
        
        const prefix = getLocationPrefix(MathLead.location);
        const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
        const endOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
        
        // Find the latest lead created on this day with this prefix to get the highest sequence number
        const latestForDay = await Lead.findOne({
          createdAt: { $gte: startOfDay, $lte: endOfDay },
          dataId: { $regex: new RegExp('^' + prefix + dateStr + '-') }
        }).sort({ dataId: -1 });

        let seqNum = 1;
        if (latestForDay && latestForDay.dataId) {
          const parts = latestForDay.dataId.split('-');
          if (parts.length > 1) {
            const lastPart = parseInt(parts[parts.length - 1], 10);
            if (!isNaN(lastPart)) {
              seqNum = lastPart + 1;
            }
          }
        }
        
        const seqStr = String(seqNum).padStart(4, '0');
        MathLead.dataId = `${prefix}${dateStr}-${seqStr}`;
        await MathLead.save({ validateBeforeSave: false });
        updatedAny = true;
      }
    }

    // Refetch leads if any were retroactively updated to ensure correct output structure
    const finalLeads = updatedAny
      ? await Lead.find(filter).populate('assignedTelecaller assignedSales', 'name email').sort({ createdAt: -1 })
      : leads;

    res.status(200).json({ success: true, data: finalLeads });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.bulkUploadLeads = async (req, res) => {
  try {
    const roleName = (req.user?.role?.name || '').toLowerCase().trim();
    const deptName = (req.user?.role?.department?.name || req.user?.role?.department || '').toLowerCase().trim();
    const userTypeName = (req.user?.role?.userType?.name || req.user?.role?.userType || '').toLowerCase().trim();

    const isAdmin = roleName.includes('admin') || roleName.includes('super admin') || userTypeName === 'admin' || userTypeName === 'super admin';
    const isHR = roleName.includes('hr') || roleName.includes('human resource') || deptName.includes('hr');

    if (!isAdmin && !isHR) {
      return res.status(403).json({ success: false, message: 'Access denied. Only Admins and HR can upload bulk leads.' });
    }

    const leadsData = req.body.leads; // Expecting an array of lead objects
    
    if (!Array.isArray(leadsData) || leadsData.length === 0) {
      return res.status(400).json({ success: false, message: 'No leads data provided.' });
    }

    const User = require('../models/User');
    const Lead = require('../models/Lead');

    let total = leadsData.length;
    let successCount = 0;
    let duplicateCount = 0;
    let failedCount = 0;
    const failedRecords = [];

    // Pre-calculate today's sequence
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0);
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
    
    const latestLead = await Lead.findOne({
      createdAt: { $gte: startOfDay, $lte: endOfDay },
      dataId: { $exists: true, $ne: null }
    }).sort({ createdAt: -1 });

    let nextNum = 1;
    if (latestLead && latestLead.dataId) {
      const parts = latestLead.dataId.split('-');
      if (parts.length > 1) {
        const lastPart = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(lastPart)) {
          nextNum = lastPart + 1;
        }
      }
    }

    const processedPhones = new Set();
    const processedEmails = new Set();

    for (let i = 0; i < leadsData.length; i++) {
      const data = leadsData[i];
      const rowNum = i + 2; // Excel row number (1-based, index 0 is row 2 after headers)
      const businessName = data.businessName || 'N/A';

      try {
        const phone = (data.phone || '').toString().trim();
        const email = (data.email || '').toString().trim();

        if (!phone) {
          throw new Error('Phone Number is required');
        }
        if (!email) {
          throw new Error('Email Address is required');
        }

        // Duplicate checks
        if (processedPhones.has(phone)) {
          duplicateCount++;
          throw new Error('Duplicate Phone number found within the uploaded file');
        }
        if (email && processedEmails.has(email)) {
          duplicateCount++;
          throw new Error('Duplicate Email Address found within the uploaded file');
        }

        const orConditions = [{ phone }];
        if (email) {
          orConditions.push({ email });
        }
        const existingLead = await Lead.findOne({
          $or: orConditions
        });

        if (existingLead) {
          duplicateCount++;
          throw new Error('Lead with this Email or Phone number already exists in database');
        }

        // TME Assignment Logic
        let assignedTelecaller = null;
        if (data.tmeValue) {
          const tmeStr = data.tmeValue.toString().trim();
          const matchedTme = await User.findOne({
            employmentStatus: 'Active',
            $or: [
              { name: { $regex: new RegExp(`^${tmeStr}$`, 'i') } },
              { employeeId: tmeStr }
            ]
          }).populate('role');

          if (!matchedTme) {
            throw new Error(`TME user '${tmeStr}' not found or inactive`);
          }

          const roleName = (matchedTme.role?.name || '').toLowerCase();
          const isTmeRole = roleName.includes('tele') || roleName.includes('tme');
          if (!isTmeRole) {
            throw new Error(`User '${tmeStr}' is not a Telecaller/TME (Designation: ${matchedTme.role?.name || 'N/A'})`);
          }
          assignedTelecaller = matchedTme._id;
        }

        // BDM Assignment Logic
        let assignedSales = null;
        if (data.bdmValue) {
          const bdmStr = data.bdmValue.toString().trim();
          const matchedBdm = await User.findOne({
            employmentStatus: 'Active',
            $or: [
              { name: { $regex: new RegExp(`^${bdmStr}$`, 'i') } },
              { employeeId: bdmStr }
            ]
          }).populate('role');

          if (!matchedBdm) {
            throw new Error(`BDM user '${bdmStr}' not found or inactive`);
          }

          const roleName = (matchedBdm.role?.name || '').toLowerCase();
          const isBdmRole = roleName.includes('bdm') || roleName.includes('marketing') || roleName.includes('sales') || roleName.includes('business development');
          if (!isBdmRole) {
            throw new Error(`User '${bdmStr}' is not a BDM (Designation: ${matchedBdm.role?.name || 'N/A'})`);
          }
          assignedSales = matchedBdm._id;
        }

        // Generate dataId
        const prefix = getLocationPrefix(data.location || 'Other');
        const d = today.getDate();
        const m = today.getMonth() + 1;
        const y = String(today.getFullYear()).slice(-2);
        const dateStr = `${d}${m}${y}`;
        const seqStr = String(nextNum).padStart(4, '0');
        const generatedDataId = `${prefix}${dateStr}-${seqStr}`;
        nextNum++;

        const newLead = new Lead({
          ...data,
          clientType: data.clientType || 'New Prospect',
          location: data.location || 'Other',
          dataSource: data.dataSource || 'Bulk Upload',
          dataFeedBy: req.user?.name || 'System',
          dataId: generatedDataId,
          assignedTelecaller,
          assignedSales
        });

        if (assignedTelecaller) {
          try {
            const tmeUser = await User.findById(assignedTelecaller);
            const telecallerName = tmeUser ? tmeUser.name : 'Unassigned';
            newLead.appointmentHistory = [{
              status: newLead.stage || 'Data',
              remarks: `Lead imported and assigned to telecaller ${telecallerName} by ${req.user?.name || 'System'}.`,
              changedBy: req.user ? `${req.user.name} [${req.user.role?.name || 'User'}]` : 'System [User]',
              changedAt: new Date()
            }];
          } catch (err) {
            console.error('Error initializing appointmentHistory on import:', err);
          }
        }

        await newLead.save();
        successCount++;

        processedPhones.add(phone);
        if (email) processedEmails.add(email);

      } catch (err) {
        const errMsg = err.message || 'Unknown error';
        if (errMsg.toLowerCase().includes('duplicate')) {
          failedRecords.push({
            row: rowNum,
            businessName,
            error: errMsg,
            status: 'Duplicate'
          });
        } else {
          failedCount++;
          failedRecords.push({
            row: rowNum,
            businessName,
            error: errMsg,
            status: 'Failed'
          });
        }
      }
    }

    res.status(200).json({ 
      success: true, 
      summary: {
        total,
        success: successCount,
        failed: failedCount,
        duplicate: duplicateCount
      },
      failedRecords
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateLead = async (req, res) => {
  try {
    const filter = getLeadVisibilityFilter(req.user);
    const query = { _id: req.params.id, ...filter };

    const leadToUpdate = await Lead.findOne(query);
    if (!leadToUpdate) {
      return res.status(403).json({ success: false, message: 'Access denied or lead not found' });
    }

    if (req.body.assignedTelecaller === '') req.body.assignedTelecaller = null;
    if (req.body.assignedSales === '') req.body.assignedSales = null;

    if (req.body.assignedTelecaller !== undefined && String(leadToUpdate.assignedTelecaller || '') !== String(req.body.assignedTelecaller || '')) {
      try {
        const User = require('../models/User');
        const newTelecaller = req.body.assignedTelecaller ? await User.findById(req.body.assignedTelecaller) : null;
        const telecallerName = newTelecaller ? newTelecaller.name : 'Unassigned';
        
        if (!req.body.appointmentHistory) {
          req.body.appointmentHistory = [...(leadToUpdate.appointmentHistory || [])];
        }
        req.body.appointmentHistory.unshift({
          status: req.body.stage || leadToUpdate.stage || 'Data',
          remarks: `Assigned telecaller changed to ${telecallerName} by ${req.user?.name || 'System'}.`,
          changedBy: req.user ? `${req.user.name} [${req.user.role?.name || 'User'}]` : 'System [User]',
          changedAt: new Date()
        });
      } catch (err) {
        console.error('Error tracking telecaller assignment change in history:', err);
      }
    }

    // Do not allow updating dataFeedBy/creator name
    delete req.body.dataFeedBy;

    const roleName = (req.user?.role?.name || '').toLowerCase().trim();
    const isMarketingUser = roleName.includes('marketing manager') || roleName.includes('marketing executive');
    if (isMarketingUser) {
      const isApptFixed = req.body.stage === 'Appointment Fixed' || 
                          (req.body.appointmentHistory && req.body.appointmentHistory[0]?.status === 'Appointment Fixed');
      if (isApptFixed) {
        if (!req.body.assignedSales) {
          req.body.assignedSales = req.user._id;
        }
      } else {
        delete req.body.assignedSales;
      }
    }

    const updatedDoc = await Lead.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!updatedDoc) return res.status(404).json({ success: false, message: 'Not found' });

    // Handle Notification upon BDM/BDE assignment change
    const wasAssignedSales = leadToUpdate.assignedSales;
    const isAssignedSales = req.body.assignedSales;
    if (String(wasAssignedSales || '') !== String(isAssignedSales || '') && isAssignedSales) {
      try {
        const User = require('../models/User');
        const bdmUser = await User.findById(isAssignedSales);
        if (bdmUser) {
          const businessName = updatedDoc.businessName || 'a Lead';
          const assignedBy = req.user?.name || 'System';
          const title = 'New Lead Assigned';
          const message = `Lead "${businessName}" has been assigned to BDM ${bdmUser.name} by ${assignedBy}.`;

          const recipients = [bdmUser._id];

          const Role = require('../models/Role');
          const matchedRoles = await Role.find({
            name: { $regex: /admin/i }
          });
          const roles = matchedRoles.map(r => r.name.toLowerCase());

          const Notification = require('../models/Notification');
          const notification = new Notification({
            title,
            message,
            leadId: updatedDoc._id,
            recipients,
            roles
          });
          await notification.save();
        }
      } catch (notifErr) {
        console.error('Error generating assignment notification:', notifErr);
      }
    }

    // Handle Notifications upon Stage/Status update
    if (req.body.stage || req.body.appointmentHistory) {
      const latestEntry = req.body.appointmentHistory && req.body.appointmentHistory[0];
      if (latestEntry) {
        try {
          const status = latestEntry.status;
          const changedBy = latestEntry.changedBy; // e.g. "John Doe [Telemarketing Executive]"
          const apptDate = latestEntry.appointmentDate;
          
          const businessName = updatedDoc.businessName || 'a Lead';
          const namePart = changedBy.split(' [')[0];
          
          const User = require('../models/User');
          const tmeUser = await User.findOne({ name: namePart });
          
          let bdmName = 'Unassigned';
          if (updatedDoc.assignedSales) {
            const bdmUser = await User.findById(updatedDoc.assignedSales);
            if (bdmUser) {
              bdmName = bdmUser.name;
            }
          }

          let title = '';
          let message = '';
          
          if (status === 'Appointment Fixed') {
            title = 'New Appointment Fixed';
            const formattedDate = apptDate 
              ? new Date(apptDate).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
              : 'N/A';
            message = `${namePart} fixed an appointment for BDM ${bdmName} on ${formattedDate} for lead "${businessName}".`;
          } else {
            title = `Lead Status Changed: ${status}`;
            message = `${namePart} changed the status of lead "${businessName}" to "${status}".`;
          }

          // Build recipients list
          const recipients = [];
          if (updatedDoc.assignedSales) {
            recipients.push(updatedDoc.assignedSales);
          }
          if (tmeUser && (!updatedDoc.assignedSales || String(tmeUser._id) !== String(updatedDoc.assignedSales))) {
            recipients.push(tmeUser._id);
          }

          // Build roles list dynamically to include TMEs and Admins
          const Role = require('../models/Role');
          const matchedRoles = await Role.find({
            $or: [
              { name: { $regex: /tele/i } },
              { name: { $regex: /admin/i } }
            ]
          });
          const roles = matchedRoles.map(r => r.name.toLowerCase());
          
          if (title && message) {
            const Notification = require('../models/Notification');
            const notification = new Notification({
              title,
              message,
              leadId: updatedDoc._id,
              recipients,
              roles
            });
            await notification.save();
          }
        } catch (notifErr) {
          console.error('Error generating status update notification:', notifErr);
        }
      }
    }

    // Trigger external Email/SMS notifications if BDM assigned or Appointment Fixed/Fit changed
    try {
      const wasAssignedSales = leadToUpdate.assignedSales ? String(leadToUpdate.assignedSales) : '';
      const isAssignedSales = updatedDoc.assignedSales ? String(updatedDoc.assignedSales) : '';
      const bdmChanged = (wasAssignedSales !== isAssignedSales) && isAssignedSales;

      const wasStageFixed = leadToUpdate.stage === 'Appointment Fixed' || leadToUpdate.stage === 'Appointment Fit' ||
                            (leadToUpdate.appointmentHistory && (leadToUpdate.appointmentHistory[0]?.status === 'Appointment Fixed' || leadToUpdate.appointmentHistory[0]?.status === 'Appointment Fit'));
      
      const isStageFixed = updatedDoc.stage === 'Appointment Fixed' || updatedDoc.stage === 'Appointment Fit' ||
                           (updatedDoc.appointmentHistory && (updatedDoc.appointmentHistory[0]?.status === 'Appointment Fixed' || updatedDoc.appointmentHistory[0]?.status === 'Appointment Fit'));

      const apptDateChanged = String(leadToUpdate.appointmentHistory?.[0]?.appointmentDate || '') !== String(updatedDoc.appointmentHistory?.[0]?.appointmentDate || '');
      
      const apptFixedTriggered = isStageFixed && (!wasStageFixed || apptDateChanged);

      const { sendLeadNotifications } = require('../utils/notificationHelper');
      if (bdmChanged && apptFixedTriggered) {
        sendLeadNotifications(updatedDoc._id, 'BOTH').catch(err => console.error('Error sending lead notifications:', err));
      } else if (bdmChanged) {
        sendLeadNotifications(updatedDoc._id, 'BDM_ASSIGNED').catch(err => console.error('Error sending lead notifications:', err));
      } else if (apptFixedTriggered) {
        sendLeadNotifications(updatedDoc._id, 'APPOINTMENT_FIXED').catch(err => console.error('Error sending lead notifications:', err));
      }
    } catch (notifHelperErr) {
      console.error('Error triggering lead notifications helper in update:', notifHelperErr);
    }

    res.status(200).json({ success: true, data: updatedDoc });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.deleteLead = async (req, res) => {
  try {
    const filter = getLeadVisibilityFilter(req.user);
    const query = { _id: req.params.id, ...filter };

    const leadToDelete = await Lead.findOne(query);
    if (!leadToDelete) {
      return res.status(403).json({ success: false, message: 'Access denied or lead not found' });
    }

    await Lead.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: 'Deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

