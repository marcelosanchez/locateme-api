const express = require('express');
const { receivePosition } = require('../controllers/positionController');

const router = express.Router();

router.post('/', receivePosition);

module.exports = router;