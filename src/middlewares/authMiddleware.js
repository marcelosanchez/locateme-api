const isAuthenticated = (req, res, next) => {
  if (req.user?.id) return next()
  return res.status(401).json({ error: 'Unauthorized' })
}

const isStaff = (req, res, next) => {
  if (req.user?.is_staff) return next()
  return res.status(403).json({ error: 'Staff only' })
}

module.exports = {
  isAuthenticated,
  isStaff,
}