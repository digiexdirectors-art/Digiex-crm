const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Role = require('./models/Role');
const UserType = require('./models/UserType');
const Department = require('./models/Department');

dotenv.config();

mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/digiex_hrms')
  .then(() => console.log('MongoDB connected for seeding'))
  .catch(err => console.error(err));

const rawRoles = [
  { name: 'Sales Head', userType: 'Sub Admin', department: 'Sales' },
  { name: 'Branch Manager', userType: 'Sub Admin', department: 'Sales' },
  { name: 'Sales Manager (Revenue)', userType: 'Sub Admin', department: 'Sales' },
  { name: 'Marketing Manager', userType: 'Sub Admin', department: 'Sales' },
  { name: 'Marketing Executive', userType: 'User', department: 'Sales' },
  { name: 'Tele Sales Manager', userType: 'Sub Admin', department: 'Telemarketing' },
  { name: 'Telemarketing Executive', userType: 'User', department: 'Telemarketing' },
  { name: 'Service Manager', userType: 'Sub Admin', department: 'Service' },
  { name: 'Designer', userType: 'User', department: 'Service' },
  { name: 'Video Editor', userType: 'User', department: 'Service' },
  { name: 'SEO Executive', userType: 'User', department: 'Service' },
  { name: 'SMM Executive', userType: 'User', department: 'Service' },
  { name: 'Team Lead', userType: 'Sub Admin', department: 'Development' },
  { name: 'Web Developer', userType: 'User', department: 'Development' },
  { name: 'Fullstack Developer', userType: 'User', department: 'Development' },
  { name: 'Web Designer', userType: 'User', department: 'Development' },
  { name: 'Super Admin', userType: 'Super Admin', department: 'Management' },
  { name: 'Admin', userType: 'Admin', department: 'Management' }
];

const seedRoles = async () => {
  try {
    await Role.deleteMany();
    await UserType.deleteMany();
    await Department.deleteMany();

    const uniqueUserTypes = [...new Set(rawRoles.map(r => r.userType))];
    const uniqueDepartments = [...new Set(rawRoles.map(r => r.department))];

    const userTypeDocs = await UserType.insertMany(uniqueUserTypes.map(name => ({ name })));
    const deptDocs = await Department.insertMany(uniqueDepartments.map(name => ({ name })));

    const utMap = {};
    userTypeDocs.forEach(doc => utMap[doc.name] = doc._id);

    const deptMap = {};
    deptDocs.forEach(doc => deptMap[doc.name] = doc._id);

    const finalRoles = rawRoles.map(r => ({
      name: r.name,
      userType: utMap[r.userType],
      department: deptMap[r.department]
    }));

    await Role.insertMany(finalRoles);

    console.log('Roles, UserTypes, and Departments seeded successfully!');
    process.exit();
  } catch (error) {
    console.error('Error seeding data:', error);
    process.exit(1);
  }
};

seedRoles();
