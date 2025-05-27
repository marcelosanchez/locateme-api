const jwt = require('jsonwebtoken')

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization']
  const token = authHeader?.split(' ')[1] // Authorization: Bearer <token>

  if (!token) {
    return res.status(401).json({ error: 'Missing token' })
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' })
    req.user = decoded
    next()
  })
}

const isStaff = (req, res, next) => {
  if (req.user?.is_staff) return next()
  return res.status(403).json({ error: 'Staff only' })
}

module.exports = {
  authenticateToken,
  isStaff,
}
