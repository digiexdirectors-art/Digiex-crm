const mongoose = require('mongoose');

const clientSchema = new mongoose.Schema({
  name: { type: String, required: true },
  companyName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String },
  address: { type: String },
  assignedAccountManager: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  status: { 
    type: String, 
    enum: ['Active', 'Expired', 'Renewal Due', 'Suspended', 'Closed', 'Lead'], 
    default: 'Active' 
  },

  // Business Info
  designation: { type: String },
  whatsAppNumber: { type: String },
  alternateNumber: { type: String },
  alternateEmail: { type: String },

  // Business details
  businessCategory: { type: String },
  gstNumber: { type: String },
  panNumber: { type: String },
  cinNumber: { type: String }, // Optional

  // Detailed address
  addressLine1: { type: String },
  addressLine2: { type: String },
  city: { type: String },
  state: { type: String },
  country: { type: String, default: 'India' },
  pinCode: { type: String },

  // Online Presence
  websiteUrl: { type: String },
  facebookUrl: { type: String },
  instagramUrl: { type: String },
  linkedInUrl: { type: String },
  youtubeUrl: { type: String },
  googleBusinessProfileUrl: { type: String },

  // Extra assignments
  assignedSalesExecutive: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  assignedServiceManager: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  assignedProjectManager: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  assignedCustomerCareExecutive: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  assignedTeamMembers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  teamAssignments: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    startDate: { type: Date },
    endDate: { type: Date }
  }],
  projectStatus: { 
    type: String, 
    enum: ['Pending Verification', 'Pending Team Members', 'Pending Team Assignment', 'Assigned for Development', 'In Development', 'Testing / Review', 'Completed', 'On Hold', 'Inactive'], 
    default: 'Pending Verification' 
  },

  // Internal Notes
  notes: [{
    date: { type: Date, default: Date.now },
    userName: { type: String },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    note: { type: String },
    taggedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
  }],

  // Documents
  documents: [{
    fileName: { type: String },
    fileUrl: { type: String },
    fileType: { type: String },
    uploadedAt: { type: Date, default: Date.now }
  }],

  // Activity Timeline
  timeline: [{
    title: { type: String },
    description: { type: String },
    date: { type: Date, default: Date.now }
  }],

  // Verification & Extended Business Details
  isVerified: { type: Boolean, default: false },
  isGstVerified: { type: Boolean, default: false },
  verificationToken: { type: String },
  verificationTokenExpires: { type: Date },
  verificationDetails: {
    verifiedAt: { type: Date },
    verifiedBy: { type: String },
    verifiedByEmployeeId: { type: String }
  },
  businessType: { type: String },
  industry: { type: String },
  companyRegistrationNumber: { type: String },
  companyEmail: { type: String },
  companyPhone: { type: String },
  description: { type: String },
  numberOfEmployees: { type: Number },
  techStack: { type: String },
  competitors: { type: String },
  remarks: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Client', clientSchema);
