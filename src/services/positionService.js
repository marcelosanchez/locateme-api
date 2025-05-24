const { pool } = require('../config/db');
const { parseCustomDatetime } = require('../shared/utils/datetime');

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

exports.getDevicePositionsHistory = async (deviceId, { limit = 4, start, end }) => {
  let query = `
    SELECT 
      id, device_id, latitude, longitude, readable_datetime, "timestamp"
    FROM positions
    WHERE device_id = $1
      AND latitude IS NOT NULL
      AND longitude IS NOT NULL
  `
  const values = [deviceId]
  let index = 2

  if (start) {
    query += ` AND readable_datetime >= $${index}`
    values.push(parseCustomDatetime(start))
    index++
  }

  if (end) {
    query += ` AND readable_datetime <= $${index}`
    values.push(parseCustomDatetime(end))
    index++
  }

  query += `
    ORDER BY "timestamp" DESC
    LIMIT $${index}
  `
  values.push(limit)

  const { rows } = await pool.query(query, values)

  //remove duplicates
  const seen = new Set()
  const unique = rows.filter(row => {
    const key = `${row.latitude},${row.longitude},${row.timestamp}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  return unique
}
