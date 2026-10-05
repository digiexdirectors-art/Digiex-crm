const mongoose = require('mongoose');
const dotenv = require('dotenv');
const ServiceCategory = require('./models/ServiceCategory');
const Service = require('./models/Service');
const Package = require('./models/Package');
const BusinessCategory = require('./models/BusinessCategory');

dotenv.config();

mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/digiex_hrms')
  .then(() => console.log('MongoDB connected for seeding dynamic services & packages'))
  .catch(err => console.error(err));

const seedData = async () => {
  try {
    // Clear old data
    await ServiceCategory.deleteMany({});
    await Service.deleteMany({});
    await Package.deleteMany({});
    await BusinessCategory.deleteMany({});
    console.log('Cleared existing categories, services, packages, and business categories.');

    // 0. Seed Business Categories
    const defaultBusinessCategories = [
      { name: "Doctor", subcategories: ["Dental", "Maxillofacial surgery", "Cardiology", "Pediatrics", "Dermatology"] },
      { name: "Astrologer", subcategories: ["Vedic", "Palmistry", "Numerology", "Tarot Reading"] },
      { name: "Pain Clinic", subcategories: ["Physiotherapy", "Acupuncture", "Chiropractic", "Chronic Pain Management"] },
      { name: "Real Estate", subcategories: ["Residential Sales", "Commercial Leasing", "Property Management", "Land Acquisition"] },
      { name: "Academy", subcategories: ["Coaching Class", "Music Academy", "Dance Academy", "Sports Academy"] },
      { name: "Ambulance Service", subcategories: ["AC Ambulance", "Non-AC Ambulance", "ICU Ambulance"] },
      { name: "Appointment Booking System", subcategories: ["SaaS Integration", "Custom Web Portal", "Mobile App Booking"] },
      { name: "Automobile", subcategories: ["Car Repair", "Bike Servicing", "Used Car Dealer", "Auto Spare Parts"] },
      { name: "Hospital", subcategories: ["Multi-Specialty", "Eye Hospital", "Dental Clinic", "Cardiac Care"] },
      { name: "Hotel or Guest House", subcategories: ["Budget Hotel", "Luxury Resort", "Homestay", "Service Apartment"] },
      { name: "Interior", subcategories: ["Home Interior", "Office Interior", "Modular Kitchen Designer"] },
      { name: "Kitchen", subcategories: ["Catering Service", "Cloud Kitchen", "Restaurant Equipment Supplier"] },
      { name: "Lawyer Profile", subcategories: ["Criminal Lawyer", "Corporate Law", "Divorce/Family Court", "Civil Litigation"] },
      { name: "Spa", subcategories: ["Aromatherapy", "Thai Massage", "Ayurvedic Spa", "Beauty Salon"] }
    ];
    await BusinessCategory.insertMany(defaultBusinessCategories);
    console.log('Business categories and subcategories seeded.');

    // 1. Seed Service Categories
    const categoriesData = [
      { name: 'Digital Marketing', status: 'Active' },
      { name: 'Website Development', status: 'Active' },
      { name: 'Mobile App Development', status: 'Active' },
      { name: 'Software Development', status: 'Active' }
    ];

    const seededCategories = await ServiceCategory.insertMany(categoriesData);
    console.log('Service categories seeded.');

    // 2. Seed Services
    const servicesData = [
      // Digital Marketing
      {
        name: 'SEO (Search Engine Optimization)',
        category: 'Digital Marketing',
        description: 'Standard SEO optimization for search engines including keywords and backlinks.',
        pricing: { monthly: 8000, quarterly: 22000, halfYearly: 42000, yearly: 80000 },
        gstApplicable: true,
        gstPercentage: 18,
        deliverables: ['Keywords', 'Backlinks', 'Blog Posts', 'Monthly Report'],
        internalNotes: 'Standard DM service'
      },
      {
        name: 'GMB (Google My Business) Management',
        category: 'Digital Marketing',
        description: 'Manage and optimize Google Maps & Google My Business presence.',
        pricing: { monthly: 4000, quarterly: 11000, halfYearly: 21000, yearly: 40000 },
        gstApplicable: true,
        gstPercentage: 18,
        deliverables: ['GMB Posts', 'Images Upload', 'Review Management', 'Monthly Reporting'],
        internalNotes: 'Highly requested'
      },
      {
        name: 'Social Media Marketing',
        category: 'Digital Marketing',
        description: 'Manage Facebook, Instagram, and LinkedIn posting and ads.',
        pricing: { monthly: 10000, quarterly: 28000, halfYearly: 54000, yearly: 100000 },
        gstApplicable: true,
        gstPercentage: 18,
        deliverables: ['Posts', 'Reels', 'Stories', 'Ad Management'],
        internalNotes: 'SMM base'
      },
      // Website Development
      {
        name: 'WordPress Business Website',
        category: 'Website Development',
        description: 'Standard responsive WordPress website for businesses.',
        pricing: { monthly: 5000, quarterly: 14000, halfYearly: 26000, yearly: 50000 },
        gstApplicable: true,
        gstPercentage: 18,
        deliverables: ['Number of Pages', 'Custom Design', 'Mobile Responsive', 'Contact Form', 'SEO Setup'],
        internalNotes: 'Web dev base'
      },
      {
        name: 'E-Commerce WooCommerce Website',
        category: 'Website Development',
        description: 'Full-featured WooCommerce shop including cart, payments, and checkout.',
        pricing: { monthly: 12000, quarterly: 34000, halfYearly: 65000, yearly: 120000 },
        gstApplicable: true,
        gstPercentage: 18,
        deliverables: ['Number of Products', 'Payment Gateway Integration', 'SSL Setup', 'Shopping Cart'],
        internalNotes: 'Shop website'
      },
      // Mobile App Development
      {
        name: 'Flutter Mobile App Development',
        category: 'Mobile App Development',
        description: 'Cross-platform Android & iOS app development using Flutter.',
        pricing: { monthly: 25000, quarterly: 70000, halfYearly: 135000, yearly: 250000 },
        gstApplicable: true,
        gstPercentage: 18,
        deliverables: ['Number of Screens', 'UI/UX Design', 'API Integration', 'Push Notification', 'App Store Upload'],
        internalNotes: 'Premium app dev'
      },
      // Software Development
      {
        name: 'Custom CRM Development',
        category: 'Software Development',
        description: 'Bespoke Customer Relationship Management platform development.',
        pricing: { monthly: 30000, quarterly: 85000, halfYearly: 160000, yearly: 300000 },
        gstApplicable: true,
        gstPercentage: 18,
        deliverables: ['Number of Modules', 'User Roles', 'Dashboard', 'Reports', 'API Integration', 'Training Sessions'],
        internalNotes: 'Enterprise level'
      },
      {
        name: 'Accounting & Invoicing Software',
        category: 'Software Development',
        description: 'Manage ledgers, bills, invoices, and GST filing templates.',
        pricing: { monthly: 20000, quarterly: 56000, halfYearly: 105000, yearly: 200000 },
        gstApplicable: true,
        gstPercentage: 18,
        deliverables: ['Ledger Posting', 'GST Invoicing', 'Tax Filing Integration', 'Multi-user Roles'],
        internalNotes: 'Finance module'
      }
    ];

    const createdServices = [];
    for (const data of servicesData) {
      const doc = new Service(data);
      await doc.save();
      createdServices.push(doc);
    }
    console.log('Services seeded successfully.');

    // Map service ids by name for easy packages reference
    const serviceMap = {};
    createdServices.forEach(s => {
      serviceMap[s.name] = s;
    });

    const seoObj = serviceMap['SEO (Search Engine Optimization)'];
    const gmbObj = serviceMap['GMB (Google My Business) Management'];
    const smmObj = serviceMap['Social Media Marketing'];
    const webObj = serviceMap['WordPress Business Website'];
    const shopObj = serviceMap['E-Commerce WooCommerce Website'];
    const appObj = serviceMap['Flutter Mobile App Development'];
    const crmObj = serviceMap['Custom CRM Development'];
    const accObj = serviceMap['Accounting & Invoicing Software'];

    // 3. Seed Packages
    const packagesData = [
      {
        name: 'Starter Marketing Package',
        category: 'Digital Marketing',
        description: 'Perfect package for local businesses looking to establish a basic online presence.',
        services: [seoObj._id, gmbObj._id],
        packageType: 'Combo',
        pricing: { monthly: 10000, quarterly: 27000, halfYearly: 50000, yearly: 95000 },
        deliverables: [
          {
            serviceId: seoObj._id,
            serviceName: seoObj.name,
            items: [
              { key: 'Keywords', value: '10' },
              { key: 'Backlinks', value: '25' },
              { key: 'Blog Posts', value: '2' },
              { key: 'Monthly Report', value: 'Yes' }
            ]
          },
          {
            serviceId: gmbObj._id,
            serviceName: gmbObj.name,
            items: [
              { key: 'GMB Posts', value: '5' },
              { key: 'Images Upload', value: '8' },
              { key: 'Review Management', value: 'Yes' },
              { key: 'Monthly Reporting', value: 'Yes' }
            ]
          }
        ]
      },
      {
        name: 'Premium Growth Package',
        category: 'Digital Marketing',
        description: 'Complete digital marketing growth package combining SEO, GMB, and Social Media Marketing.',
        services: [seoObj._id, gmbObj._id, smmObj._id],
        packageType: 'Combo',
        pricing: { monthly: 18000, quarterly: 50000, halfYearly: 95000, yearly: 180000 },
        deliverables: [
          {
            serviceId: seoObj._id,
            serviceName: seoObj.name,
            items: [
              { key: 'Keywords', value: '25' },
              { key: 'Backlinks', value: '60' },
              { key: 'Blog Posts', value: '4' },
              { key: 'Monthly Report', value: 'Yes' }
            ]
          },
          {
            serviceId: gmbObj._id,
            serviceName: gmbObj.name,
            items: [
              { key: 'GMB Posts', value: '12' },
              { key: 'Images Upload', value: '15' },
              { key: 'Review Management', value: 'Yes' },
              { key: 'Monthly Reporting', value: 'Yes' }
            ]
          },
          {
            serviceId: smmObj._id,
            serviceName: smmObj.name,
            items: [
              { key: 'Posts', value: '15' },
              { key: 'Reels', value: '8' },
              { key: 'Stories', value: '20' },
              { key: 'Ad Management', value: 'Yes' }
            ]
          }
        ]
      },
      {
        name: 'E-Commerce Launch Suite',
        category: 'Website Development',
        description: 'Combines a core business website and WooCommerce platform for full digital trade capacity.',
        services: [webObj._id, shopObj._id],
        packageType: 'Normal',
        pricing: { monthly: 15000, quarterly: 42000, halfYearly: 80000, yearly: 150000 },
        deliverables: [
          {
            serviceId: webObj._id,
            serviceName: webObj.name,
            items: [
              { key: 'Number of Pages', value: '5' },
              { key: 'Custom Design', value: 'Yes' },
              { key: 'Mobile Responsive', value: 'Yes' }
            ]
          },
          {
            serviceId: shopObj._id,
            serviceName: shopObj.name,
            items: [
              { key: 'Number of Products', value: '100' },
              { key: 'Payment Gateway Integration', value: 'Yes' },
              { key: 'Shopping Cart', value: 'Yes' }
            ]
          }
        ]
      },
      {
        name: 'Startup Complete Suite',
        category: 'Software Development',
        description: 'Comprehensive package providing a WordPress Business Website and a custom CRM system.',
        services: [webObj._id, crmObj._id],
        packageType: 'Combo',
        pricing: { monthly: 32000, quarterly: 90000, halfYearly: 170000, yearly: 320000 },
        deliverables: [
          {
            serviceId: webObj._id,
            serviceName: webObj.name,
            items: [
              { key: 'Number of Pages', value: '10' },
              { key: 'Custom Design', value: 'Yes' },
              { key: 'Mobile Responsive', value: 'Yes' },
              { key: 'Contact Form', value: 'Yes' },
              { key: 'SEO Setup', value: 'Yes' }
            ]
          },
          {
            serviceId: crmObj._id,
            serviceName: crmObj.name,
            items: [
              { key: 'Number of Modules', value: '6' },
              { key: 'User Roles', value: '3' },
              { key: 'Dashboard', value: 'Yes' },
              { key: 'Reports', value: 'Yes' },
              { key: 'API Integration', value: 'Yes' },
              { key: 'Training Sessions', value: '2 Sessions' }
            ]
          }
        ]
      }
    ];

    for (const data of packagesData) {
      const doc = new Package(data);
      await doc.save();
    }
    console.log('Packages seeded successfully.');

    console.log('Seeding complete!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding data:', error);
    process.exit(1);
  }
};

seedData();
