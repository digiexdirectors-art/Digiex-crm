const mongoose = require('mongoose');

const locationSchema = new mongoose.Schema({
  name: { type: String, required: true },
  address: { type: String },
  city: { type: String },
  state: { type: String },
  country: { type: String, default: 'India' },
  status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
}, { timestamps: true });

module.exports = mongoose.model('Location', locationSchema);
