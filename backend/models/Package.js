const mongoose = require('mongoose');

const packageSchema = new mongoose.Schema({
  name: { type: String, required: true },
  code: { type: String, unique: true },
  category: { 
    type: String, 
    required: true
  },
  description: { type: String },
  status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
  services: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Service' }],
  serviceDetails: [{ type: mongoose.Schema.Types.ObjectId, ref: 'ServiceDetail' }],
  packageType: { type: String, enum: ['Normal', 'Combo'], default: 'Normal' },
  pricing: {
    monthly: { type: Number, default: 0 },
    quarterly: { type: Number, default: 0 },
    halfYearly: { type: Number, default: 0 },
    yearly: { type: Number, default: 0 }
  },
  deliverables: [{
    serviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Service' },
    serviceName: { type: String },
    items: [{
      key: { type: String },    // e.g. 'Keywords'
      value: { type: String }  // e.g. '20'
    }]
  }]
}, { timestamps: true });

// Auto-generate package code before saving
packageSchema.pre('save', async function() {
  if (!this.code) {
    const Package = mongoose.model('Package');
    const count = await Package.countDocuments();
    this.code = `PKG-${String(count + 1).padStart(4, '0')}`;
  }
});

module.exports = mongoose.model('Package', packageSchema);
