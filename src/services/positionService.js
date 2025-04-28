const pool = require('../db');

exports.savePosition = async (positionData) => {
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
  } = positionData;

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
