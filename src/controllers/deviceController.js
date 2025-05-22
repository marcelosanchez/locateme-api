const pool = require('../config/db').pool

exports.getUserDevices = async (req, res) => {
  try {
    const userId = req.user.id
    const { rows } = await pool.query(
      'SELECT * FROM user_device_status WHERE user_id = $1 ORDER BY device_name',
      [userId]
    )
    res.json(rows)
  } catch (err) {
    console.error('[DeviceController] getUserDevices error:', err)
    res.status(500).json({ error: 'Error fetching devices' })
  }
}

exports.getDeviceById = async (req, res) => {
  try {
    const userId = req.user.id
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
    console.error('[DeviceController] getDeviceById error:', err)
    res.status(500).json({ error: 'Error fetching device' })
  }
}

exports.getAllRawDevices = async (req, res) => {
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
    console.error('[DeviceController] getAllRawDevices error:', err)
    res.status(500).json({ error: 'Error fetching all devices' })
  }
}
