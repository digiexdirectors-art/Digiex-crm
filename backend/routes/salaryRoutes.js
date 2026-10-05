const express = require('express');
const router = express.Router();
const salaryController = require('../controllers/salaryController');

router.get('/summary', salaryController.getPayrollSummary);
router.post('/generate', salaryController.generateSlip);
router.post('/send-email', salaryController.sendEmail);
router.get('/:userId', salaryController.getSlips);

module.exports = router;
