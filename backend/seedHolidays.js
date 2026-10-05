const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Holiday = require('./models/Holiday');

dotenv.config();

const holidays = [
  { name: "New Year's Day", date: new Date('2026-01-01'), type: 'Public' },
  { name: "Republic Day", date: new Date('2026-01-26'), type: 'Public' },
  { name: "Doljatra", date: new Date('2026-03-03'), type: 'Public' },
  { name: "Bengali New Year's Day (Nababarsha)", date: new Date('2026-04-15'), type: 'Public' },
  { name: "Independence Day", date: new Date('2026-08-15'), type: 'Public' },
  { name: "Ganesh Chaturthi (Mandatory Office Puja)", date: new Date('2026-09-14'), type: 'Company', description: 'Office Puja - Attendance Mandatory' },
  { name: "Birthday of Gandhiji", date: new Date('2026-10-02'), type: 'Public' },
  { name: "Durga Puja, Maha Saptami", date: new Date('2026-10-18'), type: 'Public' },
  { name: "Durga Puja, Maha Astami", date: new Date('2026-10-19'), type: 'Public' },
  { name: "Durga Puja, Maha Nabami", date: new Date('2026-10-20'), type: 'Public' },
  { name: "Durga Puja, Dasami", date: new Date('2026-10-21'), type: 'Public' },
  { name: "Diwali", date: new Date('2026-11-08'), type: 'Public' },
  { name: "Vaifota", date: new Date('2026-11-11'), type: 'Public' }
];

const seedHolidays = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/digiex_hrms');
    
    // Clear existing holidays for 2026 if any
    await Holiday.deleteMany({ date: { $gte: new Date('2026-01-01'), $lte: new Date('2026-12-31') } });
    
    await Holiday.insertMany(holidays);
    console.log('Holidays seeded successfully');
    process.exit();
  } catch (err) {
    console.error('Error seeding holidays:', err);
    process.exit(1);
  }
};

seedHolidays();
