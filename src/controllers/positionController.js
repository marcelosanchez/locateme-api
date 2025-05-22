const positionService = require('../services/positionService');
const deviceService = require('../services/deviceService');
const { adaptDeviceAndPosition } = require('../adapters/positionAdapter');
const { log, error } = require('../shared/utils/logger');

exports.receivePosition = async (req, res) => {
  try {
    const dataArray = Array.isArray(req.body.data) ? req.body.data : [req.body];
    log(`[API] Received ${dataArray.length} position(s)`);

    for (const item of dataArray) {
      const { device, position } = adaptDeviceAndPosition(item);

      await deviceService.saveDeviceIfNotExists(device);
      await positionService.savePosition(position);

      log(`[DB] Saved position for device_id: ${device.device_id}`);
    }

    res.status(201).json({ message: 'All positions saved successfully' });
  } catch (err) {
    error('[PositionController] Error saving position:', err.message || err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

exports.getAllPositions = async (req, res) => {
  try {
    log(`[API] Fetching latest positions...`);

    const rows = await positionService.fetchLatestPositions();

    log(`[DB] Retrieved ${rows.length} latest positions`);
    res.status(200).json(rows);
  } catch (err) {
    error('[PositionController] Error fetching latest positions:', err.message || err);
    res.status(500).json({ error: 'Error fetching latest positions' });
  }
};
