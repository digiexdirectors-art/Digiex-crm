const mongoose = require('mongoose');

const leaveRequestSchema = new mongoose.Schema({
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  leaveType: { type: mongoose.Schema.Types.ObjectId, ref: 'LeaveType', required: true },
  fromDate: { type: Date, required: true },
  toDate: { type: Date, required: true },
  totalDays: { type: Number, required: true },
  halfDay: { type: Boolean, default: false },
  halfDaySession: { type: String, enum: ['First Half', 'Second Half', 'None'], default: 'None' },
  reason: { type: String, required: true },
  attachment: { type: String }, // File path of the uploaded file
  status: { 
    type: String, 
    enum: ['Pending Manager', 'Pending HR', 'Approved', 'Rejected', 'Cancelled'], 
    default: 'Pending Manager' 
  },
  reportingManager: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  comments: { type: String }, // Rejection or feedback remarks
  maternityScenario: { type: String, enum: ['First two surviving children', 'Third or subsequent child', 'Adoption', 'Surrogacy', 'None'], default: 'None' },
  expectedDeliveryDate: { type: Date },
  approvalTimeline: [{
    role: { type: String }, // 'Manager' or 'HR'
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    action: { type: String, enum: ['Approved', 'Rejected', 'Modification Requested'] },
    remarks: { type: String },
    date: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

module.exports = mongoose.model('LeaveRequest', leaveRequestSchema);
