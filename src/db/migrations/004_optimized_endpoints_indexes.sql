-- ======================================================================
-- LocateMe Optimized Endpoints - Database Indexes
-- 
-- Purpose: Create specialized indexes for new optimized endpoints
-- Expected Impact: 50-80% query time reduction for endpoint-specific queries
-- Risk Level: Low (CONCURRENTLY creation, no downtime)
-- ======================================================================

-- Drop existing indexes if they exist (for clean re-runs)
DROP INDEX IF EXISTS idx_sidebar_names_only;
DROP INDEX IF EXISTS idx_sidebar_positions_only;
DROP INDEX IF EXISTS idx_single_device_position;
DROP INDEX IF EXISTS idx_device_route_time;
DROP INDEX IF EXISTS idx_batch_positions_filter;
DROP INDEX IF EXISTS idx_device_route_recent;
DROP INDEX IF EXISTS idx_batch_user_device_access;
DROP INDEX IF EXISTS idx_devices_active_status;
DROP INDEX IF EXISTS idx_sidebar_cache_freshness;

-- =============================================================================
-- SIDEBAR OPTIMIZATION INDEXES
-- =============================================================================

-- Covering index for sidebar device names (no positions needed)
-- Optimizes: /sidebar/device-names endpoint
CREATE INDEX CONCURRENTLY idx_sidebar_names_only
ON sidebar_device_cache (device_name) 
INCLUDE (device_id, device_icon, device_type, person_name, is_primary)
WHERE device_name IS NOT NULL;

-- Covering index for sidebar with positions (map use)
-- Optimizes: /map/device-positions endpoint
CREATE INDEX CONCURRENTLY idx_sidebar_positions_only
ON sidebar_device_cache (device_name) 
INCLUDE (device_id, device_icon, device_type, latitude, longitude, readable_datetime, battery_level, battery_status, person_name, is_primary)
WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- =============================================================================
-- SINGLE DEVICE OPTIMIZATION INDEXES
-- =============================================================================

-- Optimized index for single device position lookups
-- Optimizes: /devices/:id/position endpoint (real-time queries)
CREATE INDEX CONCURRENTLY idx_single_device_position
ON positions (device_id, timestamp DESC) 
INCLUDE (latitude, longitude, readable_datetime, battery_level, battery_status, horizontal_accuracy, altitude)
WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- =============================================================================
-- DEVICE ROUTE OPTIMIZATION INDEXES
-- =============================================================================

-- Time-based index for device route queries
-- Optimizes: /devices/:id/route endpoint
CREATE INDEX CONCURRENTLY idx_device_route_time
ON positions (device_id, timestamp DESC)
INCLUDE (latitude, longitude, readable_datetime, horizontal_accuracy, battery_level)
WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Partial index for recent positions (last 48 hours for route queries)
-- Optimizes: Route queries with time filtering
CREATE INDEX CONCURRENTLY idx_device_route_recent
ON positions (device_id, timestamp DESC)
INCLUDE (latitude, longitude, readable_datetime, horizontal_accuracy, battery_level)
WHERE latitude IS NOT NULL 
  AND longitude IS NOT NULL;

-- =============================================================================
-- BATCH OPERATIONS OPTIMIZATION INDEXES
-- =============================================================================

-- Composite index for user device access with batch filtering
-- Optimizes: Batch position queries with user filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_batch_user_device_access
ON user_device_access (user_id, device_id)
INCLUDE (device_id);

-- Covering index for devices table with active status
-- Optimizes: Device validation queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_devices_active_status
ON devices (id, is_active) 
INCLUDE (name, icon, device_type, person_id, is_primary)
WHERE is_active = true;

-- =============================================================================
-- PERFORMANCE MONITORING INDEXES
-- =============================================================================

-- Index for cache freshness monitoring
-- Optimizes: Cache age and freshness checks
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sidebar_cache_freshness
ON sidebar_device_cache (cache_updated_at DESC)
INCLUDE (device_id);

-- =============================================================================
-- QUERY PERFORMANCE VERIFICATION
-- =============================================================================

-- Test queries to verify index effectiveness
SELECT 
    'sidebar_names_test' as test_name,
    device_id,
    device_name
FROM sidebar_device_cache 
WHERE device_name IS NOT NULL
ORDER BY device_name
LIMIT 5;

SELECT 
    'map_positions_test' as test_name,
    device_id,
    device_name,
    latitude,
    longitude
FROM sidebar_device_cache 
WHERE latitude IS NOT NULL 
  AND longitude IS NOT NULL
ORDER BY device_name
LIMIT 5;

-- Display created indexes for verification
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes 
WHERE indexname LIKE '%sidebar%' 
   OR indexname LIKE '%device_route%'
   OR indexname LIKE '%batch_%'
   OR indexname LIKE '%single_device%'
ORDER BY tablename, indexname;

-- Show index sizes for monitoring
SELECT 
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexname::regclass)) as index_size
FROM pg_indexes 
WHERE indexname LIKE '%sidebar%' 
   OR indexname LIKE '%device_route%'
   OR indexname LIKE '%batch_%'
   OR indexname LIKE '%single_device%'
ORDER BY pg_relation_size(indexname::regclass) DESC;

-- Performance analysis for the new indexes
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF) 
SELECT device_id, device_name, device_icon, person_name
FROM sidebar_device_cache 
WHERE device_name IS NOT NULL
ORDER BY device_name
LIMIT 10;