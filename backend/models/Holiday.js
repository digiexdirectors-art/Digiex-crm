const mongoose = require('mongoose');

const holidaySchema = new mongoose.Schema({
  name: { type: String, required: true },
  date: { type: Date, required: true },
  description: { type: String },
  type: { type: String, enum: ['Public', 'Company', 'Optional'], default: 'Public' }
}, { timestamps: true });

module.exports = mongoose.model('Holiday', holidaySchema);
