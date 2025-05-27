const express = require('express')
const router = express.Router()
const { getOverview } = require('../controllers/deviceController')
const { authenticateToken } = require('../middlewares/authMiddleware')

router.get('/', authenticateToken, getOverview)

module.exports = router
