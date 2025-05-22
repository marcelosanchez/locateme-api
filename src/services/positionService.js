const { pool } = require('../config/db')

exports.savePosition = async (position) => {
  const {
    device_id,
    latitude,
    longitude,
    altitude,
    floor_level,
    horizontal_accuracy,
    vertical_accuracy,
    position_type,
    address,
    city,
    country,
    timestamp,
    readable_datetime,
    battery_level,
    battery_status
  } = position;

  const query = `
    INSERT INTO positions (
      device_id, latitude, longitude, altitude, floor_level,
      horizontal_accuracy, vertical_accuracy, position_type,
      address, city, country, timestamp, readable_datetime,
      battery_level, battery_status
    ) VALUES (
      $1, $2, $3, $4, $5,
      $6, $7, $8,
      $9, $10, $11, $12, $13,
      $14, $15
    )
  `;

  const values = [
    device_id,
    latitude,
    longitude,
    altitude,
    floor_level,
    horizontal_accuracy,
    vertical_accuracy,
    position_type,
    address,
    city,
    country,
    timestamp,
    readable_datetime,
    battery_level,
    battery_status
  ];

  await pool.query(query, values);
};

exports.fetchLatestPositions = async () => {
  const query = `
    SELECT 
      p.device_id,
      p.latitude,
      p.longitude,
      p.timestamp,
      p.readable_datetime,
      d.name AS device_name,
      d.icon AS device_icon
    FROM positions p
    JOIN devices d ON p.device_id = d.id
    INNER JOIN (
        SELECT device_id, MAX(timestamp) AS max_timestamp
        FROM positions
        GROUP BY device_id
    ) latest ON p.device_id = latest.device_id AND p.timestamp = latest.max_timestamp
    ORDER BY p.device_id;
  `;

  const result = await pool.query(query);
  return result.rows;
};
