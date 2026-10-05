const express = require('express');
const router = express.Router();
const controller = require('../controllers/userTypeController');

router.post('/', controller.createUserType);
router.get('/', controller.getUserTypes);
router.put('/:id', controller.updateUserType);
router.delete('/:id', controller.deleteUserType);

module.exports = router;
