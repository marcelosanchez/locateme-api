const pool = require('../db');

// Feature flag for performance optimizations (set via environment variable)
const USE_OPTIMIZED_QUERIES = process.env.USE_OPTIMIZED_SIDEBAR_QUERIES === 'true';

// Import optimized service methods
const optimizedService = USE_OPTIMIZED_QUERIES 
  ? require('./deviceServiceOptimized')
  : null;

// IMPORTANT: Frontend expects specific data type conversions
// Ensure latitude/longitude are returned as strings for TypeScript compatibility
const convertDeviceDataTypes = (devices) => {
  return devices.map(device => ({
    ...device,
    latitude: device.latitude ? device.latitude.toString() : null,
    longitude: device.longitude ? device.longitude.toString() : null,
    battery_level: device.battery_level ? Number(device.battery_level) : null
  }));
};

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
  // Use optimized version if feature flag is enabled and functions are available
  if (USE_OPTIMIZED_QUERIES && optimizedService) {
    try {
      const result = await optimizedService.getUserDevicesWithFreshness(user);
      return result.devices;
    } catch (error) {
      console.error('[deviceService] Optimized query failed, falling back to original:', error);
      // Fall through to original implementation
    }
  }

  // Original implementation (fallback and default)
  const { id: userId, is_staff: isStaff } = user;

  const query = isStaff
    ? `
      SELECT 
        d.id AS device_id,
        d.name AS device_name,
        d.icon AS device_icon,
        d.device_type,
        d.is_primary,
        d.person_id,
        p.name AS person_name,
        p.picture AS person_picture,
        lp.latitude,
        lp.longitude,
        lp.readable_datetime,
        lp.battery_level,
        lp.battery_status
      FROM devices d
      LEFT JOIN people p ON p.id = d.person_id
      LEFT JOIN latest_positions lp ON d.id = lp.device_id
      WHERE d.is_active = TRUE
      ORDER BY d.name
      LIMIT 1000
    `
    : `SELECT * FROM user_device_status WHERE user_id = $1 ORDER BY device_name`;

  const values = isStaff ? [] : [userId];
  const result = await pool.query(query, values);
  
  // CRITICAL: Ensure data types match frontend TypeScript expectations
  return convertDeviceDataTypes(result.rows);
};

exports.getDeviceByIdForUser = async (user, deviceId) => {
  // Use optimized version if available
  if (USE_OPTIMIZED_QUERIES && optimizedService) {
    try {
      return await optimizedService.getDeviceByIdForUser(user, deviceId);
    } catch (error) {
      console.error('[deviceService] Optimized getDeviceByIdForUser failed, falling back:', error);
      // Fall through to original implementation
    }
  }

  // Original implementation
  const query = user.is_staff
    ? `SELECT * FROM user_device_status WHERE device_id = $1`
    : `SELECT * FROM user_device_status WHERE user_id = $1 AND device_id = $2`;

  const values = user.is_staff ? [deviceId] : [user.id, deviceId];
  const result = await pool.query(query, values);
  return result.rows;
};

// Performance monitoring endpoint (only available when optimizations are enabled)
exports.getPerformanceStats = async () => {
  if (USE_OPTIMIZED_QUERIES && optimizedService) {
    return await optimizedService.getPerformanceStats();
  }
  return { 
    error: 'Performance stats only available when optimized queries are enabled',
    feature_flag: USE_OPTIMIZED_QUERIES 
  };
};
