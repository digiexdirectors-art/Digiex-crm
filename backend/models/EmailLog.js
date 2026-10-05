const mongoose = require('mongoose');

const EmailLogSchema = new mongoose.Schema({
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: true
  },
  recipient: {
    type: String,
    required: true
  },
  subject: {
    type: String,
    required: true
  },
  body: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['Sent', 'Failed'],
    required: true
  },
  errorMessage: {
    type: String
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

module.exports = mongoose.model('EmailLog', EmailLogSchema);
