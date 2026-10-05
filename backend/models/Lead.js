const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema({
  dataId: { type: String, unique: true, sparse: true },
  clientType: { type: String, required: true },
  location: { type: String, required: true },
  businessName: { type: String, required: true },
  contactPerson: { type: String, required: true },
  phone: { type: String, required: true },
  alternatePhone: { type: String },
  address: { type: String },
  city: { type: String },
  state: { type: String },
  dataSource: { type: String, required: true },
  email: { type: String, required: true },
  website: { type: String },
  dataFeedBy: { type: String, required: true },
  remarks: { type: String },
  referralName: { type: String },
  businessCategory: { type: String },
  businessSubCategory: { type: String },
  businessHoursType: { type: String },
  openingTime: { type: String },
  closingTime: { type: String },
  businessStartTime: { type: String },
  businessEndTime: { type: String },
  yearOfEstablishment: { type: String },
  socialMedia: { type: String },
  kycGst: { type: String },
  isGstVerified: { type: Boolean, default: false },
  businessLogo: { type: String },
  shopFrontImage: { type: String },
  serviceImages: [{ type: String }],
  
  // Stages and assignments as per CRM
  stage: { 
    type: String, 
    default: 'Data'
  },
  assignedTelecaller: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  assignedSales: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  value: { type: Number, default: 0 },
  notes: [{ text: String, date: { type: Date, default: Date.now } }],
  appointmentHistory: [{
    status: { type: String, required: true },
    remarks: { type: String },
    changedBy: { type: String, required: true },
    changedAt: { type: Date, default: Date.now },
    appointmentDate: { type: Date }
  }]
}, { timestamps: true });

module.exports = mongoose.model('Lead', leadSchema);
