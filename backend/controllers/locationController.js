const Location = require('../models/Location');

const seedDefaultLocations = async () => {
  const defaultLocations = [
    { name: 'Kolkata', status: 'Active', country: 'India' },
    { name: 'Bhubaneswar', status: 'Active', country: 'India' },
    { name: 'Delhi', status: 'Active', country: 'India' },
    { name: 'Mumbai', status: 'Active', country: 'India' },
    { name: 'Bangalore', status: 'Active', country: 'India' }
  ];
  await Location.insertMany(defaultLocations);
};

exports.createLocation = async (req, res) => {
  try {
    const location = new Location(req.body);
    await location.save();
    res.status(201).json({ success: true, data: location });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.getLocations = async (req, res) => {
  try {
    let locations = await Location.find().sort({ name: 1 });
    if (locations.length === 0) {
      await seedDefaultLocations();
      locations = await Location.find().sort({ name: 1 });
    }
    res.status(200).json({ success: true, data: locations });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateLocation = async (req, res) => {
  try {
    const location = await Location.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!location) return res.status(404).json({ success: false, message: 'Location not found' });
    res.status(200).json({ success: true, data: location });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.deleteLocation = async (req, res) => {
  try {
    const location = await Location.findByIdAndDelete(req.params.id);
    if (!location) return res.status(404).json({ success: false, message: 'Location not found' });
    res.status(200).json({ success: true, message: 'Location deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
