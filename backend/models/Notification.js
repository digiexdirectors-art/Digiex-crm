const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  title: { 
    type: String, 
    required: true 
  },
  message: { 
    type: String, 
    required: true 
  },
  leadId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Lead'
  },
  leaveId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'LeaveRequest'
  },
  clientId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Client'
  },
  readBy: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  }],
  recipients: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  }],
  roles: [{ 
    type: String 
  }]
}, { timestamps: true });

module.exports = mongoose.model('Notification', notificationSchema);
