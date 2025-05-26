const { OAuth2Client } = require('google-auth-library')
const { findOrCreateUser } = require('../services/userService')
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID)

const googleLogin = async (req, res) => {
  const { token } = req.body

  if (!token) {
    return res.status(400).json({ error: 'Token is required' })
  }
  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    })
    const payload = ticket.getPayload()
    const { email, sub: googleId } = payload || {}

    if (!email || !googleId) {
      return res.status(400).json({ error: 'Incomplete Google profile' })
    }

    const user = await findOrCreateUser(payload)
    if (!user?.active) {return res.status(403).json({ error: 'User is inactive' })}

    req.login(user, err => {
      if (err) return res.status(500).json({ error: 'Login failed' })
      req.session.save(err => {
        if (err) return res.status(500).json({ error: 'Session save failed' })
        res.json(user)
      })
    })
  } catch (err) {
    console.error('[Google login]', err.message || err)
    return res.status(401).json({ error: 'Invalid token or authentication failed' })
  }
}

const getSession = (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  res.status(200).json(req.user)
}

const logout = (req, res) => {
  req.logout(err => {
    if (err) return res.status(500).json({ error: 'Logout failed' })
    req.session.destroy(err => {
      if (err) return res.status(500).json({ error: 'Session destroy failed' })
      res.clearCookie('connect.sid')
      req.session = null
      res.status(200).json({ message: 'Logged out successfully' })
    })
  })
}

module.exports = {
  googleLogin,
  getSession,
  logout,
}
