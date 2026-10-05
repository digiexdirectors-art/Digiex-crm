const Department = require('../models/Department');

exports.createDepartment = async (req, res) => {
  try {
    const newDoc = new Department(req.body);
    await newDoc.save();
    res.status(201).json({ success: true, data: newDoc });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.getDepartments = async (req, res) => {
  try {
    const docs = await Department.find();
    res.status(200).json({ success: true, data: docs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateDepartment = async (req, res) => {
  try {
    const updatedDoc = await Department.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!updatedDoc) return res.status(404).json({ success: false, message: 'Not found' });
    res.status(200).json({ success: true, data: updatedDoc });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.deleteDepartment = async (req, res) => {
  try {
    await Department.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: 'Deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
