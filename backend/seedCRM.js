const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Client = require('./models/Client');
const Lead = require('./models/Lead');
const Project = require('./models/Project');
const Invoice = require('./models/Invoice');
const User = require('./models/User');

dotenv.config();

mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/digiex_hrms')
  .then(() => console.log('MongoDB connected for CRM seeding'))
  .catch(err => console.error(err));

const seedCRM = async () => {
  try {
    // Clear old data
    await Client.deleteMany();
    await Lead.deleteMany();
    await Project.deleteMany();
    await Invoice.deleteMany();

    // Get an admin user
    const admin = await User.findOne({ email: 'admin@digiexweb.com' });
    const adminId = admin ? admin._id : null;

    // 1. Create Clients
    const clients = await Client.insertMany([
      { name: 'John Doe', companyName: 'Acme Corp', email: 'john@acme.com', phone: '1234567890', address: 'New York, NY', assignedAccountManager: adminId },
      { name: 'Jane Smith', companyName: 'TechFlow', email: 'jane@techflow.io', phone: '0987654321', address: 'San Francisco, CA', assignedAccountManager: adminId }
    ]);
    console.log('Clients created.');

    // 2. Create Leads
    const leads = await Lead.insertMany([
      { title: 'Website Redesign', client: clients[0]._id, stage: 'Deal', value: 5000, assignedTelecaller: adminId, assignedSales: adminId },
      { title: 'SEO Optimization', client: clients[1]._id, stage: 'Marketing', value: 2000, assignedTelecaller: adminId, assignedSales: adminId },
      { title: 'Mobile App Development', client: clients[0]._id, stage: 'Telecalling', value: 15000, assignedTelecaller: adminId }
    ]);
    console.log('Leads created.');

    // 3. Create Projects
    const projects = await Project.insertMany([
      { name: 'Acme Website Redesign', client: clients[0]._id, lead: leads[0]._id, status: 'In Progress', deadline: new Date('2026-06-01'), budget: 5000, assignedTeam: adminId ? [adminId] : [] },
      { name: 'TechFlow SEO Campaign', client: clients[1]._id, lead: leads[1]._id, status: 'Not Started', deadline: new Date('2026-07-01'), budget: 2000, assignedTeam: adminId ? [adminId] : [] }
    ]);
    console.log('Projects created.');

    // 4. Create Invoices
    await Invoice.insertMany([
      { invoiceNumber: 'INV-2026-001', client: clients[0]._id, project: projects[0]._id, amount: 2500, tax: 250, total: 2750, status: 'Paid', dueDate: new Date('2026-05-15') },
      { invoiceNumber: 'INV-2026-002', client: clients[0]._id, project: projects[0]._id, amount: 2500, tax: 250, total: 2750, status: 'Pending', dueDate: new Date('2026-06-15') },
      { invoiceNumber: 'INV-2026-003', client: clients[1]._id, project: projects[1]._id, amount: 2000, tax: 200, total: 2200, status: 'Pending', dueDate: new Date('2026-06-01') }
    ]);
    console.log('Invoices created.');

    console.log('All CRM collections seeded successfully!');
    process.exit();
  } catch (error) {
    console.error('Error seeding CRM data:', error);
    process.exit(1);
  }
};

seedCRM();
