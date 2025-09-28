const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middlewares/authMiddleware');
const deviceService = require('../services/deviceService');
const pool = require('../db');

// Performance monitoring endpoint - requires authentication
router.get('/sidebar/stats', authenticateToken, async (req, res) => {
  try {
    const stats = await deviceService.getPerformanceStats();
    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[performanceRoutes] Error getting sidebar stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve performance statistics',
      message: error.message
    });
  }
});

// Manual cache refresh endpoint - requires staff privileges
router.post('/sidebar/refresh', authenticateToken, async (req, res) => {
  try {
    // Check if user is staff
    if (!req.user.is_staff) {
      return res.status(403).json({
        success: false,
        error: 'Staff privileges required'
      });
    }

    const result = await pool.query('SELECT * FROM refresh_sidebar_cache()');
    const refreshResult = result.rows[0];

    res.json({
      success: refreshResult.success,
      data: {
        duration_ms: refreshResult.duration_ms,
        rows_affected: refreshResult.rows_affected,
        error_message: refreshResult.error_message
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[performanceRoutes] Error refreshing cache:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to refresh sidebar cache',
      message: error.message
    });
  }
});

// Cache freshness check endpoint
router.get('/sidebar/freshness', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM get_sidebar_cache_freshness()');
    const freshness = result.rows[0];

    res.json({
      success: true,
      data: {
        cache_age_seconds: freshness.cache_age_seconds,
        is_stale: freshness.is_stale,
        last_refresh: freshness.last_refresh,
        rows_count: freshness.rows_count,
        recommended_action: freshness.is_stale ? 'refresh_cache' : 'none'
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[performanceRoutes] Error checking cache freshness:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check cache freshness',
      message: error.message
    });
  }
});

// Database performance metrics endpoint - staff only
router.get('/database/metrics', authenticateToken, async (req, res) => {
  try {
    if (!req.user.is_staff) {
      return res.status(403).json({
        success: false,
        error: 'Staff privileges required'
      });
    }

    // Get query performance metrics
    const queryStatsQuery = `
      SELECT 
        query,
        calls,
        total_time,
        mean_time,
        stddev_time,
        min_time,
        max_time,
        rows,
        100.0 * shared_blks_hit / nullif(shared_blks_hit + shared_blks_read, 0) AS hit_percent
      FROM pg_stat_statements 
      WHERE query LIKE '%user_device_status%' 
         OR query LIKE '%sidebar_device_cache%'
         OR query LIKE '%latest_positions%'
      ORDER BY total_time DESC
      LIMIT 10
    `;

    // Get index usage stats
    const indexStatsQuery = `
      SELECT 
        schemaname,
        tablename,
        indexname,
        idx_tup_read,
        idx_tup_fetch,
        idx_scan,
        idx_blks_read,
        idx_blks_hit
      FROM pg_stat_user_indexes 
      WHERE indexname LIKE '%device%' 
         OR indexname LIKE '%position%'
         OR indexname LIKE '%user_device%'
      ORDER BY idx_scan DESC
      LIMIT 20
    `;

    const [queryStats, indexStats] = await Promise.all([
      pool.query(queryStatsQuery),
      pool.query(indexStatsQuery)
    ]);

    res.json({
      success: true,
      data: {
        query_performance: queryStats.rows,
        index_usage: indexStats.rows,
        collected_at: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('[performanceRoutes] Error getting database metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve database metrics',
      message: error.message
    });
  }
});

// Health check endpoint for performance optimizations
router.get('/health', async (req, res) => {
  try {
    const optimizationsEnabled = process.env.USE_OPTIMIZED_SIDEBAR_QUERIES === 'true';
    
    // Quick test queries
    const testQueries = await Promise.all([
      pool.query('SELECT COUNT(*) as total_devices FROM devices WHERE is_active = true'),
      pool.query('SELECT COUNT(*) as total_positions FROM positions WHERE created_at > NOW() - INTERVAL \'24 hours\'')
    ]);

    res.json({
      success: true,
      data: {
        optimizations_enabled: optimizationsEnabled,
        total_active_devices: testQueries[0].rows[0].total_devices,
        positions_last_24h: testQueries[1].rows[0].total_positions,
        database_responsive: true
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[performanceRoutes] Health check failed:', error);
    res.status(500).json({
      success: false,
      error: 'Performance health check failed',
      message: error.message
    });
  }
});

module.exports = router;