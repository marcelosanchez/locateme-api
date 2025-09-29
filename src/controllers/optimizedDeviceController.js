const pool = require('../db');

/**
 * Optimized Device Controller
 * 
 * Provides ultra-efficient endpoints for:
 * - Sidebar device names (no locations)
 * - Map device positions (all locations)
 * - Single device position (real-time)
 * - Batch position updates
 */

// IMPORTANT: Frontend expects specific data type conversions
const convertDeviceDataTypes = (devices) => {
  return devices.map(device => ({
    ...device,
    latitude: device.latitude ? device.latitude.toString() : null,
    longitude: device.longitude ? device.longitude.toString() : null,
    battery_level: device.battery_level ? Number(device.battery_level) : null
  }));
};

/**
 * GET /locateme/sidebar/device-names
 * Returns ONLY device names for sidebar (no positions)
 * Ultra-fast query optimized for minimal data transfer
 */
exports.getDeviceNamesForSidebar = async (req, res) => {
  try {
    const { id: userId, is_staff: isStaff } = req.user;

    const query = isStaff
      ? `
        SELECT 
          device_id,
          device_name,
          device_icon,
          device_type,
          person_name,
          is_primary
        FROM sidebar_device_cache 
        ORDER BY device_name
        LIMIT 1000
      `
      : `
        SELECT 
          sdc.device_id,
          sdc.device_name,
          sdc.device_icon,
          sdc.device_type,
          sdc.person_name,
          sdc.is_primary
        FROM user_device_access uda
        JOIN sidebar_device_cache sdc ON uda.device_id = sdc.device_id
        WHERE uda.user_id = $1
        ORDER BY sdc.device_name
      `;

    const values = isStaff ? [] : [userId];
    const result = await pool.query(query, values);

    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[optimizedDeviceController] Error getting device names:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve device names',
      message: error.message
    });
  }
};

/**
 * GET /locateme/map/device-positions
 * Returns ALL device positions for map markers
 * Optimized for map rendering with all locations
 */
exports.getAllDevicePositions = async (req, res) => {
  try {
    const { id: userId, is_staff: isStaff } = req.user;

    const query = isStaff
      ? `
        SELECT 
          device_id,
          device_name,
          device_icon,
          device_type,
          latitude,
          longitude,
          readable_datetime,
          battery_level,
          battery_status,
          person_name,
          is_primary
        FROM sidebar_device_cache 
        WHERE latitude IS NOT NULL 
          AND longitude IS NOT NULL
        ORDER BY device_name
        LIMIT 1000
      `
      : `
        SELECT 
          sdc.device_id,
          sdc.device_name,
          sdc.device_icon,
          sdc.device_type,
          sdc.latitude,
          sdc.longitude,
          sdc.readable_datetime,
          sdc.battery_level,
          sdc.battery_status,
          sdc.person_name,
          sdc.is_primary
        FROM user_device_access uda
        JOIN sidebar_device_cache sdc ON uda.device_id = sdc.device_id
        WHERE uda.user_id = $1
          AND sdc.latitude IS NOT NULL 
          AND sdc.longitude IS NOT NULL
        ORDER BY sdc.device_name
      `;

    const values = isStaff ? [] : [userId];
    const result = await pool.query(query, values);

    // Convert data types for frontend compatibility
    const convertedData = convertDeviceDataTypes(result.rows);

    res.json({
      success: true,
      data: convertedData,
      count: convertedData.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[optimizedDeviceController] Error getting device positions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve device positions',
      message: error.message
    });
  }
};

/**
 * GET /locateme/devices/:deviceId/position
 * Returns single device position (real-time, no cache)
 * Used when user clicks on device in sidebar
 */
exports.getSingleDevicePosition = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { id: userId, is_staff: isStaff } = req.user;

    // Validate user has access to this device
    const accessQuery = isStaff
      ? `SELECT 1 FROM devices WHERE id = $1 AND is_active = true`
      : `SELECT 1 FROM user_device_access WHERE user_id = $1 AND device_id = $2`;
    
    const accessValues = isStaff ? [deviceId] : [userId, deviceId];
    const accessResult = await pool.query(accessQuery, accessValues);

    if (accessResult.rows.length === 0) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to this device'
      });
    }

    // Get fresh position data (no cache for real-time accuracy)
    const positionQuery = `
      SELECT 
        d.id as device_id,
        d.name as device_name,
        d.icon as device_icon,
        d.device_type,
        d.is_primary,
        d.person_id,
        p.name as person_name,
        p.picture as person_picture,
        lp.latitude,
        lp.longitude,
        lp.readable_datetime,
        lp.battery_level,
        lp.battery_status,
        lp.timestamp,
        lp.horizontal_accuracy,
        lp.altitude
      FROM devices d
      LEFT JOIN people p ON p.id = d.person_id
      LEFT JOIN latest_positions lp ON d.id = lp.device_id
      WHERE d.id = $1 AND d.is_active = true
    `;

    const result = await pool.query(positionQuery, [deviceId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Device not found'
      });
    }

    // Convert data types for frontend compatibility
    const convertedData = convertDeviceDataTypes(result.rows);

    res.json({
      success: true,
      data: convertedData[0],
      timestamp: new Date().toISOString(),
      real_time: true
    });

  } catch (error) {
    console.error('[optimizedDeviceController] Error getting single device position:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve device position',
      message: error.message
    });
  }
};

/**
 * GET /locateme/map/batch-positions
 * Returns batch position updates for multiple devices
 * Used for periodic updates of non-selected devices
 */
exports.getBatchPositions = async (req, res) => {
  try {
    const { id: userId, is_staff: isStaff } = req.user;
    const { device_ids, exclude_device_id } = req.query;

    let deviceIds = [];
    if (device_ids) {
      deviceIds = Array.isArray(device_ids) ? device_ids : device_ids.split(',');
    }

    // Build dynamic query based on parameters
    let query = isStaff
      ? `
        SELECT 
          device_id,
          device_name,
          latitude,
          longitude,
          readable_datetime,
          battery_level,
          battery_status
        FROM sidebar_device_cache 
        WHERE latitude IS NOT NULL 
          AND longitude IS NOT NULL
      `
      : `
        SELECT 
          sdc.device_id,
          sdc.device_name,
          sdc.latitude,
          sdc.longitude,
          sdc.readable_datetime,
          sdc.battery_level,
          sdc.battery_status
        FROM user_device_access uda
        JOIN sidebar_device_cache sdc ON uda.device_id = sdc.device_id
        WHERE uda.user_id = $1
          AND sdc.latitude IS NOT NULL 
          AND sdc.longitude IS NOT NULL
      `;

    let values = isStaff ? [] : [userId];
    let paramIndex = values.length + 1;

    // Add device_ids filter if provided
    if (deviceIds.length > 0) {
      const placeholders = deviceIds.map((_, i) => `$${paramIndex + i}`).join(',');
      query += ` AND ${isStaff ? '' : 'sdc.'}device_id IN (${placeholders})`;
      values.push(...deviceIds);
      paramIndex += deviceIds.length;
    }

    // Exclude specific device if provided (for selected device)
    if (exclude_device_id) {
      query += ` AND ${isStaff ? '' : 'sdc.'}device_id != $${paramIndex}`;
      values.push(exclude_device_id);
    }

    query += ` ORDER BY ${isStaff ? '' : 'sdc.'}device_name LIMIT 100`;

    const result = await pool.query(query, values);

    // Convert data types for frontend compatibility
    const convertedData = convertDeviceDataTypes(result.rows);

    res.json({
      success: true,
      data: convertedData,
      count: convertedData.length,
      timestamp: new Date().toISOString(),
      excluded_device: exclude_device_id || null
    });

  } catch (error) {
    console.error('[optimizedDeviceController] Error getting batch positions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve batch positions',
      message: error.message
    });
  }
};

/**
 * GET /locateme/devices/:deviceId/route
 * Returns device route/trail for selected device
 * Optimized query with time-based filtering
 */
exports.getDeviceRoute = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { id: userId, is_staff: isStaff } = req.user;
    const { hours = 24, limit = 100 } = req.query;

    // Validate user has access to this device
    const accessQuery = isStaff
      ? `SELECT 1 FROM devices WHERE id = $1 AND is_active = true`
      : `SELECT 1 FROM user_device_access WHERE user_id = $1 AND device_id = $2`;
    
    const accessValues = isStaff ? [deviceId] : [userId, deviceId];
    const accessResult = await pool.query(accessQuery, accessValues);

    if (accessResult.rows.length === 0) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to this device'
      });
    }

    // Get route data with time filtering
    const routeQuery = `
      SELECT 
        latitude,
        longitude,
        readable_datetime,
        timestamp,
        horizontal_accuracy,
        battery_level
      FROM positions
      WHERE device_id = $1
        AND latitude IS NOT NULL 
        AND longitude IS NOT NULL
        AND timestamp > (EXTRACT(epoch FROM NOW() - INTERVAL '${parseInt(hours)} hours') * 1000)
      ORDER BY timestamp DESC
      LIMIT $2
    `;

    const result = await pool.query(routeQuery, [deviceId, parseInt(limit)]);

    // Convert data types for frontend compatibility
    const convertedData = result.rows.map(row => ({
      ...row,
      latitude: row.latitude ? row.latitude.toString() : null,
      longitude: row.longitude ? row.longitude.toString() : null,
      battery_level: row.battery_level ? Number(row.battery_level) : null
    }));

    res.json({
      success: true,
      data: convertedData,
      count: convertedData.length,
      device_id: deviceId,
      hours_span: parseInt(hours),
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[optimizedDeviceController] Error getting device route:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve device route',
      message: error.message
    });
  }
};

module.exports = {
  getDeviceNamesForSidebar,
  getAllDevicePositions,
  getSingleDevicePosition,
  getBatchPositions,
  getDeviceRoute
};