const BusinessCategory = require('../models/BusinessCategory');

// Seed helper
const seedDefaultCategories = async () => {
  const defaultCategories = [
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

  await BusinessCategory.insertMany(defaultCategories);
};

exports.getCategories = async (req, res) => {
  try {
    let categories = await BusinessCategory.find().sort({ name: 1 });
    if (categories.length === 0) {
      await seedDefaultCategories();
      categories = await BusinessCategory.find().sort({ name: 1 });
    }
    res.status(200).json({ success: true, data: categories });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.addCategory = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, message: 'Category name is required' });
    }
    
    // Check if exists
    const existing = await BusinessCategory.findOne({ name: { $regex: new RegExp('^' + name.trim() + '$', 'i') } });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Category already exists' });
    }

    const newCategory = new BusinessCategory({ name: name.trim(), subcategories: [] });
    await newCategory.save();
    
    res.status(201).json({ success: true, data: newCategory });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.addSubCategory = async (req, res) => {
  try {
    const { subcategoryName } = req.body;
    const categoryId = req.params.id;
    
    if (!subcategoryName) {
      return res.status(400).json({ success: false, message: 'Subcategory name is required' });
    }

    const category = await BusinessCategory.findById(categoryId);
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    // Check if subcategory already exists (case-insensitive)
    const exists = category.subcategories.some(sub => sub.toLowerCase() === subcategoryName.trim().toLowerCase());
    if (exists) {
      return res.status(400).json({ success: false, message: 'Subcategory already exists in this category' });
    }

    category.subcategories.push(subcategoryName.trim());
    await category.save();

    res.status(200).json({ success: true, data: category });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateCategory = async (req, res) => {
  try {
    const { name, subcategories } = req.body;
    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (subcategories !== undefined) updateData.subcategories = subcategories;

    const category = await BusinessCategory.findByIdAndUpdate(req.params.id, updateData, { new: true, runValidators: true });
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }
    res.status(200).json({ success: true, data: category });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.deleteCategory = async (req, res) => {
  try {
    const category = await BusinessCategory.findByIdAndDelete(req.params.id);
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }
    res.status(200).json({ success: true, message: 'Category deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
