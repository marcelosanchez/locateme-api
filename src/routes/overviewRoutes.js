const express = require('express')
const router = express.Router()
const { getOverview } = require('../controllers/deviceController')
const { isAuthenticated } = require('../middlewares/authMiddleware')

router.get('/', isAuthenticated, getOverview)

module.exports = router
