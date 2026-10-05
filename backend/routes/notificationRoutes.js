const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');

router.get('/:userId/:roleName', notificationController.getNotifications);
router.put('/read/:id/:userId', notificationController.markAsRead);
router.put('/read-all/:userId/:roleName', notificationController.markAllAsRead);

module.exports = router;
