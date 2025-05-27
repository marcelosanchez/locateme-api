const jwt = require('jsonwebtoken')
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
    if (!user?.active) {
      return res.status(403).json({ error: 'User is inactive' })
    }

    const jwtToken = jwt.sign(
      {
        id: user.id,
        email: user.email,
        is_staff: user.is_staff,
        name: user.name,
        picture: user.picture,
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    )

    res.status(200).json({ token: jwtToken, user })
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
  // logout does not invalidate JWT on server
  // just notifies client to remove it
  res.status(200).json({ message: 'Client must remove JWT token' })
}

module.exports = {
  googleLogin,
  getSession,
  logout,
}
