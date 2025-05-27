const pool = require('../config/db').pool
const deviceService = require('../services/deviceService')
const positionService = require('../services/positionService')

// GET /locateme/devices
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

// GET /locateme/devices/:device_id
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

// GET /locateme/devices/raw/all (staff only)
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

// GET /locateme/map/positions
exports.getMapPositions = async (req, res) => {
  try {
    const devices = await deviceService.getUserDevices(req.user)
    const positions = await positionService.fetchLatestPositions()
    const defaultDeviceId = req.user.default_device_id

    const merged = devices.map(device => {
      const match = positions.find(p => p.device_id === device.device_id)
      return {
        device_id: device.device_id,
        device_name: device.device_name,
        device_icon: device.device_icon,
        person_name: device.person_name,
        person_emoji: device.person_emoji,
        latitude: match?.latitude ?? null,
        longitude: match?.longitude ?? null,
        readable_datetime: match?.readable_datetime ?? null,
        is_default: device.device_id === defaultDeviceId,
      }
    })

    res.json(merged)
  } catch (err) {
    console.error('[getMapPositions] Error:', err.message || err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

// GET /locateme/sidebar/devices
exports.getSidebarDevices = async (req, res) => {
  try {
    const devices = await deviceService.getUserDevices(req.user)
    res.json(devices)
  } catch (err) {
    console.error('[getSidebarDevices] Error:', err.message || err)
    res.status(500).json({ error: 'Internal server error' })
  }
}
