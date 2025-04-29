const moment = require('moment');

exports.adaptDeviceAndPosition = (item) => {
  const device = {
    device_id: item.serialNumber,
    name: item.name?.label || '',
    icon: item.name?.emoji || '',
    device_type: 'Unknown'
  };

  const position = {
    device_id: item.serialNumber,
    latitude: item.location?.latitude,
    longitude: item.location?.longitude,
    altitude: item.location?.altitude,
    floor_level: item.location?.floorLevel,
    horizontal_accuracy: item.location?.horizontalAccuracy,
    vertical_accuracy: item.location?.verticalAccuracy,
    position_type: item.positionType || '',
    address: item.address?.street || '',
    city: item.address?.locality || '',
    country: item.address?.country || '',
    timestamp: item.timeStamp,
    readable_datetime: item.timeStamp 
      ? moment.utc(item.timeStamp).format('YYYY-MM-DD HH:mm:ss')
      : null,
    battery_level: item.battery?.level,
    battery_status: item.battery?.status || ''
  };

  return { device, position };
};
2