const mongoose = require('mongoose');

const roleSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true,
    unique: true 
  },
  userType: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'UserType',
    required: true
  },
  department: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Department',
    required: true 
  },
  description: { type: String },
  isActive: { type: Boolean, default: true },
  permissions: [{ type: String }]
}, { timestamps: true });

module.exports = mongoose.model('Role', roleSchema);
