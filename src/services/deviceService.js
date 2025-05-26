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
  const { id: userId } = user

  const result = await pool.query(
    `SELECT * FROM user_device_status WHERE user_id = $1 ORDER BY device_name`,
    [userId]
  )

  return result.rows
}
