const express = require('express');
const { receivePosition, getAllPositions } = require('../controllers/positionController');

const router = express.Router();

router.post('/', receivePosition);
router.get('/', getAllPositions);

module.exports = router;
