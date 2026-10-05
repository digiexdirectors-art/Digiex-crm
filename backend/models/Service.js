const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema({
  name: { type: String, required: true },
  code: { type: String, unique: true },
  category: { 
    type: String, 
    required: true
  },
  description: { type: String },
  status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
  pricing: {
    monthly: { type: Number, default: 0 },
    quarterly: { type: Number, default: 0 },
    halfYearly: { type: Number, default: 0 },
    yearly: { type: Number, default: 0 }
  },
  gstApplicable: { type: Boolean, default: true },
  gstPercentage: { type: Number, default: 18 },
  deliverables: [{ type: String }], // Standard deliverables for this service (e.g., ['Keywords', 'Backlinks', 'Blogs'])
  internalNotes: { type: String }
}, { timestamps: true });

// Auto-generate service code before saving
serviceSchema.pre('save', async function() {
  if (!this.code) {
    const Service = mongoose.model('Service');
    const count = await Service.countDocuments();
    this.code = `SERV-${String(count + 1).padStart(4, '0')}`;
  }
});

module.exports = mongoose.model('Service', serviceSchema);
