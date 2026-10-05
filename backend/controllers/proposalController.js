const Proposal = require('../models/Proposal');

exports.createProposal = async (req, res) => {
  try {
    const newDoc = new Proposal(req.body);
    await newDoc.save();
    res.status(201).json({ success: true, data: newDoc });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.getProposals = async (req, res) => {
  try {
    const { status, leadId } = req.query;
    let query = {};

    if (status) {
      query.status = status;
    }
    if (leadId) {
      query.leadId = leadId;
    }

    const docs = await Proposal.find(query).populate('leadId').populate('packageId').populate('serviceDetails');
    res.status(200).json({ success: true, data: docs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateProposal = async (req, res) => {
  try {
    const updatedDoc = await Proposal.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true }).populate('leadId').populate('packageId').populate('serviceDetails');
    if (!updatedDoc) return res.status(404).json({ success: false, message: 'Proposal not found' });
    res.status(200).json({ success: true, data: updatedDoc });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.deleteProposal = async (req, res) => {
  try {
    const deletedDoc = await Proposal.findByIdAndDelete(req.params.id);
    if (!deletedDoc) return res.status(404).json({ success: false, message: 'Proposal not found' });
    res.status(200).json({ success: true, message: 'Proposal deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
