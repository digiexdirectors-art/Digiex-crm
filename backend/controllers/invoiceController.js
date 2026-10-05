const Invoice = require('../models/Invoice');
const Client = require('../models/Client');
const CompanySetting = require('../models/CompanySetting');
const AuditLog = require('../models/AuditLog');

// Helper to calculate CGST, SGST, IGST
const calculateInvoiceTaxes = async (taxAmount, clientState) => {
  let companyState = 'West Bengal'; // default fallback
  try {
    const setting = await CompanySetting.findOne({ key: 'address_state' });
    if (setting && setting.value) {
      companyState = setting.value;
    }
  } catch (err) {
    console.error('Failed to get company state setting:', err);
  }

  const isSameState = (companyState || '').trim().toLowerCase() === (clientState || '').trim().toLowerCase();

  let cgst = 0;
  let sgst = 0;
  let igst = 0;

  if (isSameState) {
    cgst = Math.round(taxAmount / 2);
    sgst = taxAmount - cgst; // balance any decimal/odd cents rounding
  } else {
    igst = taxAmount;
  }

  return { cgst, sgst, igst };
};

// Get all clients
exports.getClients = async (req, res) => {
  try {
    const docs = await Client.find().sort({ name: 1 });
    res.status(200).json({ success: true, data: docs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Create Invoice
exports.createInvoice = async (req, res) => {
  try {
    let body = req.body;
    const userId = req.user?.id || null;
    const userName = req.user?.name || 'System';

    // 1. Auto generate invoice number if not provided
    if (!body.invoiceNumber) {
      const count = await Invoice.countDocuments();
      const year = new Date().getFullYear();
      body.invoiceNumber = `INV-${year}-${String(count + 1).padStart(4, '0')}`;
    }

    // 2. Fetch Client details and auto-fill if client exists
    if (body.client) {
      const clientObj = await Client.findById(body.client);
      if (clientObj) {
        body.clientCompanyName = body.clientCompanyName || clientObj.companyName;
        body.clientContactPerson = body.clientContactPerson || clientObj.name;
        body.clientPhone = body.clientPhone || clientObj.phone;
        body.clientEmail = body.clientEmail || clientObj.email;
        body.clientAddress = body.clientAddress || clientObj.address;
      }
    }

    // 3. Calculate taxes
    const taxAmount = Number(body.tax) || 0;
    const clientState = body.clientState || '';
    const { cgst, sgst, igst } = await calculateInvoiceTaxes(taxAmount, clientState);
    body.cgst = cgst;
    body.sgst = sgst;
    body.igst = igst;

    // 4. Set dynamic balance due
    const total = Number(body.total) || 0;
    const paidAmount = Number(body.paidAmount) || 0;
    body.dueAmount = Math.max(0, total - paidAmount);

    if (body.status === 'Paid') {
      body.paidAmount = total;
      body.dueAmount = 0;
      try {
        const Client = require('../models/Client');
        await Client.findByIdAndUpdate(body.client, { status: 'Active' });
      } catch (err) {
        console.error('Failed to auto-activate client on create invoice:', err);
      }
    }

    // 5. Initialize edit history
    body.editHistory = [{
      updatedBy: userId,
      updatedByName: userName,
      updatedAt: new Date(),
      action: 'CREATED',
      newValues: {
        invoiceNumber: body.invoiceNumber,
        total,
        status: body.status,
        paidAmount: body.paidAmount
      }
    }];

    const newDoc = new Invoice(body);
    await newDoc.save();

    // Log in AuditLog
    await AuditLog.create({
      action: 'CREATE',
      module: 'INVOICE',
      documentId: newDoc._id,
      details: { invoiceNumber: newDoc.invoiceNumber, total: newDoc.total },
      performedBy: userId
    });

    res.status(201).json({ success: true, data: newDoc });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Get Invoices
exports.getInvoices = async (req, res) => {
  try {
    const { status, clientId, search } = req.query;
    let query = {};
    if (status) query.status = status;
    if (clientId) query.client = clientId;

    if (search) {
      query.$or = [
        { invoiceNumber: { $regex: search, $options: 'i' } },
        { clientCompanyName: { $regex: search, $options: 'i' } },
        { clientContactPerson: { $regex: search, $options: 'i' } }
      ];
    }

    const docs = await Invoice.find(query)
      .populate('client')
      .populate({
        path: 'clientPackage',
        populate: [{ path: 'lead' }, { path: 'serviceDetails' }]
      })
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, data: docs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get Single Invoice
exports.getInvoiceById = async (req, res) => {
  try {
    const doc = await Invoice.findById(req.params.id)
      .populate('client')
      .populate({
        path: 'clientPackage',
        populate: [{ path: 'lead' }, { path: 'serviceDetails' }]
      })
      .populate('editHistory.updatedBy', 'name email');

    if (!doc) return res.status(404).json({ success: false, message: 'Invoice not found' });
    res.status(200).json({ success: true, data: doc });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update Invoice (with Audit logging)
exports.updateInvoice = async (req, res) => {
  try {
    const invoiceId = req.params.id;
    const userId = req.user?.id || null;
    const userName = req.user?.name || 'System';
    const updates = req.body;

    const oldInvoice = await Invoice.findById(invoiceId);
    if (!oldInvoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    // Recalculate CGST/SGST/IGST if tax or state changes
    if (updates.tax !== undefined || updates.clientState !== undefined) {
      const taxAmount = Number(updates.tax !== undefined ? updates.tax : oldInvoice.tax) || 0;
      const clientState = updates.clientState !== undefined ? updates.clientState : oldInvoice.clientState;
      const { cgst, sgst, igst } = await calculateInvoiceTaxes(taxAmount, clientState);
      updates.cgst = cgst;
      updates.sgst = sgst;
      updates.igst = igst;
    }

    // Recalculate balances
    const total = Number(updates.total !== undefined ? updates.total : oldInvoice.total) || 0;
    const paidAmount = Number(updates.paidAmount !== undefined ? updates.paidAmount : oldInvoice.paidAmount) || 0;
    
    if (updates.status === 'Paid') {
      updates.paidAmount = total;
      updates.dueAmount = 0;
      try {
        const Client = require('../models/Client');
        await Client.findByIdAndUpdate(oldInvoice.client, { status: 'Active' });
      } catch (err) {
        console.error('Failed to auto-activate client on update invoice:', err);
      }
    } else {
      updates.dueAmount = Math.max(0, total - paidAmount);
    }

    if (updates.paymentDate && oldInvoice.clientPackage) {
      try {
        const ClientPackage = require('../models/ClientPackage');
        const start = new Date(updates.paymentDate);
        start.setDate(start.getDate() + 7);
        const end = new Date(start);
        
        const finalStatus = updates.status || oldInvoice.status;
        if (finalStatus === 'Paid') {
          end.setFullYear(start.getFullYear() + 1);
        } else if (finalStatus === 'Partially Paid') {
          end.setMonth(start.getMonth() + 6);
        } else {
          end.setFullYear(start.getFullYear() + 1);
        }

        await ClientPackage.findByIdAndUpdate(oldInvoice.clientPackage, {
          startDate: start,
          endDate: end,
          renewalDate: end
        });
      } catch (err) {
        console.error('Failed to update client package dates on payment date update:', err);
      }
    }

    // Track changed values
    let previousValues = {};
    let newValues = {};
    
    Object.keys(updates).forEach(key => {
      if (key !== 'editHistory' && JSON.stringify(updates[key]) !== JSON.stringify(oldInvoice[key])) {
        previousValues[key] = oldInvoice[key];
        newValues[key] = updates[key];
      }
    });

    const editHistoryEntry = {
      updatedBy: userId,
      updatedByName: userName,
      updatedAt: new Date(),
      action: updates.action || 'UPDATED',
      previousValues,
      newValues
    };

    // Construct updates and push operations
    const updateOps = {
      $set: updates,
      $push: { editHistory: editHistoryEntry }
    };

    if (updates.action === 'PAYMENT_RECORDED' || (updates.paidAmount !== undefined && Number(updates.paidAmount) !== Number(oldInvoice.paidAmount || 0))) {
      const addedAmount = Number(updates.paidAmount || 0) - Number(oldInvoice.paidAmount || 0);
      if (addedAmount > 0) {
        updateOps.$push.payments = {
          amountPaid: addedAmount,
          paymentDate: updates.paymentDate || new Date(),
          paymentMethod: updates.paymentMethod || 'Cash',
          referenceNumber: updates.referenceNumber || '',
          transactionId: updates.transactionId || '',
          paymentNotes: updates.paymentNotes || '',
          nextPaymentDate: updates.dueDate || null,
          recordedBy: userName,
          recordedAt: new Date()
        };
      }
    }

    // Update document using findByIdAndUpdate
    const updatedDoc = await Invoice.findByIdAndUpdate(
      invoiceId,
      updateOps,
      { new: true }
    )
    .populate('client')
    .populate({
      path: 'clientPackage',
      populate: { path: 'serviceDetails' }
    });

    // AuditLog entry
    await AuditLog.create({
      action: 'UPDATE',
      module: 'INVOICE',
      documentId: invoiceId,
      details: { previousValues, newValues },
      performedBy: userId
    });

    res.status(200).json({ success: true, data: updatedDoc });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Clone Invoice
exports.cloneInvoice = async (req, res) => {
  try {
    const invoiceId = req.params.id;
    const userId = req.user?.id || null;
    const userName = req.user?.name || 'System';

    const sourceInvoice = await Invoice.findById(invoiceId);
    if (!sourceInvoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    // Generate new invoice number
    const count = await Invoice.countDocuments();
    const year = new Date().getFullYear();
    const invoiceNumber = `INV-${year}-${String(count + 1).padStart(4, '0')}`;

    // Prepare cloned object
    const clonedData = sourceInvoice.toObject();
    delete clonedData._id;
    delete clonedData.createdAt;
    delete clonedData.updatedAt;
    
    clonedData.invoiceNumber = invoiceNumber;
    clonedData.dueDate = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000); // 15 days from now
    clonedData.status = 'Pending';
    clonedData.paidAmount = 0;
    clonedData.dueAmount = clonedData.total;
    clonedData.paymentMethod = undefined;
    clonedData.paymentDate = undefined;
    clonedData.transactionId = undefined;
    clonedData.referenceNumber = undefined;
    clonedData.bankName = undefined;
    clonedData.paymentNotes = undefined;

    clonedData.editHistory = [{
      updatedBy: userId,
      updatedByName: userName,
      updatedAt: new Date(),
      action: 'CLONED',
      newValues: {
        sourceInvoice: sourceInvoice.invoiceNumber,
        invoiceNumber
      }
    }];

    const newInvoice = new Invoice(clonedData);
    await newInvoice.save();

    res.status(201).json({ success: true, message: 'Invoice cloned successfully', data: newInvoice });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Delete Invoice
exports.deleteInvoice = async (req, res) => {
  try {
    const deletedDoc = await Invoice.findByIdAndDelete(req.params.id);
    if (!deletedDoc) return res.status(404).json({ success: false, message: 'Invoice not found' });
    
    // Log deletion
    await AuditLog.create({
      action: 'DELETE',
      module: 'INVOICE',
      documentId: req.params.id,
      details: { invoiceNumber: deletedDoc.invoiceNumber },
      performedBy: req.user?.id || null
    });

    res.status(200).json({ success: true, message: 'Invoice deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Auto generate recurring invoices
exports.autoGenerateRecurringInvoices = async () => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    console.log('Running recurring invoice auto-generation task...');

    // 1. Process invoices marked as isRecurring: true and due date <= today
    const recurringInvoices = await Invoice.find({
      isRecurring: true,
      dueDate: { $lte: today },
      status: { $ne: 'Cancelled' }
    });

    for (const inv of recurringInvoices) {
      // Calculate next due date
      const currentDueDate = new Date(inv.dueDate);
      let nextDueDate = new Date(currentDueDate);
      
      const cycle = (inv.recurringCycle || 'Monthly').toLowerCase();
      if (cycle === 'monthly') {
        nextDueDate.setMonth(nextDueDate.getMonth() + 1);
      } else if (cycle === 'quarterly') {
        nextDueDate.setMonth(nextDueDate.getMonth() + 3);
      } else if (cycle === 'half-yearly') {
        nextDueDate.setMonth(nextDueDate.getMonth() + 6);
      } else if (cycle === 'yearly') {
        nextDueDate.setFullYear(nextDueDate.getFullYear() + 1);
      } else {
        nextDueDate.setMonth(nextDueDate.getMonth() + 1);
      }

      // Generate new invoice number
      const count = await Invoice.countDocuments();
      const year = new Date().getFullYear();
      const invoiceNumber = `INV-${year}-${String(count + 1).padStart(4, '0')}`;

      // Create new invoice copy
      const clonedData = inv.toObject();
      delete clonedData._id;
      delete clonedData.createdAt;
      delete clonedData.updatedAt;

      clonedData.invoiceNumber = invoiceNumber;
      clonedData.dueDate = nextDueDate;
      clonedData.status = 'Unpaid';
      clonedData.paidAmount = 0;
      clonedData.dueAmount = clonedData.total;
      clonedData.paymentMethod = undefined;
      clonedData.paymentDate = undefined;
      clonedData.transactionId = undefined;
      clonedData.referenceNumber = undefined;
      clonedData.bankName = undefined;
      clonedData.paymentNotes = undefined;
      clonedData.isRecurring = true; // New invoice carries the recurring flag

      clonedData.editHistory = [{
        updatedBy: null,
        updatedByName: 'System Scheduler',
        updatedAt: new Date(),
        action: 'AUTO_GENERATED',
        newValues: {
          sourceInvoice: inv.invoiceNumber,
          invoiceNumber
        }
      }];

      const newInvoice = new Invoice(clonedData);
      await newInvoice.save();

      // Deactivate recurring on the old invoice so we don't process it again
      inv.isRecurring = false;
      await inv.save();

      console.log(`Auto-generated recurring invoice ${invoiceNumber} from source ${inv.invoiceNumber}`);
    }

    // 2. Process ClientPackages whose renewalDate <= today
    const ClientPackage = require('../models/ClientPackage');
    const activePackages = await ClientPackage.find({
      status: 'Active',
      renewalDate: { $lte: today }
    });

    for (const pkg of activePackages) {
      // Check if we already generated an invoice for this package for this renewal cycle to avoid duplicates
      const existingInvoice = await Invoice.findOne({
        clientPackage: pkg._id,
        dueDate: { $gte: pkg.renewalDate }
      });

      if (existingInvoice) {
        console.log(`Invoice already exists for client package ${pkg._id} renewal date ${pkg.renewalDate}`);
        continue;
      }

      // Calculate next renewal date
      const oldEndDate = new Date(pkg.endDate);
      const nextStartDate = new Date(oldEndDate);
      let nextEndDate = new Date(oldEndDate);
      
      const cycle = (pkg.billingCycle || 'Monthly').toLowerCase();
      if (cycle === 'monthly') {
        nextEndDate.setMonth(nextEndDate.getMonth() + 1);
      } else if (cycle === 'quarterly') {
        nextEndDate.setMonth(nextEndDate.getMonth() + 3);
      } else if (cycle === 'half-yearly') {
        nextEndDate.setMonth(nextEndDate.getMonth() + 6);
      } else if (cycle === 'yearly') {
        nextEndDate.setFullYear(nextEndDate.getFullYear() + 1);
      } else {
        nextEndDate.setMonth(nextEndDate.getMonth() + 1);
      }

      // Update package details
      pkg.startDate = nextStartDate;
      pkg.endDate = nextEndDate;
      pkg.renewalDate = nextEndDate;
      await pkg.save();

      // Generate invoice
      const invoiceCount = await Invoice.countDocuments();
      const year = new Date().getFullYear();
      const invoiceNumber = `INV-${year}-${String(invoiceCount + 1).padStart(4, '0')}`;

      // Calculate taxes dynamically based on client state
      const Client = require('../models/Client');
      const clientObj = await Client.findById(pkg.client);
      
      let clientState = '';
      let clientCompanyName = '';
      let clientContactPerson = '';
      let clientPhone = '';
      let clientEmail = '';
      let clientAddress = '';
      let clientGstNumber = '';

      if (clientObj) {
        clientState = clientObj.state || '';
        clientCompanyName = clientObj.companyName || '';
        clientContactPerson = clientObj.name || '';
        clientPhone = clientObj.phone || '';
        clientEmail = clientObj.email || '';
        clientAddress = clientObj.address || '';
        clientGstNumber = clientObj.gstNumber || '';
      }

      // Tax calculation
      const subtotal = pkg.price || 0;
      const gstAmount = pkg.gstAmount || 0;
      const total = pkg.total || 0;

      const { cgst, sgst, igst } = await calculateInvoiceTaxes(gstAmount, clientState);

      const items = (pkg.services && pkg.services.length > 0)
        ? pkg.services.map(s => {
            return {
              serviceName: s.name,
              description: `Service: ${s.name} (${pkg.billingCycle} Plan)`,
              quantity: 1,
              unitPrice: s.price || (subtotal / pkg.services.length),
              discount: 0,
              amount: s.price || (subtotal / pkg.services.length),
              gstRate: 18,
              gstAmount: Math.round((s.price || (subtotal / pkg.services.length)) * 0.18),
              total: Math.round((s.price || (subtotal / pkg.services.length)) * 1.18)
            };
          })
        : [{
            description: `Subscription Renewal - ${pkg.billingCycle} Plan (${nextStartDate.toLocaleDateString()} to ${nextEndDate.toLocaleDateString()})`,
            quantity: 1,
            unitPrice: subtotal,
            discount: 0,
            amount: subtotal,
            gstRate: 18,
            gstAmount: gstAmount,
            total: total
          }];

      const invoice = new Invoice({
        invoiceNumber,
        client: pkg.client,
        clientPackage: pkg._id,
        billingCycle: pkg.billingCycle,
        clientCompanyName,
        clientGstNumber,
        clientContactPerson,
        clientPhone,
        clientEmail,
        clientAddress,
        clientState,
        clientCountry: clientObj?.country || '',
        amount: subtotal,
        discount: 0,
        tax: gstAmount,
        cgst,
        sgst,
        igst,
        total,
        dueDate: nextStartDate, // due at start of renewal period
        status: 'Unpaid',
        paidAmount: 0,
        dueAmount: total,
        isRecurring: false, // ClientPackage handles its own recurring cycle
        items,
        editHistory: [{
          updatedBy: null,
          updatedByName: 'System Scheduler',
          updatedAt: new Date(),
          action: 'AUTO_GENERATED',
          newValues: {
            clientPackage: pkg._id,
            invoiceNumber
          }
        }]
      });

      await invoice.save();
      console.log(`Auto-generated package renewal invoice ${invoiceNumber} for client package ${pkg._id}`);
    }

  } catch (error) {
    console.error('Error running recurring invoice generator:', error);
  }
};

