const express = require('express');
const router = express.Router();
const leadController = require('../controllers/leadController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.post('/', leadController.createLead);
router.get('/', leadController.getLeads);
router.post('/bulk', leadController.bulkUploadLeads);
router.put('/:id', leadController.updateLead);
router.delete('/:id', leadController.deleteLead);

module.exports = router;
