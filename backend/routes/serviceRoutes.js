const express = require('express');
const router = express.Router();
const controller = require('../controllers/serviceController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.post('/', controller.createService);
router.get('/', controller.getServices);
router.put('/:id', controller.updateService);
router.delete('/:id', controller.deleteService);

module.exports = router;
