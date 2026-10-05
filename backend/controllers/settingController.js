const CompanySetting = require('../models/CompanySetting');

exports.getSettings = async (req, res) => {
  try {
    const settings = await CompanySetting.find();
    res.status(200).json({ success: true, data: settings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getSettingByKey = async (req, res) => {
  try {
    const setting = await CompanySetting.findOne({ key: req.params.key });
    if (!setting) return res.status(404).json({ success: false, message: 'Setting not found' });
    res.status(200).json({ success: true, data: setting });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateSetting = async (req, res) => {
  try {
    const { key, value, description } = req.body;
    let setting = await CompanySetting.findOne({ key });
    if (setting) {
      setting.value = value;
      if (description) setting.description = description;
      await setting.save();
    } else {
      setting = new CompanySetting({ key, value, description });
      await setting.save();
    }
    res.status(200).json({ success: true, data: setting });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};
