const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  // Client verification / configuration logs
  client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: false },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
  userName: { type: String, required: false },
  userRole: { type: String, required: false },
  oldValue: { type: mongoose.Schema.Types.Mixed },
  newValue: { type: mongoose.Schema.Types.Mixed },

  // General module system logs (invoices, leaves, roles, etc.)
  action: { type: String, required: true },
  module: { type: String },
  documentId: { type: mongoose.Schema.Types.Mixed },
  details: { type: mongoose.Schema.Types.Mixed },
  performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },

  timestamp: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('AuditLog', auditLogSchema);
