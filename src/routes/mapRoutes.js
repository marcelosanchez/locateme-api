const express = require('express')
const router = express.Router()
const { authenticateToken } = require('../middlewares/authMiddleware')
const { getMapPositions } = require('../controllers/deviceController')

router.get('/positions', authenticateToken, getMapPositions)

module.exports = router
