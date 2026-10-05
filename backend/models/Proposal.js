const mongoose = require('mongoose');

const proposalSchema = new mongoose.Schema({
  proposalNumber: { type: String, unique: true },
  leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead' },
  clientDetails: {
    name: { type: String, required: true },
    companyName: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String },
    address: { type: String }
  },
  packageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Package' }, // Null if fully custom
  isCustom: { type: Boolean, default: false },
  services: [{
    serviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Service' },
    name: { type: String, required: true },
    deliverables: [{
      key: { type: String },
      value: { type: String }
    }],
    price: { type: Number, default: 0 }
  }],
  billingCycle: { 
    type: String, 
    required: true,
    enum: ['Monthly', 'Quarterly', 'Half-Yearly', 'Yearly'] 
  },
  price: { type: Number, required: true }, // Subtotal before discount/GST
  discount: { type: Number, default: 0 },
  gstPercentage: { type: Number, default: 18 },
  gstAmount: { type: Number, required: true },
  total: { type: Number, required: true }, // Grand total
  status: { 
    type: String, 
    enum: ['Draft', 'Sent', 'Accepted', 'Rejected'], 
    default: 'Draft' 
  },
  serviceDetails: [{ type: mongoose.Schema.Types.ObjectId, ref: 'ServiceDetail' }],
  terms: { type: String }
}, { timestamps: true });

// Auto-generate proposal number before saving
proposalSchema.pre('save', async function() {
  if (!this.proposalNumber) {
    const Proposal = mongoose.model('Proposal');
    const count = await Proposal.countDocuments();
    const year = new Date().getFullYear();
    this.proposalNumber = `PROP-${year}-${String(count + 1).padStart(4, '0')}`;
  }
});

module.exports = mongoose.model('Proposal', proposalSchema);
