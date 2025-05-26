const express = require('express')
const passport = require('passport')
const { googleLogin, getSession, logout } = require('../controllers/authController')
const { isAuthenticated } = require('../middlewares/authMiddleware')

const router = express.Router()

router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }))
router.get('/google/callback', passport.authenticate('google', { failureRedirect: '/' }), (req, res) => {
  res.redirect('/dashboard')
})
router.post('/google/login', googleLogin)
router.get('/me', isAuthenticated, getSession)
router.get('/logout', isAuthenticated, logout)

module.exports = router
