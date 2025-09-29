const pool = require('../db');

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

// Enhanced getUserDevices with optimized queries using materialized view
exports.getUserDevices = async (user) => {
  const { id: userId, is_staff: isStaff } = user;

  if (isStaff) {
    // Staff query with result limiting and optimized materialized view
    const query = `
      SELECT 
        device_id, device_name, device_icon, device_type, is_primary,
        person_id, person_name,
        latitude, longitude, readable_datetime, battery_level, battery_status
      FROM sidebar_device_cache
      ORDER BY device_name
      LIMIT 1000
    `;
    
    const result = await pool.query(query);
    // Note: materialized view already has proper type conversion for lat/lng
    return result.rows;
  } else {
    // Regular user query with optimized materialized view
    const query = `
      SELECT 
        sdc.device_id, sdc.device_name, sdc.device_icon, sdc.device_type,
        sdc.is_primary, sdc.person_id, sdc.person_name,
        sdc.latitude, sdc.longitude, sdc.readable_datetime,
        sdc.battery_level, sdc.battery_status
      FROM user_device_access uda
      JOIN sidebar_device_cache sdc ON uda.device_id = sdc.device_id
      WHERE uda.user_id = $1
      ORDER BY sdc.device_name
    `;
    
    const result = await pool.query(query, [userId]);
    // Note: materialized view already has proper type conversion for lat/lng
    return result.rows;
  }
};

// Fallback method using original queries (for rollback scenarios)
exports.getUserDevicesOriginal = async (user) => {
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

// Cache-aware method with freshness checking
const CACHE_STALENESS_THRESHOLD_MS = parseInt(process.env.CACHE_STALENESS_THRESHOLD_MS) || 300000; // 5 minutes default
const CACHE_STALENESS_THRESHOLD_SECONDS = Math.floor(CACHE_STALENESS_THRESHOLD_MS / 1000);

exports.getUserDevicesWithFreshness = async (user, maxCacheAgeSeconds = CACHE_STALENESS_THRESHOLD_SECONDS) => {
  try {
    // Check cache freshness first
    const freshnessQuery = `SELECT * FROM get_sidebar_cache_freshness()`;
    const freshnessResult = await pool.query(freshnessQuery);
    const freshness = freshnessResult.rows[0];
    
    // Smart refresh strategy based on cache age
    if (freshness.is_stale || freshness.cache_age_seconds > maxCacheAgeSeconds) {
      console.log(`[deviceService] Cache age: ${freshness.cache_age_seconds}s (threshold: ${maxCacheAgeSeconds}s), refreshing...`);
      
      // Try to refresh cache first, then serve data
      try {
        await pool.query('SELECT refresh_sidebar_cache()');
        console.log(`[deviceService] ✅ Cache refreshed successfully`);
        
        // Serve fresh data from refreshed cache
        const devices = await exports.getUserDevices(user);
        return {
          devices,
          cache_age_seconds: 0, // Fresh cache
          is_stale: false,
          source: 'refreshed_cache'
        };
      } catch (refreshError) {
        console.error('[deviceService] ❌ Cache refresh failed, using fallback:', refreshError);
        // Fallback to original query if refresh fails
        const devices = await exports.getUserDevicesOriginal(user);
        return {
          devices,
          cache_age_seconds: freshness.cache_age_seconds,
          is_stale: true,
          source: 'fallback'
        };
      }
    }
    
    // Use optimized query with fresh cache
    const devices = await exports.getUserDevices(user);
    return {
      devices,
      cache_age_seconds: freshness.cache_age_seconds,
      is_stale: false,
      source: 'materialized_view'
    };
    
  } catch (error) {
    console.error('[deviceService] Error in getUserDevicesWithFreshness:', error);
    // Fallback to original method on any error
    const devices = await exports.getUserDevicesOriginal(user);
    return {
      devices,
      cache_age_seconds: null,
      is_stale: true,
      source: 'error_fallback',
      error: error.message
    };
  }
};

// Original methods preserved for compatibility
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

exports.getDeviceByIdForUser = async (user, deviceId) => {
  // Use materialized view for better performance
  const query = user.is_staff
    ? `SELECT * FROM sidebar_device_cache WHERE device_id = $1`
    : `
      SELECT sdc.* 
      FROM user_device_access uda
      JOIN sidebar_device_cache sdc ON uda.device_id = sdc.device_id
      WHERE uda.user_id = $1 AND uda.device_id = $2
    `;

  const values = user.is_staff ? [deviceId] : [user.id, deviceId];
  const result = await pool.query(query, values);
  return result.rows;
};

// Performance monitoring helper
exports.getPerformanceStats = async () => {
  try {
    const stats = await pool.query('SELECT * FROM get_sidebar_refresh_stats()');
    const freshness = await pool.query('SELECT * FROM get_sidebar_cache_freshness()');
    
    return {
      refresh_stats: stats.rows[0],
      freshness: freshness.rows[0],
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('[deviceService] Error getting performance stats:', error);
    return { error: error.message };
  }
};