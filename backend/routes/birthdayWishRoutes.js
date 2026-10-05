const express = require('express');
const router = express.Router();
const birthdayWishController = require('../controllers/birthdayWishController');

router.post('/send', birthdayWishController.sendWish);
router.get('/:userId', birthdayWishController.getWishes);
router.put('/read/:userId', birthdayWishController.markAsRead);

module.exports = router;
