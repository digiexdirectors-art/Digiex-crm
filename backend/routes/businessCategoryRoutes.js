const express = require('express');
const router = express.Router();
const businessCategoryController = require('../controllers/businessCategoryController');

router.get('/', businessCategoryController.getCategories);
router.post('/', businessCategoryController.addCategory);
router.post('/:id/subcategories', businessCategoryController.addSubCategory);
router.put('/:id', businessCategoryController.updateCategory);
router.delete('/:id', businessCategoryController.deleteCategory);

module.exports = router;
