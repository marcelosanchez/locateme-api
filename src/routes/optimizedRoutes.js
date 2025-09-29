const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middlewares/authMiddleware');
const optimizedController = require('../controllers/optimizedDeviceController');

/**
 * Optimized Routes for LocateMe
 * 
 * Provides ultra-efficient endpoints for:
 * - Sidebar operations (device names only)
 * - Map operations (all positions, single device, batch updates)
 * - Device routes/trails
 */

// =============================================================================
// SIDEBAR ROUTES - Ultra-fast, minimal data
// =============================================================================

/**
 * GET /sidebar/device-names
 * Returns only device names for sidebar (no positions)
 * Optimized for minimal data transfer and maximum speed
 */
router.get('/sidebar/device-names', 
  authenticateToken, 
  optimizedController.getDeviceNamesForSidebar
);

// =============================================================================
// MAP ROUTES - Position data for visualization
// =============================================================================

/**
 * GET /map/device-positions
 * Returns all device positions for map markers
 * Used for initial map load and general position updates
 */
router.get('/map/device-positions', 
  authenticateToken, 
  optimizedController.getAllDevicePositions
);

/**
 * GET /map/batch-positions
 * Returns batch position updates for multiple devices
 * Used for periodic updates of non-selected devices (30-60s intervals)
 * Query params:
 * - device_ids: comma-separated list of device IDs (optional)
 * - exclude_device_id: device ID to exclude (for selected device)
 */
router.get('/map/batch-positions', 
  authenticateToken, 
  optimizedController.getBatchPositions
);

// =============================================================================
// DEVICE SPECIFIC ROUTES - Real-time data
// =============================================================================

/**
 * GET /devices/:deviceId/position
 * Returns single device position (real-time, no cache)
 * Used when user clicks on device in sidebar for immediate centering
 */
router.get('/devices/:deviceId/position', 
  authenticateToken, 
  optimizedController.getSingleDevicePosition
);

/**
 * GET /devices/:deviceId/route
 * Returns device route/trail for selected device
 * Query params:
 * - hours: number of hours to look back (default: 24)
 * - limit: maximum number of points (default: 100)
 */
router.get('/devices/:deviceId/route', 
  authenticateToken, 
  optimizedController.getDeviceRoute
);

// =============================================================================
// PERFORMANCE MONITORING
// =============================================================================

/**
 * GET /performance/endpoints
 * Returns performance metrics for optimized endpoints
 */
router.get('/performance/endpoints', authenticateToken, async (req, res) => {
  try {
    // Simple endpoint performance check
    const testQueries = await Promise.allSettled([
      // Test sidebar query speed
      req.app.locals.pool?.query(`
        SELECT COUNT(*) as sidebar_devices 
        FROM sidebar_device_cache 
        LIMIT 1
      `),
      
      // Test map positions query speed  
      req.app.locals.pool?.query(`
        SELECT COUNT(*) as map_positions 
        FROM sidebar_device_cache 
        WHERE latitude IS NOT NULL 
        LIMIT 1
      `)
    ]);

    res.json({
      success: true,
      endpoints: {
        sidebar_device_names: '/sidebar/device-names',
        map_device_positions: '/map/device-positions',
        single_device_position: '/devices/:id/position',
        batch_positions: '/map/batch-positions',
        device_route: '/devices/:id/route'
      },
      health_check: {
        sidebar_query: testQueries[0].status === 'fulfilled' ? 'OK' : 'ERROR',
        map_query: testQueries[1].status === 'fulfilled' ? 'OK' : 'ERROR'
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Performance check failed',
      message: error.message
    });
  }
});

module.exports = router;