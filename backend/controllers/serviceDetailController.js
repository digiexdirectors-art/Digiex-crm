const ServiceDetail = require('../models/ServiceDetail');

// Get all service details
exports.getServiceDetails = async (req, res) => {
  try {
    const { service, status } = req.query;
    const query = {};
    if (service) query.service = service;
    if (status) query.status = status;

    const details = await ServiceDetail.find(query)
      .populate('service')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, data: details });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Create a service detail
exports.createServiceDetail = async (req, res) => {
  try {
    const { service, name, price, status } = req.body;
    if (!service || !name || price === undefined) {
      return res.status(400).json({ success: false, message: 'Service, name, and price are required.' });
    }

    const detail = new ServiceDetail({ service, name, price, status });
    await detail.save();

    const populated = await ServiceDetail.findById(detail._id).populate('service');

    res.status(201).json({ success: true, data: populated });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Update a service detail
exports.updateServiceDetail = async (req, res) => {
  try {
    const { service, name, price, status } = req.body;
    const detail = await ServiceDetail.findById(req.params.id);
    if (!detail) {
      return res.status(404).json({ success: false, message: 'Service detail not found.' });
    }

    if (service) detail.service = service;
    if (name) detail.name = name;
    if (price !== undefined) detail.price = price;
    if (status) detail.status = status;

    await detail.save();

    const populated = await ServiceDetail.findById(detail._id).populate('service');

    res.status(200).json({ success: true, data: populated });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Delete a service detail
exports.deleteServiceDetail = async (req, res) => {
  try {
    const detail = await ServiceDetail.findByIdAndDelete(req.params.id);
    if (!detail) {
      return res.status(404).json({ success: false, message: 'Service detail not found.' });
    }
    res.status(200).json({ success: true, message: 'Service detail deleted successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
