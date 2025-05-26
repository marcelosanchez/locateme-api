const express = require('express')
const router = express.Router()
const { isAuthenticated, isStaff } = require('../middlewares/authMiddleware')
const deviceController = require('../controllers/deviceController')

router.get('/', isAuthenticated, deviceController.getUserDevices)
router.get('/overview', isAuthenticated, deviceController.getOverview)
router.get('/:device_id', isAuthenticated, deviceController.getDeviceById)
router.get('/raw/all', isAuthenticated, isStaff, deviceController.getAllRawDevices)

module.exports = router
