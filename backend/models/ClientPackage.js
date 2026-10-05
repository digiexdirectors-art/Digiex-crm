const mongoose = require('mongoose');

const clientPackageSchema = new mongoose.Schema({
  client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
  lead: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead' },
  package: { type: mongoose.Schema.Types.ObjectId, ref: 'Package' }, // Null if custom
  proposal: { type: mongoose.Schema.Types.ObjectId, ref: 'Proposal' },
  services: [{
    serviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Service' },
    name: { type: String, required: true },
    category: { type: String },
    deliverables: [{
      key: { type: String },
      value: { type: String },
      price: { type: Number, default: 0 }
    }]
  }],
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  billingCycle: { 
    type: String, 
    required: true,
    enum: ['Monthly', 'Quarterly', 'Half-Yearly', 'Yearly'] 
  },
  price: { type: Number, required: true },       // Price (Subtotal)
  gstAmount: { type: Number, default: 0 },
  total: { type: Number, required: true },       // Grand total
  renewalDate: { type: Date, required: true },   // Date when next payment / renewal is due
  accountManager: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  status: { 
    type: String, 
    enum: ['Active', 'In Progress', 'Completed', 'Expired', 'Pending Renewal'], 
    default: 'Active' 
  },
  notes: { type: String },
  assignedTeam: { type: String },
  lastUpdatedBy: { type: String },
  lastUpdatedAt: { type: Date },
  lastSmsSentDate: { type: Date },
  serviceDetails: [{ type: mongoose.Schema.Types.ObjectId, ref: 'ServiceDetail' }],
  features: [{
    name: { type: String, required: true },
    description: { type: String },
    status: { type: String, enum: ['Pending', 'In Progress', 'Completed'], default: 'Pending' },
    estimatedCost: { type: Number, default: 0 },
    approvalStatus: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' }
  }]
}, { timestamps: true });

module.exports = mongoose.model('ClientPackage', clientPackageSchema);
