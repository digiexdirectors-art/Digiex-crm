const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const roleRoutes = require('./routes/roleRoutes');
const userRoutes = require('./routes/userRoutes');
const authRoutes = require('./routes/authRoutes');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Dynamic activity tracking middleware (throttled using in-memory cache)
const jwt = require('jsonwebtoken');
const User = require('./models/User');
const activeUsersCache = new Map();

app.use((req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'digiex_hrms_fallback_secret_key');
      const userId = decoded.id;
      if (userId) {
        const now = Date.now();
        const lastUpdated = activeUsersCache.get(userId.toString());
        if (!lastUpdated || (now - lastUpdated) > 60000) {
          activeUsersCache.set(userId.toString(), now);
          User.findByIdAndUpdate(userId, { lastActive: new Date() }).catch(() => {});
        }
      }
    }
  } catch (err) {
    // Ignore verification errors (invalid/expired tokens), let authMiddleware do enforcement
  }
  next();
});

// MongoDB connection
const seedLeaveTypes = async () => {
  try {
    const LeaveType = require('./models/LeaveType');
    
    // Cleanup other leave types
    await LeaveType.deleteMany({ code: { $nin: ['CL', 'SL', 'ML'] } });

    const defaultTypes = [
      { name: 'Casual Leave', code: 'CL', paid: true, annualAllocation: 22 },
      { name: 'Sick Leave', code: 'SL', paid: true, annualAllocation: 22 },
      { name: 'Maternity Leave', code: 'ML', paid: true, annualAllocation: 182 }
    ];

    for (const t of defaultTypes) {
      let exists = await LeaveType.findOne({ code: t.code });
      if (!exists) {
        await LeaveType.create(t);
        console.log(`Seeded default LeaveType: ${t.name}`);
      } else {
        // Ensure allocation is updated
        exists.annualAllocation = t.annualAllocation;
        exists.name = t.name;
        exists.paid = t.paid;
        await exists.save();
      }
    }
  } catch (err) {
    console.error('Failed to seed LeaveTypes:', err);
  }
};

const seedDefaultRoles = async () => {
  try {
    const Role = require('./models/Role');
    const UserType = require('./models/UserType');
    const Department = require('./models/Department');

    const defaultRoles = [
      { name: 'Fullstack Developer', userType: 'User', department: 'Development' }
    ];

    for (const r of defaultRoles) {
      let roleExists = await Role.findOne({ name: r.name });
      if (!roleExists) {
        let dept = await Department.findOne({ name: r.department });
        if (!dept) {
          dept = await Department.create({ name: r.department });
        }
        let ut = await UserType.findOne({ name: r.userType });
        if (!ut) {
          ut = await UserType.create({ name: r.userType });
        }
        await Role.create({
          name: r.name,
          userType: ut._id,
          department: dept._id
        });
        console.log(`Seeded default Role: ${r.name}`);
      }
    }
  } catch (err) {
    console.error('Failed to seed default roles:', err);
  }
};

mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/digiex_hrms')
  .then(async () => {
    console.log('MongoDB connected successfully to digiex_hrms');
    await seedLeaveTypes();
    await seedDefaultRoles();
  })
  .catch(err => console.error('MongoDB connection error:', err));

// Routes
app.use('/api/roles', roleRoutes);
app.use('/api/users', userRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/departments', require('./routes/departmentRoutes'));
app.use('/api/usertypes', require('./routes/userTypeRoutes'));
app.use('/api/upload', require('./routes/uploadRoutes'));
app.use('/api/attendance', require('./routes/attendanceRoutes'));
app.use('/api/salary', require('./routes/salaryRoutes'));
app.use('/api/holidays', require('./routes/holidayRoutes'));
app.use('/api/settings', require('./routes/settingRoutes'));
app.use('/api/leaves', require('./routes/leaveRoutes'));
app.use('/api/birthday-wishes', require('./routes/birthdayWishRoutes'));
app.use('/api/leads', require('./routes/leadRoutes'));
app.use('/api/locations', require('./routes/locationRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/business-categories', require('./routes/businessCategoryRoutes'));

// Service & Package management routes
app.use('/api/services', require('./routes/serviceRoutes'));
app.use('/api/service-categories', require('./routes/serviceCategoryRoutes'));
app.use('/api/service-details', require('./routes/serviceDetailRoutes'));
app.use('/api/packages', require('./routes/packageRoutes'));
app.use('/api/proposals', require('./routes/proposalRoutes'));
app.use('/api/client-packages', require('./routes/clientPackageRoutes'));
app.use('/api/invoices', require('./routes/invoiceRoutes'));
app.use('/api/clients', require('./routes/clientRoutes'));
app.use('/api/audit-logs', require('./routes/auditLogRoutes'));

// Serve static uploads folder with CORS headers
app.use('/uploads', cors(), express.static('uploads'));

app.get('/', (req, res) => {
  res.send('Digiex HRMS API is running');
});

// Subscription renewal alert task scheduler & Daily SMS notification runner
const ClientPackage = require('./models/ClientPackage');
const Notification = require('./models/Notification');
const Client = require('./models/Client');
const { sendSMS } = require('./utils/notificationHelper');

const checkRenewalsAndAlert = async () => {
  try {
    const activePackages = await ClientPackage.find({ status: { $in: ['Active', 'Pending Renewal', 'In Progress'] } })
      .populate('client')
      .populate('package', 'name code category');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const pkg of activePackages) {
      if (!pkg.client) continue;

      const targetDate = pkg.renewalDate || pkg.endDate;
      if (!targetDate) continue;

      const renewalDate = new Date(targetDate);
      renewalDate.setHours(0, 0, 0, 0);

      const diffTime = renewalDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      const cycle = (pkg.billingCycle || '').toLowerCase();
      const isSixMonthOrYearly = cycle.includes('half-yearly') || cycle.includes('yearly') || cycle.includes('6 month') || cycle.includes('1 year') || cycle.includes('half') || cycle.includes('annual');

      // 1. Daily SMS to client for 6M/1Y subscriptions within 30 days before last renewal day
      if (isSixMonthOrYearly && diffDays >= 0 && diffDays <= 30) {
        const clientPhone = pkg.client.phone || pkg.client.whatsAppNumber || pkg.client.companyPhone;
        const lastSms = pkg.lastSmsSentDate ? new Date(pkg.lastSmsSentDate) : null;
        const alreadySentToday = lastSms && 
          lastSms.getFullYear() === today.getFullYear() && 
          lastSms.getMonth() === today.getMonth() && 
          lastSms.getDate() === today.getDate();

        if (clientPhone && !alreadySentToday) {
          const clientName = pkg.client.companyName || pkg.client.name || 'Valued Client';
          const packageName = pkg.package?.name || pkg.services?.[0]?.name || 'Subscription Package';
          const renewalDateStr = renewalDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
          
          const daysText = diffDays === 0 ? 'today' : `in ${diffDays} day(s)`;
          const smsText = `Dear ${clientName}, your ${packageName} package renewal is due ${daysText} (${renewalDateStr}). Please renew your package to avoid service interruption. - DIGIEX`;

          await sendSMS({ to: clientPhone, message: smsText });
          pkg.lastSmsSentDate = new Date();
          await pkg.save();
          console.log(`[Daily SMS Alert] Sent to ${clientName} (${clientPhone}) for package '${packageName}' (${diffDays} days left).`);
        }
      }

      // 2. Service Off at 12 AM on Last Day (Expiration & Inactive project status)
      if (diffDays < 0) {
        let packageUpdated = false;
        let clientUpdated = false;

        if (pkg.status !== 'Expired') {
          pkg.status = 'Expired';
          packageUpdated = true;
        }

        if (pkg.client && (pkg.client.status !== 'Expired' || pkg.client.projectStatus !== 'Inactive')) {
          await Client.findByIdAndUpdate(pkg.client._id, {
            status: 'Expired',
            projectStatus: 'Inactive'
          });
          clientUpdated = true;
        }

        if (packageUpdated) {
          await pkg.save();
        }

        if (packageUpdated || clientUpdated) {
          console.log(`[Service Off 12 AM] Client '${pkg.client?.companyName || 'Client'}' package '${pkg.package?.name || 'Package'}' set to Expired / Inactive.`);
        }
      }

      // 3. System Notifications for Admins, Account Manager, Sales (30, 15, 7, 1 days before & overdue)
      if ([30, 15, 7, 1].includes(diffDays) || diffDays < 0) {
        const usersList = await User.find().populate('role');
        const recipientIds = [];

        usersList.forEach(u => {
          const rName = (u.role?.name || '').toLowerCase();
          if (rName.includes('admin') || rName.includes('super admin') || rName.includes('sales') || rName.includes('tele')) {
            recipientIds.push(u._id);
          }
        });

        if (pkg.accountManager) recipientIds.push(pkg.accountManager);
        const uniqueRecipients = [...new Set(recipientIds.map(id => id.toString()))];
        const daysText = diffDays < 0 ? `overdue by ${Math.abs(diffDays)} days (Service Off / Inactive)` : `due in ${diffDays} day(s)`;

        const notification = new Notification({
          title: `Subscription Renewal Alert: ${pkg.client ? pkg.client.companyName : 'Client'}`,
          message: `The package subscription for ${pkg.client ? pkg.client.companyName : 'Client'} is ${daysText} (Renewal Date: ${new Date(targetDate).toLocaleDateString('en-GB')}). Please contact client and initiate renewal.`,
          recipients: uniqueRecipients,
          roles: ['admin', 'super admin', 'sales', 'tele marketing'],
          leadId: pkg.lead
        });
        await notification.save();
      }
    }
  } catch (error) {
    console.error('Error running renewal alerts:', error);
  }
};

// Check every 24 hours (and 10s after startup)
setTimeout(checkRenewalsAndAlert, 10000);
setInterval(checkRenewalsAndAlert, 24 * 60 * 60 * 1000);

// Auto-recurring invoice generator (runs 15s after startup and every 24 hours)
const { autoGenerateRecurringInvoices } = require('./controllers/invoiceController');
setTimeout(autoGenerateRecurringInvoices, 15000);
setInterval(autoGenerateRecurringInvoices, 24 * 60 * 60 * 1000);

// Leave manager inaction checks (runs 20s after startup and every 24 hours)
const { checkManagerEscalations } = require('./controllers/leaveController');
setTimeout(checkManagerEscalations, 20000);
setInterval(checkManagerEscalations, 24 * 60 * 60 * 1000);

// Auto-close pending clock outs past 9:00 PM (runs 5s after startup and every 60s)
const { autoClosePendingClockOuts } = require('./controllers/attendanceController');
setTimeout(autoClosePendingClockOuts, 5000);
setInterval(autoClosePendingClockOuts, 60 * 1000);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
