const { savePosition } = require('../services/positionService');

exports.receivePosition = async (req, res) => {
  try {
    const positionData = req.body;
    await savePosition(positionData);
    res.status(201).json({ message: 'Position saved successfully' });
  } catch (error) {
    console.error('Error saving position:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
