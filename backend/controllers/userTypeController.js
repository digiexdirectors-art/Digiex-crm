const UserType = require('../models/UserType');

exports.createUserType = async (req, res) => {
  try {
    const newDoc = new UserType(req.body);
    await newDoc.save();
    res.status(201).json({ success: true, data: newDoc });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.getUserTypes = async (req, res) => {
  try {
    const docs = await UserType.find();
    res.status(200).json({ success: true, data: docs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateUserType = async (req, res) => {
  try {
    const updatedDoc = await UserType.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!updatedDoc) return res.status(404).json({ success: false, message: 'Not found' });
    res.status(200).json({ success: true, data: updatedDoc });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.deleteUserType = async (req, res) => {
  try {
    await UserType.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: 'Deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
