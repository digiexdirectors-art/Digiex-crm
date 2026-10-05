const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  // Basic Information
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  phone: { type: String },
  alternativePhone: { type: String },
  profilePhoto: { type: String },
  gender: { type: String, enum: ['Male', 'Female', 'Other'] },
  dob: { type: Date },
  currentAddress: { type: String },
  permanentAddress: { type: String },
  socialMediaProfile: { type: String },
  emergencyContact: {
    name: { type: String },
    phone: { type: String },
    relation: { type: String }
  },

  // Documents
  documents: {
    aadhaarFront: { type: String },
    aadhaarBack: { type: String },
    panCard: { type: String },
    bankPassbook: { type: String },
    educationalCertificates: [{ title: { type: String }, fileUrl: { type: String } }],
    pastExperience: [{ companyName: { type: String }, fileUrl: { type: String } }]
  },

  officialDocuments: {
    offerLetter: { type: String },
    appointmentLetter: { type: String },
    incrementLetter: { type: String }
  },

  // Identity & Legal
  employeeId: { type: String, unique: true },
  aadhaar: { type: String },
  pan: { type: String },
  digiLockerEntry: { type: String },
  joiningDate: { type: Date },
  exitDate: { type: Date },
  employmentType: { type: String, enum: ['Full-time', 'Part-time', 'Trainee', 'Contract'], default: 'Full-time' },
  employmentStatus: { type: String, enum: ['Active', 'Inactive', 'On Notice'], default: 'Active' },

  // Job Details
  role: { type: mongoose.Schema.Types.ObjectId, ref: 'Role' }, // Serves as Primary Designation
  roles: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Role' }], // Serves as Multiple Designations
  reportingManager: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  workLocation: { type: String, enum: ['Office', 'Remote', 'Hybrid'], default: 'Office' },
  expectedEntryTime: { type: String, default: '10:00' }, // Format: HH:mm
  offSaturdays: [{ type: Number }], // [1, 2, 3, 4, 5] representing 1st, 2nd... Saturday of month

  // Salary Info
  salaryStructure: { type: String, enum: ['CTC', 'Fixed', 'Variable'] },
  salaryAmount: { type: Number }, // Treated as Fixed for Tele Sales manager
  variableSalary: { type: Number, default: 0 },
  enableIncrement: { type: Boolean, default: false },
  revisedSalary: { type: Number },
  incrementEffectiveDate: { type: Date },
  incrementHistory: [{
    previousSalary: { type: Number },
    revisedSalary: { type: Number },
    incrementAmount: { type: Number },
    incrementPercentage: { type: Number },
    effectiveDate: { type: Date },
    createdAt: { type: Date, default: Date.now }
  }],
  basic: { type: Number, default: 0 },
  hra: { type: Number, default: 0 },
  incentives: { type: Number, default: 0 },
  ptax: { type: Number, default: 0 },
  pfAmount: { type: Number, default: 0 },
  esiAmount: { type: Number, default: 0 },
  bankAccountNo: { type: String },
  bankIfsc: { type: String },
  bankName: { type: String },
  pf: { type: String },
  esi: { type: String },

  // Legacy field map
  isActive: { type: Boolean, default: true }, // Keep for backward compatibility for now
  
  // Real-time tracking
  lastActive: { type: Date }
}, { timestamps: true });

// Virtual to check if user is active within last 2.5 minutes
userSchema.virtual('isOnline').get(function() {
  if (!this.lastActive) return false;
  return (new Date() - this.lastActive) < 150000; // 150 seconds
});

userSchema.set('toJSON', { virtuals: true });
userSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('User', userSchema);
