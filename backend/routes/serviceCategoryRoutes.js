const express = require('express');
const router = express.Router();
const controller = require('../controllers/serviceCategoryController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.post('/', controller.createServiceCategory);
router.get('/', controller.getServiceCategories);
router.put('/:id', controller.updateServiceCategory);
router.delete('/:id', controller.deleteServiceCategory);

module.exports = router;
