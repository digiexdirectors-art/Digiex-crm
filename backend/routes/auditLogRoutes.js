const express = require('express');
const router = express.Router();
const controller = require('../controllers/auditLogController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);
router.get('/client/:clientId', controller.getClientAuditLogs);

module.exports = router;
