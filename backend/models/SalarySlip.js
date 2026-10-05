const mongoose = require('mongoose');

const salarySlipSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  month: { type: Number, required: true }, // 1 to 12
  year: { type: Number, required: true },
  presentDays: { type: Number, default: 0 },
  leaveDays: { type: Number, default: 0 },
  lateCount: { type: Number, default: 0 },
  absentDaysDueToLate: { type: Number, default: 0 },
  clDays: { type: Number, default: 0 },
  slDays: { type: Number, default: 0 },
  mlDays: { type: Number, default: 0 },
  unpaidLeaveDays: { type: Number, default: 0 },
  startDate: { type: Date },
  endDate: { type: Date },
  
  // Breakdown Snapshot
  basic: { type: Number, default: 0 },
  hra: { type: Number, default: 0 },
  incentives: { type: Number, default: 0 },
  arrears: { type: Number, default: 0 },
  ptax: { type: Number, default: 0 },
  pf: { type: Number, default: 0 },
  esi: { type: Number, default: 0 },
  leaveDeduction: { type: Number, default: 0 },
  
  // Totals
  totalAdditions: { type: Number, default: 0 },
  totalDeductions: { type: Number, default: 0 },
  netSalary: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('SalarySlip', salarySlipSchema);
