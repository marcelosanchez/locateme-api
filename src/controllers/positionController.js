const { savePosition } = require('../services/positionService');
const { saveDeviceIfNotExists } = require('../services/deviceService');
const { adaptDeviceAndPosition } = require('../adapters/positionAdapter');

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
