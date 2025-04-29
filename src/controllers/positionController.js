const { savePosition } = require('../services/positionService');
const { saveDeviceIfNotExists } = require('../services/deviceService');
const { adaptDeviceAndPosition } = require('../adapters/positionAdapter');
const pool = require('../db');

exports.receivePosition = async (req, res) => {
  try {
    const dataArray = Array.isArray(req.body.data) ? req.body.data : [req.body];

    for (const item of dataArray) {
      const { device, position } = adaptDeviceAndPosition(item);

      await saveDeviceIfNotExists(device);
      await savePosition(position);
    }

    res.status(201).json({ message: 'All positions saved successfully' });
  } catch (error) {
    console.error('Error saving position:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

exports.getAllPositions = async (req, res) => {
  try {
    const result = await pool.query(`
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
    `);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching latest positions:', error);
    res.status(500).json({ error: 'Error fetching latest positions' });
  }
};
