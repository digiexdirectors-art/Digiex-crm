const Package = require('../models/Package');

exports.createPackage = async (req, res) => {
  try {
    const newDoc = new Package(req.body);
    await newDoc.save();
    res.status(201).json({ success: true, data: newDoc });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.getPackages = async (req, res) => {
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

    const docs = await Package.find(query).populate('services').populate('serviceDetails');
    res.status(200).json({ success: true, data: docs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updatePackage = async (req, res) => {
  try {
    const updatedDoc = await Package.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true }).populate('services').populate('serviceDetails');
    if (!updatedDoc) return res.status(404).json({ success: false, message: 'Package not found' });
    res.status(200).json({ success: true, data: updatedDoc });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.deletePackage = async (req, res) => {
  try {
    const deletedDoc = await Package.findByIdAndDelete(req.params.id);
    if (!deletedDoc) return res.status(404).json({ success: false, message: 'Package not found' });
    res.status(200).json({ success: true, message: 'Package deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
