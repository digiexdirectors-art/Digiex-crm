const express = require('express');
const router = express.Router();
const { getSettings, getSettingByKey, updateSetting } = require('../controllers/settingController');

router.get('/', getSettings);
router.get('/:key', getSettingByKey);
router.post('/', updateSetting);

module.exports = router;
