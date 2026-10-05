const AuditLog = require('../models/AuditLog');

exports.getClientAuditLogs = async (req, res) => {
  try {
    const logs = await AuditLog.find({ client: req.params.clientId })
      .populate('user', 'name email employeeId')
      .sort({ timestamp: -1 });
    res.status(200).json({ success: true, data: logs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
