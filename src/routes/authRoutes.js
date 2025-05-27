const express = require('express')
const { googleLogin, getSession, logout } = require('../controllers/authController')
const { authenticateToken } = require('../middlewares/authMiddleware')

const router = express.Router()

router.post('/google/login', googleLogin)
router.get('/me', authenticateToken, getSession)
router.get('/logout', logout)

module.exports = router
