const mongoose = require('mongoose');

const leaveTypeSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  code: { type: String, required: true, unique: true },
  paid: { type: Boolean, default: true },
  annualAllocation: { type: Number, default: 0 },
  carryForward: { type: Boolean, default: false },
  encashable: { type: Boolean, default: false },
  maxConsecutiveDays: { type: Number, default: 0 }, // 0 = no limit
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('LeaveType', leaveTypeSchema);
