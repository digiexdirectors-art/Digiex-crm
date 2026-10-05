const ClientPackage = require('../models/ClientPackage');
const Lead = require('../models/Lead');
const Client = require('../models/Client');
const Invoice = require('../models/Invoice');

// Lead to Client Conversion & Package Assignment
exports.convertLeadToClient = async (req, res) => {
  try {
    const { 
      leadId, 
      packageId, 
      proposalId, 
      customServices, 
      startDate, 
      endDate, 
      billingCycle, 
      price, 
      gstAmount, 
      total, 
      accountManager 
    } = req.body;

    const lead = await Lead.findById(leadId);
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });

    // 1. Create or Find Client
    let client = await Client.findOne({ email: lead.email || 'no-email@crm.com' });
    
    let gstNumber = '';
    if (lead.kycGst) {
      const parts = lead.kycGst.split(',');
      for (const p of parts) {
        const colIdx = p.indexOf(':');
        if (colIdx !== -1) {
          const type = p.substring(0, colIdx).trim().toUpperCase();
          const val = p.substring(colIdx + 1).trim();
          if (type === 'GST') {
            gstNumber = val;
            break;
          }
        } else if (p.trim().length === 15) {
          gstNumber = p.trim().toUpperCase();
          break;
        }
      }
    }

    if (!client) {
      client = new Client({
        name: lead.contactPerson || lead.businessName,
        companyName: lead.businessName,
        email: lead.email || `client-${Date.now()}@crm.com`,
        phone: lead.phone,
        address: lead.address || lead.location,
        assignedAccountManager: accountManager || lead.assignedSales,
        status: 'Active',
        gstNumber: gstNumber,
        isGstVerified: lead.isGstVerified || false
      });
      await client.save();
    } else {
      if (gstNumber && (!client.gstNumber || client.gstNumber !== gstNumber || client.isGstVerified !== lead.isGstVerified)) {
        client.gstNumber = gstNumber;
        client.isGstVerified = lead.isGstVerified || false;
        await client.save();
      }
    }

    // 2. Update Lead stage
    lead.stage = req.body.stage || 'Deal Close';
    if (lead.appointmentHistory) {
      lead.appointmentHistory.unshift({
        status: req.body.stage || 'Deal Close',
        remarks: req.body.remarks || 'Lead converted to client and package assigned.',
        changedBy: req.body.changedBy || 'System',
        changedAt: new Date()
      });
    }
    await lead.save();

    // 3. Create Subscription
    const clientPackage = new ClientPackage({
      client: client._id,
      lead: lead._id,
      package: packageId || null,
      proposal: proposalId || null,
      services: customServices || [],
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      billingCycle,
      price,
      gstAmount,
      total,
      renewalDate: new Date(endDate),
      accountManager: accountManager || lead.assignedSales,
      serviceDetails: req.body.serviceDetails || [],
      status: 'Active'
    });
    await clientPackage.save();

    // 4. Create Invoice
    let packageCategory = 'Custom Services';
    let packageName = 'Custom Package';

    if (packageId) {
      const Package = require('../models/Package');
      const pkg = await Package.findById(packageId);
      if (pkg) {
        packageCategory = pkg.category;
        packageName = pkg.name;
      }
    } else if (customServices && customServices.length > 0) {
      try {
        const Service = require('../models/Service');
        const firstService = await Service.findById(customServices[0].serviceId);
        if (firstService) {
          packageName = customServices.map(s => s.name).join(', ');
          const ServiceCategory = require('../models/ServiceCategory');
          const cat = await ServiceCategory.findById(firstService.category);
          if (cat) {
            packageCategory = cat.name;
          }
        }
      } catch (err) {
        console.error('Failed to get custom services categories:', err);
      }
    }

    const invoiceCount = await Invoice.countDocuments();
    const year = new Date().getFullYear();
    const invoiceNumber = `INV-${year}-${String(invoiceCount + 1).padStart(4, '0')}`;

    const stage = req.body.stage || 'Deal Close';
    let inputPaidAmount = Number(req.body.paidAmount) || 0;
    
    let invoiceStatus = 'Pending';
    let invoicePaidAmount = 0;
    
    if (stage === 'Deal Won With Full Payment' || stage === 'Deal Close With Full Payment' || inputPaidAmount >= total) {
      invoiceStatus = 'Paid';
      invoicePaidAmount = total;
    } else if (stage === 'Deal Won With Partial Payment' || stage === 'Deal Close With Partial Payment' || inputPaidAmount > 0) {
      invoiceStatus = 'Partially Paid';
      invoicePaidAmount = Math.min(inputPaidAmount, total);
    }
    
    const invoiceDueAmount = total - invoicePaidAmount;

    const invoice = new Invoice({
      invoiceNumber,
      client: client._id,
      category: packageCategory,
      packageOrService: packageName,
      clientPackage: clientPackage._id,
      billingCycle,
      clientCompanyName: client.companyName,
      clientContactPerson: client.name,
      clientPhone: client.phone,
      clientEmail: client.email,
      clientAddress: client.address,
      amount: price,
      tax: gstAmount,
      total,
      dueDate: new Date(startDate),
      status: invoiceStatus,
      paidAmount: invoicePaidAmount,
      dueAmount: invoiceDueAmount,
      paymentMethod: invoicePaidAmount > 0 ? (req.body.paymentMethod || 'Bank Transfer') : undefined,
      paymentDate: invoicePaidAmount > 0 ? (req.body.paymentDate ? new Date(req.body.paymentDate) : new Date()) : undefined,
      items: (customServices && customServices.length > 0) 
        ? customServices.map(s => {
            return {
              serviceName: s.name,
              description: `Service: ${s.name} (${billingCycle} Plan)`,
              amount: s.price || 0,
              gstRate: 18,
              gstAmount: Math.round((s.price || 0) * 0.18),
              total: Math.round((s.price || 0) * 1.18)
            };
          })
        : [{
            description: `Package Subscription (${billingCycle} Plan)`,
            amount: price,
            gstRate: 18,
            gstAmount: gstAmount,
            total: total
          }]
    });
    await invoice.save();

    // Trigger Customer Care Executive profile notification for new client onboarding
    try {
      const { notifyCustomerCareNewClient } = require('../utils/clientNotificationHelper');
      await notifyCustomerCareNewClient(client, req.user);
    } catch (notifErr) {
      console.error('Failed to trigger customer care notification:', notifErr);
    }

    res.status(201).json({ 
      success: true, 
      message: 'Lead converted and package assigned successfully', 
      data: { client, clientPackage, invoice } 
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.getClientPackages = async (req, res) => {
  try {
    const { status, clientId } = req.query;
    let query = {};
    if (status) query.status = status;
    if (clientId) query.client = clientId;

    const docs = await ClientPackage.find(query)
      .populate('client')
      .populate({
        path: 'lead',
        populate: [
          { 
            path: 'assignedTelecaller',
            populate: { path: 'reportingManager' }
          },
          { path: 'assignedSales' }
        ]
      })
      .populate('package')
      .populate('accountManager')
      .populate('serviceDetails');
    res.status(200).json({ success: true, data: docs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateClientPackage = async (req, res) => {
  try {
    const updatedDoc = await ClientPackage.findByIdAndUpdate(req.params.id, req.body, { new: true })
      .populate('client')
      .populate({
        path: 'lead',
        populate: [
          { 
            path: 'assignedTelecaller',
            populate: { path: 'reportingManager' }
          },
          { path: 'assignedSales' }
        ]
      })
      .populate('package')
      .populate('accountManager')
      .populate('serviceDetails');
    if (!updatedDoc) return res.status(404).json({ success: false, message: 'Subscription not found' });
    res.status(200).json({ success: true, data: updatedDoc });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.deleteClientPackage = async (req, res) => {
  try {
    const deletedDoc = await ClientPackage.findByIdAndDelete(req.params.id);
    if (!deletedDoc) return res.status(404).json({ success: false, message: 'Subscription not found' });
    res.status(200).json({ success: true, message: 'Subscription deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.renewClientPackage = async (req, res) => {
  try {
    const { id } = req.params;
    const { newEndDate, newBillingCycle, newPrice, newGstAmount, newTotal } = req.body;

    const clientPkg = await ClientPackage.findById(id);
    if (!clientPkg) return res.status(404).json({ success: false, message: 'Subscription not found' });

    const oldEndDate = clientPkg.endDate;
    clientPkg.startDate = oldEndDate;
    clientPkg.endDate = new Date(newEndDate);
    clientPkg.renewalDate = new Date(newEndDate);
    if (newBillingCycle) clientPkg.billingCycle = newBillingCycle;
    if (newPrice !== undefined) clientPkg.price = newPrice;
    if (newGstAmount !== undefined) clientPkg.gstAmount = newGstAmount;
    if (newTotal !== undefined) clientPkg.total = newTotal;
    clientPkg.status = 'Active';
    await clientPkg.save();

    // Generate renewal invoice
    const invoiceCount = await Invoice.countDocuments();
    const year = new Date().getFullYear();
    const invoiceNumber = `INV-${year}-${String(invoiceCount + 1).padStart(4, '0')}`;

    const invoice = new Invoice({
      invoiceNumber,
      client: clientPkg.client,
      clientPackage: clientPkg._id,
      billingCycle: clientPkg.billingCycle,
      amount: clientPkg.price,
      tax: clientPkg.gstAmount,
      total: clientPkg.total,
      dueDate: new Date(oldEndDate),
      status: 'Pending',
      items: [{
        description: `Subscription Renewal - ${clientPkg.billingCycle} Plan (${clientPkg.startDate.toLocaleDateString()} to ${clientPkg.endDate.toLocaleDateString()})`,
        amount: clientPkg.price,
        gstRate: 18,
        gstAmount: clientPkg.gstAmount,
        total: clientPkg.total
      }]
    });
    await invoice.save();

    res.status(200).json({ success: true, message: 'Subscription renewed successfully', data: clientPkg });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.addServiceDirectly = async (req, res) => {
  try {
    const { clientId, name, category, deliverables, startDate, endDate, status, description, price, renewalDate, assignedTeam } = req.body;
    
    const clientPackage = new ClientPackage({
      client: clientId,
      services: [{ name, category, deliverables: deliverables || [], serviceId: null }],
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      status: status || 'Active',
      price: Number(price) || 0,
      gstAmount: Math.round((Number(price) || 0) * 0.18),
      total: Math.round((Number(price) || 0) * 1.18),
      renewalDate: renewalDate ? new Date(renewalDate) : new Date(endDate),
      billingCycle: 'Monthly',
      notes: description,
      assignedTeam,
      lastUpdatedBy: req.user?.name || 'System',
      lastUpdatedAt: new Date()
    });
    await clientPackage.save();

    // Log to AuditLog
    const AuditLog = require('../models/AuditLog');
    const log = new AuditLog({
      client: clientId,
      action: 'SERVICE_ADD',
      user: req.user?.id || req.user?._id,
      userName: req.user?.name || 'System',
      userRole: req.user?.role?.name || 'System',
      newValue: { name, price, startDate, endDate, assignedTeam }
    });
    await log.save();

    res.status(201).json({ success: true, data: clientPackage });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.updateServiceDirectly = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, category, deliverables, services, serviceDetails, startDate, endDate, status, description, price, renewalDate, assignedTeam } = req.body;

    const clientPkg = await ClientPackage.findById(id);
    if (!clientPkg) return res.status(404).json({ success: false, message: 'Service not found' });

    const oldVal = {
      name: clientPkg.services?.[0]?.name || '',
      category: clientPkg.services?.[0]?.category || '',
      deliverables: clientPkg.services?.[0]?.deliverables || [],
      price: clientPkg.price,
      startDate: clientPkg.startDate,
      endDate: clientPkg.endDate,
      status: clientPkg.status,
      assignedTeam: clientPkg.assignedTeam,
      notes: clientPkg.notes
    };

    if (services && Array.isArray(services)) {
      clientPkg.services = services.map(s => ({
        name: s.name,
        category: s.category || null,
        deliverables: s.deliverables || [],
        serviceId: s.serviceId || null
      }));
    } else if (name) {
      clientPkg.services = [{ 
        name, 
        category: category || clientPkg.services?.[0]?.category || null, 
        deliverables: deliverables || clientPkg.services?.[0]?.deliverables || [], 
        serviceId: null 
      }];
    } else {
      if (clientPkg.services && clientPkg.services.length > 0) {
        if (category) clientPkg.services[0].category = category;
        if (deliverables) clientPkg.services[0].deliverables = deliverables;
      } else {
        clientPkg.services = [{ name: '', category, deliverables: deliverables || [], serviceId: null }];
      }
    }
    if (serviceDetails && Array.isArray(serviceDetails)) {
      clientPkg.serviceDetails = serviceDetails;
    }
    if (startDate) clientPkg.startDate = new Date(startDate);
    if (endDate) clientPkg.endDate = new Date(endDate);
    if (status) clientPkg.status = status;
    if (description !== undefined) clientPkg.notes = description;
    if (price !== undefined) {
      clientPkg.price = Number(price);
      clientPkg.gstAmount = Math.round(Number(price) * 0.18);
      clientPkg.total = Math.round(Number(price) * 1.18);
    }
    if (renewalDate) clientPkg.renewalDate = new Date(renewalDate);
    if (assignedTeam !== undefined) clientPkg.assignedTeam = assignedTeam;

    clientPkg.lastUpdatedBy = req.user?.name || 'System';
    clientPkg.lastUpdatedAt = new Date();

    await clientPkg.save();

    // Log to AuditLog
    const AuditLog = require('../models/AuditLog');
    const log = new AuditLog({
      client: clientPkg.client,
      action: 'SERVICE_UPDATE',
      user: req.user?.id || req.user?._id,
      userName: req.user?.name || 'System',
      userRole: req.user?.role?.name || 'System',
      oldValue: oldVal,
      newValue: {
        name: clientPkg.services?.[0]?.name || '',
        price: clientPkg.price,
        startDate: clientPkg.startDate,
        endDate: clientPkg.endDate,
        status: clientPkg.status,
        assignedTeam: clientPkg.assignedTeam,
        notes: clientPkg.notes
      }
    });
    await log.save();

    res.status(200).json({ success: true, data: clientPkg });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.addFeature = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, status, estimatedCost, approvalStatus } = req.body;

    const clientPkg = await ClientPackage.findById(id);
    if (!clientPkg) return res.status(404).json({ success: false, message: 'Service not found' });

    clientPkg.features.push({
      name,
      description,
      status: status || 'Pending',
      estimatedCost: Number(estimatedCost) || 0,
      approvalStatus: approvalStatus || 'Pending'
    });
    clientPkg.lastUpdatedBy = req.user?.name || 'System';
    clientPkg.lastUpdatedAt = new Date();
    await clientPkg.save();

    const addedFeature = clientPkg.features[clientPkg.features.length - 1];

    // Log to AuditLog
    const AuditLog = require('../models/AuditLog');
    const log = new AuditLog({
      client: clientPkg.client,
      action: 'FEATURE_ADD',
      user: req.user?.id || req.user?._id,
      userName: req.user?.name || 'System',
      userRole: req.user?.role?.name || 'System',
      newValue: addedFeature
    });
    await log.save();

    res.status(201).json({ success: true, data: clientPkg });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.updateFeature = async (req, res) => {
  try {
    const { id, featureId } = req.params;
    const { name, description, status, estimatedCost, approvalStatus } = req.body;

    const clientPkg = await ClientPackage.findById(id);
    if (!clientPkg) return res.status(404).json({ success: false, message: 'Service not found' });

    const feature = clientPkg.features.id(featureId);
    if (!feature) return res.status(404).json({ success: false, message: 'Feature not found' });

    const oldVal = { ...feature.toObject() };

    if (name) feature.name = name;
    if (description !== undefined) feature.description = description;
    if (status) feature.status = status;
    if (estimatedCost !== undefined) feature.estimatedCost = Number(estimatedCost);
    if (approvalStatus) feature.approvalStatus = approvalStatus;

    clientPkg.lastUpdatedBy = req.user?.name || 'System';
    clientPkg.lastUpdatedAt = new Date();

    await clientPkg.save();

    // Log to AuditLog
    const AuditLog = require('../models/AuditLog');
    const log = new AuditLog({
      client: clientPkg.client,
      action: 'FEATURE_UPDATE',
      user: req.user?.id || req.user?._id,
      userName: req.user?.name || 'System',
      userRole: req.user?.role?.name || 'System',
      oldValue: oldVal,
      newValue: feature
    });
    await log.save();

    res.status(200).json({ success: true, data: clientPkg });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.deleteFeature = async (req, res) => {
  try {
    const { id, featureId } = req.params;

    const clientPkg = await ClientPackage.findById(id);
    if (!clientPkg) return res.status(404).json({ success: false, message: 'Service not found' });

    const feature = clientPkg.features.id(featureId);
    if (!feature) return res.status(404).json({ success: false, message: 'Feature not found' });

    const oldVal = { ...feature.toObject() };

    clientPkg.features.pull({ _id: featureId });
    clientPkg.lastUpdatedBy = req.user?.name || 'System';
    clientPkg.lastUpdatedAt = new Date();
    await clientPkg.save();

    // Log to AuditLog
    const AuditLog = require('../models/AuditLog');
    const log = new AuditLog({
      client: clientPkg.client,
      action: 'FEATURE_DELETE',
      user: req.user?.id || req.user?._id,
      userName: req.user?.name || 'System',
      userRole: req.user?.role?.name || 'System',
      oldValue: oldVal
    });
    await log.save();

    res.status(200).json({ success: true, message: 'Feature deleted successfully', data: clientPkg });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Update Expiration Date for a Client / Project (Accessible by Account Manager, Admin, Super Admin)
exports.updateProjectExpiration = async (req, res) => {
  try {
    const { clientId, newExpirationDate } = req.body;
    const targetClientId = req.params.clientId || clientId;
    const userRole = (req.user?.role?.name || '').toLowerCase();
    const userType = (typeof req.user?.role?.userType === 'object' ? req.user?.role?.userType?.name : req.user?.role?.userType || '').toLowerCase();

    const isAdmin = ['admin', 'super admin'].includes(userRole) || ['admin', 'super admin'].includes(userType);
    const isAccountManager = userRole.includes('account manager') || userRole.includes('bdm');

    const client = await Client.findById(targetClientId);
    if (!client) return res.status(404).json({ success: false, message: 'Client not found' });

    // Check authorization: Admin, Super Admin, or assigned Account Manager
    const isAssignedAM = String(client.assignedAccountManager) === String(req.user?.id || req.user?._id);
    if (!isAdmin && !isAccountManager && !isAssignedAM) {
      return res.status(403).json({ success: false, message: 'Only Account Manager, Admin, or Super Admin can set/update expiration date' });
    }

    const expDate = new Date(newExpirationDate);
    if (isNaN(expDate.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid expiration date' });
    }

    const nowMidnight = new Date();
    nowMidnight.setHours(0, 0, 0, 0);
    const isFuture = expDate >= nowMidnight;

    // Find all ClientPackages for this client and update their endDate & renewalDate
    const pkgs = await ClientPackage.find({ client: client._id });
    if (pkgs.length > 0) {
      for (const pkg of pkgs) {
        pkg.endDate = expDate;
        pkg.renewalDate = expDate;
        pkg.status = isFuture ? 'Active' : 'Expired';
        await pkg.save();
      }
    } else {
      // Create a subscription record if none exists
      const clientPkg = new ClientPackage({
        client: client._id,
        startDate: new Date(),
        endDate: expDate,
        renewalDate: expDate,
        billingCycle: 'Monthly',
        price: 0,
        gstAmount: 0,
        total: 0,
        accountManager: client.assignedAccountManager || req.user?.id,
        status: isFuture ? 'Active' : 'Expired'
      });
      await clientPkg.save();
    }

    // Update Client status if expired or active
    if (!isFuture) {
      client.status = 'Expired';
      client.projectStatus = 'On Hold';
    } else if (client.status === 'Expired') {
      client.status = 'Active';
      if (client.projectStatus === 'On Hold') {
        client.projectStatus = 'In Development';
      }
    }

    // Add timeline log
    const userName = req.user?.name || 'User';
    client.timeline.unshift({
      title: 'Project Expiration Date Updated',
      description: `Expiration date set to ${expDate.toLocaleDateString('en-GB')} by ${userName}`,
      date: new Date()
    });
    await client.save();

    res.status(200).json({ 
      success: true, 
      message: 'Expiration date updated successfully', 
      data: { expirationDate: expDate } 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get all 6-month & 1-year client package renewals expiring within 30 days or overdue
exports.getExpiringRenewals = async (req, res) => {
  try {
    const packages = await ClientPackage.find()
      .populate('client')
      .populate('package', 'name code category');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const result = [];

    for (const pkg of packages) {
      if (!pkg.client) continue;

      const cycle = (pkg.billingCycle || '').toLowerCase();
      const isSixMonthOrYearly = cycle.includes('half-yearly') || cycle.includes('yearly') || cycle.includes('6 month') || cycle.includes('1 year') || cycle.includes('half') || cycle.includes('annual');

      const targetDate = pkg.renewalDate || pkg.endDate;
      if (!targetDate) continue;

      const end = new Date(targetDate);
      end.setHours(0, 0, 0, 0);

      const diffTime = end.getTime() - today.getTime();
      const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      // Filter for 6-month or 1-year renewals within 30 days of expiration or overdue
      if (isSixMonthOrYearly && daysRemaining <= 30) {
        result.push({
          _id: pkg._id,
          clientId: pkg.client._id,
          clientName: pkg.client.companyName || pkg.client.name,
          contactPerson: pkg.client.name,
          clientPhone: pkg.client.phone || pkg.client.whatsAppNumber,
          clientEmail: pkg.client.email,
          packageName: pkg.package?.name || pkg.services?.[0]?.name || 'Custom Package',
          billingCycle: pkg.billingCycle,
          startDate: pkg.startDate,
          endDate: pkg.endDate,
          lastRenewalDate: targetDate,
          daysRemaining,
          isExpired: daysRemaining < 0,
          isExpiringSoon: daysRemaining >= 0 && daysRemaining <= 30,
          status: pkg.status
        });
      }
    }

    result.sort((a, b) => a.daysRemaining - b.daysRemaining);

    res.status(200).json({ success: true, count: result.length, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

