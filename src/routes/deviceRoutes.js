const express = require('express')
const router = express.Router()
const pool = require('../db')

function isAuthenticated(req, res, next) {
  if (req.user?.id) return next()
  return res.status(401).json({ error: 'Unauthorized' })
}

function isStaff(req, res, next) {
  if (req.user?.is_staff) return next()
  return res.status(403).json({ error: 'Staff only' })
}

router.get('/', isAuthenticated, async (req, res) => {
  try {
    const { id: userId } = req.user
    const { rows } = await pool.query(
      'SELECT * FROM user_device_status WHERE user_id = $1 ORDER BY device_name',
      [userId]
    )
    res.json(rows)
  } catch (err) {
    console.error('[API] user devices error:', err)
    res.status(500).json({ error: 'Error fetching devices' })
  }
})

router.get('/:device_id', isAuthenticated, async (req, res) => {
  try {
    const { id: userId } = req.user
    const { device_id } = req.params

    const { rows } = await pool.query(
      `SELECT * FROM user_device_status 
       WHERE user_id = $1 AND device_id = $2`,
      [userId, device_id]
    )

    if (rows.length === 0) {
      return res.status(403).json({ error: 'Access denied' })
    }

    res.json(rows[0])
  } catch (err) {
    console.error('[API] device detail error:', err)
    res.status(500).json({ error: 'Error fetching device' })
  }
})

router.get('/raw/all', isAuthenticated, isStaff, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT d.*, p.name AS person_name, p.emoji AS person_emoji
       FROM devices d
       LEFT JOIN people p ON d.person_id = p.id
       WHERE d.is_active = TRUE
       ORDER BY d.name`
    )
    res.json(rows)
  } catch (err) {
    console.error('[API] raw devices error:', err)
    res.status(500).json({ error: 'Error fetching all devices' })
  }
})

module.exports = router

