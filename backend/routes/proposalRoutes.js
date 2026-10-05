const express = require('express');
const router = express.Router();
const controller = require('../controllers/proposalController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.post('/', controller.createProposal);
router.get('/', controller.getProposals);
router.put('/:id', controller.updateProposal);
router.delete('/:id', controller.deleteProposal);

module.exports = router;
