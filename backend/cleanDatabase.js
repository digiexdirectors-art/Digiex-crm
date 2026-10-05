const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/digiex_hrms';

// Import all models
const Attendance = require('./models/Attendance');
const AuditLog = require('./models/AuditLog');
const BirthdayWish = require('./models/BirthdayWish');
const BusinessCategory = require('./models/BusinessCategory');
const Client = require('./models/Client');
const ClientPackage = require('./models/ClientPackage');
const CompanySetting = require('./models/CompanySetting');
const Department = require('./models/Department');
const EmailLog = require('./models/EmailLog');
const Holiday = require('./models/Holiday');
const Invoice = require('./models/Invoice');
const Lead = require('./models/Lead');
const LeaveBalance = require('./models/LeaveBalance');
const LeaveRequest = require('./models/LeaveRequest');
const LeaveType = require('./models/LeaveType');
const Location = require('./models/Location');
const Notification = require('./models/Notification');
const Package = require('./models/Package');
const Project = require('./models/Project');
const Proposal = require('./models/Proposal');
const Role = require('./models/Role');
const SalarySlip = require('./models/SalarySlip');
const Service = require('./models/Service');
const ServiceCategory = require('./models/ServiceCategory');
const ServiceDetail = require('./models/ServiceDetail');
const User = require('./models/User');
const UserType = require('./models/UserType');

const cleanDatabase = async () => {
  try {
    console.log(`Connecting to MongoDB at: ${MONGO_URI}...`);
    await mongoose.connect(MONGO_URI);
    console.log('MongoDB connected successfully.\n');

    // 1. Identify Super Admin and Admin Roles and UserTypes
    const adminUserTypes = await UserType.find({ name: { $in: ['Super Admin', 'Admin'] } });
    const adminUserTypeIds = adminUserTypes.map(ut => ut._id);

    const adminRoles = await Role.find({
      $or: [
        { name: { $in: ['Super Admin', 'Admin'] } },
        { userType: { $in: adminUserTypeIds } }
      ]
    });
    const adminRoleIds = adminRoles.map(r => r._id);

    // 2. Identify Super Admin and Admin Users to KEEP
    const adminUsers = await User.find({
      $or: [
        { role: { $in: adminRoleIds } },
        { email: 'admin@digiexweb.com' }
      ]
    });

    const adminUserIds = adminUsers.map(u => u._id);
    console.log('=== ADMIN USERS TO PRESERVE ===');
    if (adminUsers.length === 0) {
      console.log('WARNING: No admin users found via role search! Preserving users with admin/superadmin email pattern to prevent lockout.');
      const fallbackAdmins = await User.find({
        $or: [
          { email: /admin/i },
          { email: /superadmin/i }
        ]
      });
      fallbackAdmins.forEach(u => {
        adminUserIds.push(u._id);
        console.log(`- ${u.name} (${u.email}) [ID: ${u._id}]`);
      });
    } else {
      adminUsers.forEach(u => console.log(`- ${u.name} (${u.email}) [ID: ${u._id}]`));
    }
    console.log('');

    // Models mapping
    const collectionsToPurgeCompletely = [
      { name: 'Attendance', model: Attendance },
      { name: 'AuditLog', model: AuditLog },
      { name: 'BirthdayWish', model: BirthdayWish },
      { name: 'Client', model: Client },
      { name: 'ClientPackage', model: ClientPackage },
      { name: 'EmailLog', model: EmailLog },
      { name: 'Invoice', model: Invoice },
      { name: 'Lead', model: Lead },
      { name: 'LeaveBalance', model: LeaveBalance },
      { name: 'LeaveRequest', model: LeaveRequest },
      { name: 'Notification', model: Notification },
      { name: 'Project', model: Project },
      { name: 'Proposal', model: Proposal },
      { name: 'SalarySlip', model: SalarySlip },
    ];

    const collectionsToKeep = [
      { name: 'BusinessCategory', model: BusinessCategory },
      { name: 'CompanySetting', model: CompanySetting },
      { name: 'Department', model: Department },
      { name: 'Holiday', model: Holiday },
      { name: 'LeaveType', model: LeaveType },
      { name: 'Location', model: Location },
      { name: 'Package', model: Package },
      { name: 'Role', model: Role },
      { name: 'Service', model: Service },
      { name: 'ServiceCategory', model: ServiceCategory },
      { name: 'ServiceDetail', model: ServiceDetail },
      { name: 'UserType', model: UserType },
    ];

    const summaryResults = [];

    // Process Partial Purge: User Collection
    const userCountBefore = await User.countDocuments();
    const userDeleteResult = await User.deleteMany({ _id: { $nin: adminUserIds } });
    const userCountAfter = await User.countDocuments();
    summaryResults.push({
      Collection: 'User',
      Status: 'PARTIALLY PURGED',
      Before: userCountBefore,
      Deleted: userDeleteResult.deletedCount,
      After: userCountAfter
    });

    // Process Complete Purge Collections
    for (const item of collectionsToPurgeCompletely) {
      const countBefore = await item.model.countDocuments();
      const deleteResult = await item.model.deleteMany({});
      const countAfter = await item.model.countDocuments();
      summaryResults.push({
        Collection: item.name,
        Status: 'PURGED',
        Before: countBefore,
        Deleted: deleteResult.deletedCount,
        After: countAfter
      });
    }

    // Process Kept Collections (Report counts)
    for (const item of collectionsToKeep) {
      const count = await item.model.countDocuments();
      summaryResults.push({
        Collection: item.name,
        Status: 'KEPT (SETTINGS / MASTER)',
        Before: count,
        Deleted: 0,
        After: count
      });
    }

    console.log('=== DATABASE CLEANUP SUMMARY ===');
    console.table(summaryResults);

    console.log('\nDatabase cleanup completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Error cleaning database:', error);
    process.exit(1);
  }
};

cleanDatabase();
