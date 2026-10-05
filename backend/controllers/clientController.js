const Client = require('../models/Client');
const ClientPackage = require('../models/ClientPackage');
const Invoice = require('../models/Invoice');
const crypto = require('crypto');

// Get all clients with calculated counts and revenues
exports.getClients = async (req, res) => {
  try {
    const clients = await Client.find()
      .populate('assignedAccountManager', 'name email employeeId phone')
      .populate('assignedSalesExecutive', 'name email employeeId phone')
      .populate('assignedServiceManager', 'name email employeeId phone')
      .populate('assignedProjectManager', 'name email employeeId phone')
      .populate('assignedCustomerCareExecutive', 'name email employeeId phone')
      .sort({ createdAt: -1, _id: -1 });

    const clientPackages = await ClientPackage.find().populate('package', 'name category');
    const invoices = await Invoice.find();

    const extendedClients = clients.map(client => {
      const clientPkgs = clientPackages.filter(cp => cp.client && cp.client.toString() === client._id.toString());
      const clientInvoices = invoices.filter(inv => inv.client && inv.client.toString() === client._id.toString());

      const activeServicesCount = clientPkgs.filter(p => p.status === 'Active' && new Date(p.endDate) >= new Date()).length;
      const expiredServicesCount = clientPkgs.filter(p => p.status === 'Expired' || new Date(p.endDate) < new Date()).length;
      const totalRevenueGenerated = clientInvoices.reduce((sum, inv) => sum + (inv.paidAmount || 0), 0);

      const activePkgs = clientPkgs.filter(p => p.status === 'Active' && new Date(p.endDate) >= new Date());
      let serviceStartDate = null;
      let serviceEndDate = null;
      
      if (activePkgs.length > 0) {
        const startDates = activePkgs.map(p => new Date(p.startDate).getTime()).filter(t => !isNaN(t));
        const endDates = activePkgs.map(p => new Date(p.endDate).getTime()).filter(t => !isNaN(t));
        if (startDates.length > 0) {
          serviceStartDate = new Date(Math.min(...startDates));
        }
        if (endDates.length > 0) {
          serviceEndDate = new Date(Math.max(...endDates));
        }
      } else if (clientPkgs.length > 0) {
        const sortedPkgs = clientPkgs.slice().sort((a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime());
        serviceStartDate = sortedPkgs[0].startDate;
        serviceEndDate = sortedPkgs[0].endDate;
      }

      // Calculate last expired service date
      const expiredPkgs = clientPkgs.filter(p => p.status === 'Expired' || new Date(p.endDate) < new Date());
      let lastExpiredServiceDate = null;
      if (expiredPkgs.length > 0) {
        const endDates = expiredPkgs.map(p => new Date(p.endDate).getTime()).filter(t => !isNaN(t));
        if (endDates.length > 0) {
          lastExpiredServiceDate = new Date(Math.max(...endDates));
        }
      }

      return {
        ...client.toObject(),
        activeServicesCount,
        expiredServicesCount,
        totalRevenueGenerated,
        serviceStartDate,
        serviceEndDate,
        lastExpiredServiceDate,
        clientPackages: clientPkgs.map(p => ({
          _id: p._id,
          packageName: p.package?.name || p.name || 'Custom Package',
          packageCategory: p.package?.category || '',
          package: p.package,
          services: p.services || [],
          serviceDetails: p.serviceDetails || [],
          startDate: p.startDate,
          endDate: p.endDate,
          billingCycle: p.billingCycle,
          price: p.price,
          gstAmount: p.gstAmount,
          total: p.total,
          status: p.status,
          createdAt: p.createdAt
        }))
      };
    });

    res.status(200).json({ success: true, data: extendedClients });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get Client Profile details (360 view)
exports.getClientById = async (req, res) => {
  try {
    const client = await Client.findById(req.params.id)
      .populate({ path: 'assignedAccountManager', select: 'name email role employeeId phone', populate: { path: 'role', select: 'name' } })
      .populate({ path: 'assignedSalesExecutive', select: 'name email role employeeId phone', populate: { path: 'role', select: 'name' } })
      .populate({ path: 'assignedServiceManager', select: 'name email role employeeId phone', populate: { path: 'role', select: 'name' } })
      .populate({ path: 'assignedProjectManager', select: 'name email role employeeId phone', populate: { path: 'role', select: 'name' } })
      .populate({ path: 'assignedCustomerCareExecutive', select: 'name email role employeeId phone', populate: { path: 'role', select: 'name' } })
      .populate({ path: 'assignedTeamMembers', select: 'name email role employeeId phone', populate: { path: 'role', select: 'name' } })
      .populate({ path: 'teamAssignments.user', select: 'name email role employeeId phone', populate: { path: 'role', select: 'name' } })
      .populate({ path: 'notes.taggedUsers', select: 'name email role' });

    if (!client) {
      return res.status(404).json({ success: false, message: 'Client not found' });
    }

    // Fetch package and service history
    const packagesHistory = await ClientPackage.find({ client: client._id })
      .populate({ path: 'accountManager', select: 'name email role', populate: { path: 'role', select: 'name' } })
      .populate({
        path: 'lead',
        populate: [
          { path: 'assignedTelecaller', select: 'name email role', populate: { path: 'role', select: 'name' } },
          { path: 'assignedSales', select: 'name email role', populate: { path: 'role', select: 'name' } }
        ]
      })
      .populate('package', 'name')
      .sort({ createdAt: -1 });

    // Fetch payment/invoice history
    const invoicesHistory = await Invoice.find({ client: client._id })
      .sort({ createdAt: -1 });

    res.status(200).json({ 
      success: true, 
      data: {
        client,
        packagesHistory,
        invoicesHistory
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update Client profile
exports.updateClient = async (req, res) => {
  try {
    const updates = req.body;
    const oldClient = await Client.findById(req.params.id);
    if (!oldClient) {
      return res.status(404).json({ success: false, message: 'Client not found' });
    }

    // Audit Logging
    const AuditLog = require('../models/AuditLog');
    const oldVal = {};
    const newVal = {};
    let changed = false;

    const keysToCheck = [
      'name', 'companyName', 'email', 'phone', 'address', 'designation',
      'whatsAppNumber', 'alternateNumber', 'alternateEmail', 'businessCategory',
      'gstNumber', 'panNumber', 'websiteUrl', 'businessType', 'industry',
      'companyRegistrationNumber', 'companyEmail', 'companyPhone', 'description',
      'numberOfEmployees', 'techStack', 'competitors', 'remarks', 'status', 'isGstVerified'
    ];

    keysToCheck.forEach(key => {
      if (updates[key] !== undefined && String(updates[key]) !== String(oldClient[key] || '')) {
        oldVal[key] = oldClient[key];
        newVal[key] = updates[key];
        changed = true;
      }
    });

    if (changed) {
      const log = new AuditLog({
        client: oldClient._id,
        action: 'BUSINESS_DETAILS_UPDATE',
        user: req.user?.id || req.user?._id,
        userName: req.user?.name || 'System',
        userRole: req.user?.role?.name || 'System',
        oldValue: oldVal,
        newValue: newVal
      });
      await log.save();
    }

    // Track timeline changes
    const timelineEntries = [];
    if (updates.status && updates.status !== oldClient.status) {
      timelineEntries.push({
        title: 'Status Updated',
        description: `Client status changed from ${oldClient.status} to ${updates.status}`,
        date: new Date()
      });
    }

    // If assignments changed, log them in timeline
    if (updates.assignedAccountManager && updates.assignedAccountManager !== String(oldClient.assignedAccountManager)) {
      timelineEntries.push({
        title: 'Account Manager Assigned',
        description: 'New Account Manager assigned to client',
        date: new Date()
      });
    }

    if (updates.teamAssignments && Array.isArray(updates.teamAssignments)) {
      const parsedAssignments = updates.teamAssignments.map(ta => ({
        user: ta.user || ta.userId || ta._id,
        startDate: ta.startDate ? new Date(ta.startDate) : null,
        endDate: ta.endDate ? new Date(ta.endDate) : null
      }));
      updates.teamAssignments = parsedAssignments;
      updates.assignedTeamMembers = parsedAssignments.map(ta => ta.user);
    }

    const updated = await Client.findByIdAndUpdate(
      req.params.id,
      {
        $set: updates,
        $push: { timeline: { $each: timelineEntries } }
      },
      { new: true }
    )
      .populate('assignedAccountManager assignedSalesExecutive assignedServiceManager assignedProjectManager assignedTeamMembers')
      .populate({ path: 'teamAssignments.user', select: 'name email employeeId role' });

    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Add internal client notes with optional member tagging
exports.addClientNote = async (req, res) => {
  try {
    const { note, taggedUsers } = req.body;
    const userName = req.user?.name || 'System';
    const userId = req.user?.id || req.user?._id;

    const noteObj = {
      note,
      userName,
      user: userId,
      taggedUsers: Array.isArray(taggedUsers) ? taggedUsers : [],
      date: new Date()
    };

    const client = await Client.findByIdAndUpdate(
      req.params.id,
      {
        $push: {
          notes: noteObj,
          timeline: {
            title: 'Note Added',
            description: `Added by ${userName}: "${note.length > 40 ? note.substring(0, 40) + '...' : note}"`,
            date: new Date()
          }
        }
      },
      { new: true }
    ).populate({ path: 'notes.taggedUsers', select: 'name email role' });

    if (!client) return res.status(404).json({ success: false, message: 'Client not found' });

    // Send notifications to tagged users
    if (taggedUsers && Array.isArray(taggedUsers) && taggedUsers.length > 0) {
      try {
        const Notification = require('../models/Notification');
        const clientName = client.companyName || client.name || 'Project';
        await Notification.create({
          title: `Tagged in Project Note: ${clientName}`,
          message: `${userName} tagged you in a note for ${clientName}: "${note.length > 80 ? note.substring(0, 80) + '...' : note}"`,
          recipients: taggedUsers,
          clientId: client._id
        });
      } catch (notifErr) {
        console.error('Error triggering tag notifications:', notifErr);
      }
    }

    res.status(200).json({ success: true, data: client.notes });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Upload document details
exports.uploadClientDocument = async (req, res) => {
  try {
    const { fileName, fileUrl, fileType } = req.body;
    const userName = req.user?.name || 'System';

    const client = await Client.findByIdAndUpdate(
      req.params.id,
      {
        $push: {
          documents: {
            fileName,
            fileUrl,
            fileType,
            uploadedAt: new Date()
          },
          timeline: {
            title: 'Document Uploaded',
            description: `Document "${fileName}" uploaded by ${userName}`,
            date: new Date()
          }
        }
      },
      { new: true }
    );

    if (!client) return res.status(404).json({ success: false, message: 'Client not found' });
    res.status(200).json({ success: true, data: client.documents });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Delete uploaded document
exports.deleteClientDocument = async (req, res) => {
  try {
    const { docId } = req.params;
    const userName = req.user?.name || 'System';

    const client = await Client.findById(req.params.id);
    if (!client) return res.status(404).json({ success: false, message: 'Client not found' });

    const doc = client.documents.id(docId);
    const fileName = doc ? doc.fileName : 'Document';

    const updatedClient = await Client.findByIdAndUpdate(
      req.params.id,
      {
        $pull: { documents: { _id: docId } },
        $push: {
          timeline: {
            title: 'Document Deleted',
            description: `Document "${fileName}" removed by ${userName}`,
            date: new Date()
          }
        }
      },
      { new: true }
    );

    res.status(200).json({ success: true, data: updatedClient.documents });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.verifyClient = async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);
    if (!client) return res.status(404).json({ success: false, message: 'Client not found' });

    const userName = req.user?.name || 'System';
    const employeeId = req.user?.employeeId || 'N/A';

    client.isVerified = true;
    client.verificationDetails = {
      verifiedAt: new Date(),
      verifiedBy: userName,
      verifiedByEmployeeId: employeeId
    };

    if (client.projectStatus === 'Pending Verification' || !client.projectStatus || !client.assignedTeamMembers || client.assignedTeamMembers.length === 0) {
      client.projectStatus = 'Pending Team Members';
    }

    client.timeline.unshift({
      title: 'Client Verified',
      description: `Verified by ${userName} (ID: ${employeeId})`,
      date: new Date()
    });

    await client.save();

    // Log to AuditLog
    const AuditLog = require('../models/AuditLog');
    const log = new AuditLog({
      client: client._id,
      action: 'VERIFIED',
      user: req.user?.id || req.user?._id,
      userName: userName,
      userRole: req.user?.role?.name || 'System',
      oldValue: { isVerified: false },
      newValue: { isVerified: true, verificationDetails: client.verificationDetails }
    });
    await log.save();

    // Send verification email asynchronously in the background
    const emailHelper = require('../utils/emailHelper');
    emailHelper.sendVerificationEmail(client._id).catch(err => {
      console.error('Failed to trigger background verification email:', err);
    });

    res.status(200).json({ success: true, data: client });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * Triggers sending an email containing full client business details and a verification link token.
 * Triggered by staff clicking "Verify & Submit".
 */
exports.sendClientVerificationEmailLink = async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);
    if (!client) return res.status(404).json({ success: false, message: 'Client not found' });

    // Optional updates sent with request (e.g. from verification edit modal)
    if (req.body && typeof req.body === 'object') {
      const allowedFields = [
        'name', 'companyName', 'email', 'phone', 'address', 'designation',
        'whatsAppNumber', 'alternateNumber', 'alternateEmail', 'businessCategory',
        'gstNumber', 'panNumber', 'websiteUrl', 'businessType', 'industry',
        'addressLine1', 'addressLine2', 'city', 'state', 'country', 'pinCode',
        'facebookUrl', 'instagramUrl', 'linkedInUrl', 'youtubeUrl', 'googleBusinessProfileUrl',
        'description', 'remarks', 'competitors'
      ];
      allowedFields.forEach(field => {
        if (req.body[field] !== undefined) {
          client[field] = req.body[field];
        }
      });
    }

    // Mark client as verified directly upon submit
    const userName = req.user?.name || 'Customer Care Executive';
    const employeeId = req.user?.employeeId || 'N/A';

    client.isVerified = true;
    client.verificationDetails = {
      verifiedAt: new Date(),
      verifiedBy: userName,
      verifiedByEmployeeId: employeeId
    };

    if (client.projectStatus === 'Pending Verification' || !client.projectStatus || !client.assignedTeamMembers || client.assignedTeamMembers.length === 0) {
      client.projectStatus = 'Pending Team Members';
    }

    // Generate secure 32-byte token valid for 7 days
    const token = crypto.randomBytes(32).toString('hex');
    client.verificationToken = token;
    client.verificationTokenExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    client.timeline.unshift({
      title: 'Client Verified & Email Sent',
      description: `Profile verified by ${userName} (ID: ${employeeId}) and verification email sent to ${client.companyEmail || client.email}`,
      date: new Date()
    });

    await client.save();

    // Log to AuditLog
    const AuditLog = require('../models/AuditLog');
    const log = new AuditLog({
      client: client._id,
      action: 'VERIFIED',
      user: req.user?.id || req.user?._id,
      userName: userName,
      userRole: req.user?.role?.name || 'System',
      oldValue: { isVerified: false },
      newValue: { isVerified: true, verificationDetails: client.verificationDetails }
    });
    await log.save();

    // Send verification email via email helper
    const emailHelper = require('../utils/emailHelper');
    const originUrl = req.headers.origin || req.headers.referer || 'http://localhost:5173';
    const emailResult = await emailHelper.sendVerificationLinkEmail(client._id, token, originUrl);

    res.status(200).json({
      success: true,
      message: `Client profile verified successfully and notification email sent to ${emailResult.recipientEmail || client.email}`,
      data: {
        recipientEmail: emailResult.recipientEmail || client.email,
        client
      }
    });
  } catch (error) {
    console.error('Error in sendClientVerificationEmailLink:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Public endpoint called when the client clicks the verification link from their email.
 * Validates token and marks client as verified.
 */
exports.verifyClientByToken = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ success: false, message: 'Verification token is required.' });
    }

    const client = await Client.findOne({
      verificationToken: token,
      verificationTokenExpires: { $gt: new Date() }
    });

    if (!client) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired verification link. Please request a new verification link.'
      });
    }

    const verifiedAt = new Date();
    client.isVerified = true;
    client.verificationDetails = {
      verifiedAt,
      verifiedBy: 'Client (via Email Verification Link)',
      verifiedByEmployeeId: 'CLIENT_LINK'
    };

    if (client.projectStatus === 'Pending Verification' || !client.projectStatus) {
      client.projectStatus = 'Pending Team Members';
    }

    client.verificationToken = undefined;
    client.verificationTokenExpires = undefined;

    client.timeline.unshift({
      title: 'Verified by Client',
      description: 'Client confirmed profile details via email verification link',
      date: verifiedAt
    });

    await client.save();

    // Log to AuditLog
    const AuditLog = require('../models/AuditLog');
    const log = new AuditLog({
      client: client._id,
      action: 'VERIFIED_VIA_EMAIL_LINK',
      userName: client.name || client.companyName,
      userRole: 'Client',
      oldValue: { isVerified: false },
      newValue: { isVerified: true, verificationDetails: client.verificationDetails }
    });
    await log.save();

    res.status(200).json({
      success: true,
      message: `Verification successful! Profile details for ${client.companyName} have been verified.`,
      data: client
    });
  } catch (error) {
    console.error('Error in verifyClientByToken:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.overrideVerification = async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);
    if (!client) return res.status(404).json({ success: false, message: 'Client not found' });

    const userName = req.user?.name || 'System';
    const employeeId = req.user?.employeeId || 'N/A';
    const { isVerified } = req.body;

    const oldVal = { isVerified: client.isVerified, verificationDetails: client.verificationDetails };

    client.isVerified = !!isVerified;
    if (client.isVerified) {
      client.verificationDetails = {
        verifiedAt: new Date(),
        verifiedBy: userName,
        verifiedByEmployeeId: employeeId
      };
    } else {
      client.verificationDetails = undefined;
    }

    client.timeline.unshift({
      title: 'Verification Overridden',
      description: `Verification status set to ${client.isVerified} by Admin ${userName}`,
      date: new Date()
    });

    await client.save();

    // Log to AuditLog
    const AuditLog = require('../models/AuditLog');
    const log = new AuditLog({
      client: client._id,
      action: 'VERIFICATION_OVERRIDE',
      user: req.user?.id || req.user?._id,
      userName: userName,
      userRole: req.user?.role?.name || 'System',
      oldValue: oldVal,
      newValue: { isVerified: client.isVerified, verificationDetails: client.verificationDetails }
    });
    await log.save();

    if (client.isVerified) {
      const emailHelper = require('../utils/emailHelper');
      emailHelper.sendVerificationEmail(client._id).catch(err => {
        console.error('Failed to trigger background verification email in override:', err);
      });
    }

    res.status(200).json({ success: true, data: client });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Get projects assigned to logged-in user (NO payment/financial information exposed)
exports.getMyProjects = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const userRole = (req.user?.role?.name || '').toLowerCase();
    const userType = (typeof req.user?.role?.userType === 'object' ? req.user?.role?.userType?.name : req.user?.role?.userType || '').toLowerCase();

    const isAdmin = ['admin', 'super admin'].includes(userRole) || ['admin', 'super admin'].includes(userType);
    const isServiceManager = userRole.includes('service manager');

    let query = {};
    if (!isAdmin && !isServiceManager) {
      query = { assignedTeamMembers: userId };
    }

    const User = require('../models/User');
    const Role = require('../models/Role');

    // Fetch all users to dynamically identify Service Managers (e.g. Vikash Singh or any Service Manager role)
    const allUsers = await User.find()
      .populate('role', 'name')
      .select('name email employeeId role');

    const serviceManagerList = allUsers.filter(u => {
      const rName = (typeof u.role === 'object' ? u.role?.name : (u.role || '')).toLowerCase();
      const uName = (u.name || '').toLowerCase();
      return rName.includes('service') || uName.includes('vikash') || uName.includes('vikas');
    });

    const sysServiceMgr = serviceManagerList.length > 0 ? serviceManagerList[0] : null;

    const clients = await Client.find(query)
      .populate('assignedAccountManager', 'name email employeeId')
      .populate({ path: 'assignedServiceManager', select: 'name email employeeId role', populate: { path: 'role', select: 'name' } })
      .populate({ path: 'assignedTeamMembers', select: 'name email employeeId role', populate: { path: 'role', select: 'name' } })
      .populate({ path: 'teamAssignments.user', select: 'name email employeeId role', populate: { path: 'role', select: 'name' } })
      .populate({ path: 'notes.taggedUsers', select: 'name email employeeId role' })
      .sort({ updatedAt: -1 });

    const clientIds = clients.map(c => c._id);
    const clientPackages = await ClientPackage.find({ client: { $in: clientIds } })
      .populate({
        path: 'package',
        populate: {
          path: 'serviceDetails',
          populate: { path: 'service', select: 'name category' }
        }
      })
      .populate({
        path: 'serviceDetails',
        populate: { path: 'service', select: 'name category' }
      });

    const result = clients.map(client => {
      const clientPkgs = clientPackages.filter(cp => cp.client && cp.client.toString() === client._id.toString());
      
      const activePkgs = clientPkgs.filter(p => p.status === 'Active' || new Date(p.endDate) >= new Date());
      let serviceStartDate = null;
      let serviceEndDate = null;

      if (activePkgs.length > 0) {
        const startDates = activePkgs.map(p => new Date(p.startDate).getTime()).filter(t => !isNaN(t));
        const endDates = activePkgs.map(p => new Date(p.endDate).getTime()).filter(t => !isNaN(t));
        if (startDates.length > 0) serviceStartDate = new Date(Math.min(...startDates));
        if (endDates.length > 0) serviceEndDate = new Date(Math.max(...endDates));
      } else if (clientPkgs.length > 0) {
        const sortedPkgs = clientPkgs.slice().sort((a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime());
        serviceStartDate = sortedPkgs[0].startDate;
        serviceEndDate = sortedPkgs[0].endDate;
      }

      const clientObj = client.toObject();

      let serviceManagerObj = clientObj.assignedServiceManager;
      if (!serviceManagerObj && sysServiceMgr) {
        serviceManagerObj = {
          _id: sysServiceMgr._id,
          name: sysServiceMgr.name,
          email: sysServiceMgr.email,
          employeeId: sysServiceMgr.employeeId || ''
        };
      }

      // Aggregate checked service details WITHOUT prices, grouped by Service Category
      const sanitizedPackages = clientPkgs.map(pkg => {
        const serviceCategoryMap = new Map();

        const addDetail = (catName, detailName) => {
          if (!catName || !detailName) return;
          const cleanCat = catName.trim();
          const cleanDetail = detailName.trim();
          if (!serviceCategoryMap.has(cleanCat)) {
            serviceCategoryMap.set(cleanCat, new Map());
          }
          serviceCategoryMap.get(cleanCat).set(cleanDetail, { key: cleanDetail, value: cleanDetail });
        };

        // 1. From pkg.services
        if (pkg.services && Array.isArray(pkg.services)) {
          pkg.services.forEach(s => {
            const catName = s.name || s.category || 'General Services';
            if (!serviceCategoryMap.has(catName.trim())) {
              serviceCategoryMap.set(catName.trim(), new Map());
            }
            if (s.deliverables && Array.isArray(s.deliverables)) {
              s.deliverables.forEach(d => {
                const itemText = d.value || d.key;
                if (itemText) addDetail(catName, itemText);
              });
            }
          });
        }

        // 2. From pkg.serviceDetails (populated ServiceDetail objects)
        if (pkg.serviceDetails && Array.isArray(pkg.serviceDetails)) {
          pkg.serviceDetails.forEach(sd => {
            if (typeof sd === 'object' && sd.name) {
              const catName = sd.service?.name || sd.category || 'General Services';
              addDetail(catName, sd.name);
            }
          });
        }

        // 3. From pkg.package (populated Package object if any)
        if (pkg.package && typeof pkg.package === 'object') {
          if (pkg.package.deliverables && Array.isArray(pkg.package.deliverables)) {
            pkg.package.deliverables.forEach(dGroup => {
              const catName = dGroup.serviceName || 'General Services';
              if (dGroup.items && Array.isArray(dGroup.items)) {
                dGroup.items.forEach(item => {
                  const itemText = item.value || item.key;
                  if (itemText) addDetail(catName, itemText);
                });
              }
            });
          }
          if (pkg.package.serviceDetails && Array.isArray(pkg.package.serviceDetails)) {
            pkg.package.serviceDetails.forEach(sd => {
              if (typeof sd === 'object' && sd.name) {
                const catName = sd.service?.name || 'General Services';
                addDetail(catName, sd.name);
              }
            });
          }
        }

        // Convert Map to array of services with deliverables (WITHOUT prices)
        const servicesArray = [];
        serviceCategoryMap.forEach((detailsMap, catName) => {
          servicesArray.push({
            name: catName,
            category: catName,
            deliverables: Array.from(detailsMap.values())
          });
        });

        return {
          _id: pkg._id,
          packageName: pkg.package?.name || pkg.name || 'Custom Package',
          startDate: pkg.startDate,
          endDate: pkg.endDate,
          status: pkg.status,
          services: servicesArray
        };
      });

      // Calculate Expiration & 1-Month Pre-Expiration Status
      const todayMidnight = new Date();
      todayMidnight.setHours(0, 0, 0, 0);

      let daysRemaining = null;
      let isExpired = false;
      let isExpiringSoon = false;

      if (serviceEndDate) {
        const end = new Date(serviceEndDate);
        end.setHours(0, 0, 0, 0);
        const diff = end.getTime() - todayMidnight.getTime();
        daysRemaining = Math.ceil(diff / (1000 * 60 * 60 * 24));

        if (daysRemaining < 0) {
          isExpired = true;
        } else if (daysRemaining >= 0 && daysRemaining <= 30) {
          isExpiringSoon = true;
        }
      }

      const displayProjectStatus = isExpired ? 'Inactive' : (clientObj.projectStatus || 'Assigned for Development');

      return {
        _id: clientObj._id,
        name: clientObj.name,
        companyName: clientObj.companyName,
        email: clientObj.email,
        phone: clientObj.phone,
        businessCategory: clientObj.businessCategory,
        businessType: clientObj.businessType,
        industry: clientObj.industry,
        websiteUrl: clientObj.websiteUrl,
        projectStatus: displayProjectStatus,
        isExpired,
        isExpiringSoon,
        daysRemaining,
        serviceStartDate,
        serviceEndDate,
        assignedAccountManager: clientObj.assignedAccountManager ? {
          _id: clientObj.assignedAccountManager._id,
          name: clientObj.assignedAccountManager.name,
          email: clientObj.assignedAccountManager.email,
          employeeId: clientObj.assignedAccountManager.employeeId || ''
        } : null,
        assignedServiceManager: serviceManagerObj,
        serviceManagers: serviceManagerList.map(sm => ({
          _id: sm._id,
          name: sm.name,
          email: sm.email,
          employeeId: sm.employeeId || ''
        })),
        teamAssignments: (clientObj.teamAssignments || []).map(ta => {
          const uObj = typeof ta.user === 'object' ? ta.user : {};
          return {
            _id: uObj._id || ta.user,
            userId: uObj._id || ta.user,
            name: uObj.name || '',
            email: uObj.email || '',
            employeeId: uObj.employeeId || '',
            role: typeof uObj.role === 'object' ? uObj.role?.name : (uObj.role || ''),
            startDate: ta.startDate,
            endDate: ta.endDate
          };
        }),
        assignedTeamMembers: (clientObj.assignedTeamMembers || []).map(m => {
          const matchTa = (clientObj.teamAssignments || []).find(ta => String(ta.user?._id || ta.user) === String(m._id));
          return {
            _id: m._id,
            name: m.name,
            email: m.email,
            employeeId: m.employeeId || '',
            role: typeof m.role === 'object' ? m.role?.name : (m.role || ''),
            startDate: matchTa?.startDate || null,
            endDate: matchTa?.endDate || null
          };
        }),
        packages: sanitizedPackages,
        notes: (clientObj.notes || []).map(n => ({
          _id: n._id,
          note: n.note,
          userName: n.userName,
          date: n.date,
          taggedUsers: (n.taggedUsers || []).map(tu => (typeof tu === 'object' ? {
            _id: tu._id,
            name: tu.name,
            email: tu.email,
            employeeId: tu.employeeId || ''
          } : tu))
        }))
      };
    });

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Create new client directly and trigger Customer Care Executive notification
exports.createClient = async (req, res) => {
  try {
    const { name, companyName, email, phone, address, assignedAccountManager } = req.body;

    if (!name || !companyName || !email) {
      return res.status(400).json({ success: false, message: 'Client name, company name, and email are required.' });
    }

    const existingClient = await Client.findOne({ email });
    if (existingClient) {
      return res.status(400).json({ success: false, message: 'Client with this email already exists.' });
    }

    const client = new Client({
      name,
      companyName,
      email,
      phone,
      address,
      assignedAccountManager: assignedAccountManager || req.user?.id,
      status: 'Active'
    });
    await client.save();

    // Trigger Customer Care Executive notification
    try {
      const { notifyCustomerCareNewClient } = require('../utils/clientNotificationHelper');
      await notifyCustomerCareNewClient(client, req.user);
    } catch (notifErr) {
      console.error('Error triggering Customer Care notification in createClient:', notifErr);
    }

    res.status(201).json({ success: true, data: client });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};
