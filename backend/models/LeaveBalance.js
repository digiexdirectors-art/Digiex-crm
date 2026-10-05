const mongoose = require('mongoose');

const leaveBalanceSchema = new mongoose.Schema({
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  leaveType: { type: mongoose.Schema.Types.ObjectId, ref: 'LeaveType', required: true },
  allocated: { type: Number, default: 0 },
  used: { type: Number, default: 0 },
  remaining: { type: Number, default: 0 },
  year: { type: Number, required: true }
}, { timestamps: true });

leaveBalanceSchema.index({ employee: 1, leaveType: 1, year: 1 }, { unique: true });

module.exports = mongoose.model('LeaveBalance', leaveBalanceSchema);
