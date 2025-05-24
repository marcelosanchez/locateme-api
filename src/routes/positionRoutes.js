const express = require('express');
const router = express.Router();
const positionController = require('../controllers/positionController');

router.post('/', positionController.receivePosition);
router.get('/', positionController.getAllPositions);
router.get('/history/:device_id', positionController.getDeviceHistory);

module.exports = router;
