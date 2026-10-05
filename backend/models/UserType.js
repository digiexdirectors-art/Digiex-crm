const mongoose = require('mongoose');

const userTypeSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  description: { type: String },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('UserType', userTypeSchema);
