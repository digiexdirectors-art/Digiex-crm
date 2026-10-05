const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: Date, required: true },
  clockIn: { type: Date },
  clockOut: { type: Date },
  breaks: [{
    start: { type: Date },
    end: { type: Date }
  }],
  workSessions: [{
    clockIn: { type: Date },
    clockOut: { type: Date }
  }],
  status: { type: String, enum: ['Present', 'Absent', 'Half-Day', 'Full-Day', 'P', 'LP', 'HD', 'Leave', 'LWP', 'A'], default: 'Absent' },
  isLate: { type: Boolean, default: false },
  isEarlyLeave: { type: Boolean, default: false },
  isWFA: { type: Boolean, default: false },
  isWFH: { type: Boolean, default: false },
  clockInIP: { type: String },
  clockInLocation: {
    lat: { type: Number },
    lng: { type: Number }
  },
  totalHours: { type: Number, default: 0 },
  locationLogs: [{
    time: { type: Date, default: Date.now },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    address: { type: String },
    pincode: { type: String }
  }]
}, { timestamps: true });

module.exports = mongoose.model('Attendance', attendanceSchema);
