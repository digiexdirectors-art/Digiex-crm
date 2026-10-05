const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendanceController');

router.post('/clock-in', attendanceController.clockIn);
router.post('/clock-out', attendanceController.clockOut);
router.post('/break-start', attendanceController.startBreak);
router.post('/break-end', attendanceController.endBreak);
router.post('/mark-wfh', attendanceController.markWFH);
router.get('/wfh/:userId', attendanceController.getWFHDates);
router.post('/remove-wfh', attendanceController.removeWFH);
router.get('/today/:userId', attendanceController.getTodayAttendance);
router.get('/stats/:userId', attendanceController.getMonthlyStats);
router.post('/location-log', attendanceController.addLocationLog);
router.get('/marketing-tracking', attendanceController.getMarketingTracking);
router.get('/', attendanceController.getAllAttendance);

module.exports = router;
