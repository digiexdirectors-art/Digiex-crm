const express = require('express');
const router = express.Router();
const { 
  calculateLeaveBalance,
  getLeaveTypes,
  createLeaveType,
  applyLeave,
  getLeaveRequests,
  approveLeave,
  rejectLeave,
  cancelLeave,
  adjustBalance,
  bulkAllocate
} = require('../controllers/leaveController');

router.get('/balance/:userId', calculateLeaveBalance);
router.get('/types', getLeaveTypes);
router.post('/types', createLeaveType);
router.post('/apply', applyLeave);
router.get('/requests', getLeaveRequests);
router.post('/approve/:id', approveLeave);
router.post('/reject/:id', rejectLeave);
router.post('/cancel/:id', cancelLeave);
router.post('/adjust', adjustBalance);
router.post('/bulk-allocate', bulkAllocate);

module.exports = router;
