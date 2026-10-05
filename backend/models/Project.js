const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  name: { type: String, required: true },
  client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
  lead: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead' },
  status: { 
    type: String, 
    enum: ['Not Started', 'In Progress', 'On Hold', 'Completed', 'Cancelled'],
    default: 'Not Started'
  },
  deadline: { type: Date },
  assignedTeam: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  budget: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('Project', projectSchema);
