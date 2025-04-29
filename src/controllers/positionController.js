const { savePosition } = require('../services/positionService');
const { saveDeviceIfNotExists } = require('../services/deviceService');
const { adaptDeviceAndPosition } = require('../adapters/positionAdapter');
const pool = require('../db');
const { log, error } = require('../shared/utils/logger');

exports.receivePosition = async (req, res) => {
  try {
    const dataArray = Array.isArray(req.body.data) ? req.body.data : [req.body];
    log(`[API] Received ${dataArray.length} position(s)`);

    for (const item of dataArray) {
      const { device, position } = adaptDeviceAndPosition(item);

      await saveDeviceIfNotExists(device);
      await savePosition(position);

      log(`[DB] Saved position for device_id: ${device.device_id}`);
    }

    res.status(201).json({ message: 'All positions saved successfully' });
  } catch (err) {
    error('[ERROR] Error saving position:', err.message || err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

exports.getAllPositions = async (req, res) => {
  try {
    log(`[API] Fetching latest positions...`);
    
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

    log(`[DB] Retrieved ${result.rowCount} latest positions`);

    res.status(200).json(result.rows);
  } catch (err) {
    error('[ERROR] Error fetching latest positions:', err.message || err);
    res.status(500).json({ error: 'Error fetching latest positions' });
  }
};
