#!/usr/bin/env node

/**
 * LocateMe Performance Optimization - Auto Refresh Setup
 * 
 * This script sets up automated refresh for the sidebar_device_cache materialized view
 * using node-cron for cross-platform compatibility.
 * 
 * Refresh Interval: Every 30 seconds
 * Frontend Impact: Compatible with 15s map polling and cached sidebar data
 */

const cron = require('node-cron');
const pool = require('../src/config/db').pool || require('../src/db');

let refreshStats = {
  totalRefreshes: 0,
  successfulRefreshes: 0,
  lastRefreshTime: null,
  lastRefreshDuration: null,
  errors: []
};

// Refresh function
async function refreshSidebarCache() {
  const startTime = Date.now();
  
  try {
    console.log('[AutoRefresh] Starting sidebar cache refresh...');
    
    const result = await pool.query('SELECT * FROM refresh_sidebar_cache()');
    const refreshResult = result.rows[0];
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    refreshStats.totalRefreshes++;
    refreshStats.lastRefreshTime = new Date().toISOString();
    refreshStats.lastRefreshDuration = duration;
    
    if (refreshResult.success) {
      refreshStats.successfulRefreshes++;
      console.log(`[AutoRefresh] ✅ Cache refreshed successfully in ${refreshResult.duration_ms}ms (${refreshResult.rows_affected} rows)`);
    } else {
      refreshStats.errors.push({
        timestamp: new Date().toISOString(),
        error: refreshResult.error_message,
        duration: duration
      });
      console.error(`[AutoRefresh] ❌ Cache refresh failed: ${refreshResult.error_message}`);
    }
    
    // Keep only last 10 errors
    if (refreshStats.errors.length > 10) {
      refreshStats.errors = refreshStats.errors.slice(-10);
    }
    
  } catch (error) {
    refreshStats.totalRefreshes++;
    refreshStats.errors.push({
      timestamp: new Date().toISOString(),
      error: error.message,
      duration: Date.now() - startTime
    });
    
    console.error('[AutoRefresh] ❌ Cache refresh error:', error);
  }
}

// Health check function
async function healthCheck() {
  try {
    const result = await pool.query('SELECT * FROM get_sidebar_cache_freshness()');
    const freshness = result.rows[0];
    
    console.log(`[AutoRefresh] 🔍 Cache age: ${freshness.cache_age_seconds}s, Stale: ${freshness.is_stale}, Rows: ${freshness.rows_count}`);
    
    // If cache is too stale (over 120 seconds), trigger immediate refresh
    if (freshness.cache_age_seconds > 120) {
      console.warn('[AutoRefresh] ⚠️  Cache is very stale, triggering immediate refresh');
      await refreshSidebarCache();
    }
    
  } catch (error) {
    console.error('[AutoRefresh] Health check failed:', error);
  }
}

// Print stats function
function printStats() {
  const successRate = refreshStats.totalRefreshes > 0 
    ? (refreshStats.successfulRefreshes / refreshStats.totalRefreshes * 100).toFixed(1)
    : 0;
    
  console.log(`[AutoRefresh] 📊 Stats: ${refreshStats.successfulRefreshes}/${refreshStats.totalRefreshes} success (${successRate}%), Last: ${refreshStats.lastRefreshTime || 'Never'}`);
  
  if (refreshStats.errors.length > 0) {
    console.log(`[AutoRefresh] ⚠️  Recent errors: ${refreshStats.errors.length}`);
  }
}

// Setup cron jobs
function setupAutoRefresh() {
  console.log('[AutoRefresh] 🚀 Starting LocateMe sidebar cache auto-refresh...');
  console.log('[AutoRefresh] ⏰ Refresh interval: Every 30 seconds');
  console.log('[AutoRefresh] 📋 Health check: Every 2 minutes');
  console.log('[AutoRefresh] 📊 Stats report: Every 5 minutes');
  
  // Main refresh job - every 30 seconds
  cron.schedule('*/30 * * * * *', refreshSidebarCache, {
    name: 'sidebar-cache-refresh',
    timezone: 'UTC'
  });
  
  // Health check - every 2 minutes
  cron.schedule('*/2 * * * *', healthCheck, {
    name: 'sidebar-cache-health-check',
    timezone: 'UTC'
  });
  
  // Stats report - every 5 minutes
  cron.schedule('*/5 * * * *', printStats, {
    name: 'sidebar-cache-stats',
    timezone: 'UTC'
  });
  
  // Initial refresh
  setTimeout(refreshSidebarCache, 5000); // Wait 5 seconds after startup
  
  console.log('[AutoRefresh] ✅ Auto-refresh jobs scheduled successfully');
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[AutoRefresh] 🛑 Received SIGTERM, shutting down gracefully...');
  cron.getTasks().forEach(task => task.stop());
  pool.end();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[AutoRefresh] 🛑 Received SIGINT, shutting down gracefully...');
  cron.getTasks().forEach(task => task.stop());
  pool.end();
  process.exit(0);
});

// Error handling
process.on('unhandledRejection', (reason, promise) => {
  console.error('[AutoRefresh] Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('[AutoRefresh] Uncaught Exception:', error);
  process.exit(1);
});

// API to get stats (if running as module)
function getRefreshStats() {
  return {
    ...refreshStats,
    uptime: process.uptime(),
    activeTasks: cron.getTasks().size
  };
}

// Export for use as module
module.exports = {
  setupAutoRefresh,
  getRefreshStats,
  refreshSidebarCache
};

// Run if called directly
if (require.main === module) {
  setupAutoRefresh();
}