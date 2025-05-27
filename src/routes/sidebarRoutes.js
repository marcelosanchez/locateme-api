const express = require('express')
const router = express.Router()
const { authenticateToken } = require('../middlewares/authMiddleware')
const { getSidebarDevices } = require('../controllers/deviceController')

router.get('/devices', authenticateToken, getSidebarDevices)

module.exports = router
