const express = require('express')
const router = express.Router()
const { authenticateToken, isStaff } = require('../middlewares/authMiddleware')
const deviceController = require('../controllers/deviceController')

router.get('/raw/all', authenticateToken, isStaff, deviceController.getAllRawDevices)
router.get('/:device_id', authenticateToken, deviceController.getDeviceById)
router.get('/', authenticateToken, deviceController.getUserDevices)

module.exports = router
