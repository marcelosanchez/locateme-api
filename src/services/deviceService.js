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
        device_id,
        device_name,
        device_icon,
        device_type,
        is_primary,
        person_id,
        person_name,
        person_emoji,
        latitude,
        longitude,
        readable_datetime,
        battery_level,
        battery_status
      FROM user_device_status 
      ORDER BY device_name
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
