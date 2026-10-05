const express = require('express');
const router = express.Router();
const controller = require('../controllers/serviceDetailController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.post('/', controller.createServiceDetail);
router.get('/', controller.getServiceDetails);
router.put('/:id', controller.updateServiceDetail);
router.delete('/:id', controller.deleteServiceDetail);

module.exports = router;
