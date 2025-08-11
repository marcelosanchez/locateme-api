const pool = require('../db');

exports.saveDeviceIfNotExists = async (deviceData) => {
  const { device_id, name, icon, device_type } = deviceData;

  const query = `
    INSERT INTO devices (id, name, icon, device_type)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (id) DO NOTHING
  `;

  const values = [device_id, name, icon, device_type];

  await pool.query(query, values);
};

exports.getUserDevices = async (user) => {
  const { id: userId, is_staff: isStaff } = user

  const query = isStaff
    ? `
      SELECT 
        d.id AS device_id,
        d.name AS device_name,
        d.icon AS device_icon,
        d.device_type,
        d.is_primary,
        d.person_id,
        p.name AS person_name,
        p.picture AS person_picture,
        lp.latitude,
        lp.longitude,
        lp.readable_datetime,
        lp.battery_level,
        lp.battery_status
      FROM devices d
      LEFT JOIN people p ON p.id = d.person_id
      LEFT JOIN latest_positions lp ON d.id = lp.device_id
      WHERE d.is_active = TRUE
      ORDER BY d.name
    `
    : `SELECT * FROM user_device_status WHERE user_id = $1 ORDER BY device_name`

  const values = isStaff ? [] : [userId]

  const result = await pool.query(query, values)
  return result.rows
}

exports.getDeviceByIdForUser = async (user, deviceId) => {
  const query = user.is_staff
    ? `SELECT * FROM user_device_status WHERE device_id = $1`
    : `SELECT * FROM user_device_status WHERE user_id = $1 AND device_id = $2`

  const values = user.is_staff ? [deviceId] : [user.id, deviceId]

  const result = await pool.query(query, values)
  return result.rows
}
