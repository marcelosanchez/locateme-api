const express = require('express')
const router = express.Router()
const { isAuthenticated, isStaff } = require('../middlewares/authMiddleware')
const deviceController = require('../controllers/deviceController')

router.get('/raw/all', isAuthenticated, isStaff, deviceController.getAllRawDevices)
router.get('/overview', isAuthenticated, deviceController.getOverview)
router.get('/:device_id', isAuthenticated, deviceController.getDeviceById)
router.get('/', isAuthenticated, deviceController.getUserDevices)

module.exports = router
