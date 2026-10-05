const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const Role = require('./models/Role');

dotenv.config();

mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/digiex_hrms')
  .then(() => console.log('MongoDB connected for Super Admin seeding'))
  .catch(err => console.error(err));

const seedSuperAdmin = async () => {
  try {
    const superAdminRole = await Role.findOne({ name: 'Super Admin' });
    if (!superAdminRole) {
      console.log('Super Admin role not found. Please run seedRoles.js first.');
      process.exit(1);
    }

    const existingAdmin = await User.findOne({ email: 'admin@digiexweb.com' });
    if (existingAdmin) {
      existingAdmin.role = superAdminRole._id;
      await existingAdmin.save();
      console.log('Super Admin already exists. Updated role reference.');
      process.exit();
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('admin123', salt);

    const superAdmin = new User({
      name: 'Digiex Super Admin',
      email: 'admin@digiexweb.com',
      password: hashedPassword,
      phone: '1234567890',
      role: superAdminRole._id
    });

    await superAdmin.save();
    console.log('Super Admin seeded successfully! Email: admin@digiexweb.com | Password: admin123');
    process.exit();
  } catch (error) {
    console.error('Error seeding Super Admin:', error);
    process.exit(1);
  }
};

seedSuperAdmin();
