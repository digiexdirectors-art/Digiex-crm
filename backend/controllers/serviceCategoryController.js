const ServiceCategory = require('../models/ServiceCategory');

exports.createServiceCategory = async (req, res) => {
  try {
    const newDoc = new ServiceCategory(req.body);
    await newDoc.save();
    res.status(201).json({ success: true, data: newDoc });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.getServiceCategories = async (req, res) => {
  try {
    const { status } = req.query;
    let query = {};
    if (status) {
      query.status = status;
    }
    const docs = await ServiceCategory.find(query);
    res.status(200).json({ success: true, data: docs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateServiceCategory = async (req, res) => {
  try {
    const updatedDoc = await ServiceCategory.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!updatedDoc) return res.status(404).json({ success: false, message: 'Service category not found' });
    res.status(200).json({ success: true, data: updatedDoc });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.deleteServiceCategory = async (req, res) => {
  try {
    const deletedDoc = await ServiceCategory.findByIdAndDelete(req.params.id);
    if (!deletedDoc) return res.status(404).json({ success: false, message: 'Service category not found' });
    res.status(200).json({ success: true, message: 'Service category deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
