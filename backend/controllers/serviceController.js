const Service = require('../models/Service');

exports.createService = async (req, res) => {
  try {
    const newDoc = new Service(req.body);
    await newDoc.save();
    res.status(201).json({ success: true, data: newDoc });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.getServices = async (req, res) => {
  try {
    const { search, category, status } = req.query;
    let query = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } }
      ];
    }
    if (category) {
      query.category = category;
    }
    if (status) {
      query.status = status;
    }

    const docs = await Service.find(query);
    res.status(200).json({ success: true, data: docs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateService = async (req, res) => {
  try {
    const updatedDoc = await Service.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!updatedDoc) return res.status(404).json({ success: false, message: 'Service not found' });
    res.status(200).json({ success: true, data: updatedDoc });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.deleteService = async (req, res) => {
  try {
    const deletedDoc = await Service.findByIdAndDelete(req.params.id);
    if (!deletedDoc) return res.status(404).json({ success: false, message: 'Service not found' });
    res.status(200).json({ success: true, message: 'Service deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
