const Holiday = require('../models/Holiday');

exports.getHolidays = async (req, res) => {
  try {
    const holidays = await Holiday.find().sort({ date: 1 });
    res.status(200).json({ success: true, data: holidays });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createHoliday = async (req, res) => {
  try {
    const holiday = new Holiday(req.body);
    await holiday.save();
    res.status(201).json({ success: true, data: holiday });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.updateHoliday = async (req, res) => {
  try {
    const holiday = await Holiday.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!holiday) return res.status(404).json({ success: false, message: 'Holiday not found' });
    res.status(200).json({ success: true, data: holiday });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.deleteHoliday = async (req, res) => {
  try {
    const holiday = await Holiday.findByIdAndDelete(req.params.id);
    if (!holiday) return res.status(404).json({ success: false, message: 'Holiday not found' });
    res.status(200).json({ success: true, message: 'Holiday deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
