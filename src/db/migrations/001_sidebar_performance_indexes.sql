-- ======================================================================
-- LocateMe Performance Optimization - Phase 1: Index Optimization
-- 
-- Purpose: Create covering indexes for sidebar device list performance
-- Expected Impact: 40-60% query time reduction
-- Risk Level: Low (CONCURRENTLY creation, no downtime)
-- 
-- FIXES:
-- 1. Added DROP INDEX IF EXISTS to prevent duplicate index errors
-- 2. Removed immutable function issue in partial index
-- 3. Safe for re-running multiple times
-- ======================================================================

-- Drop existing indexes if they exist (for clean re-runs)
DROP INDEX IF EXISTS idx_user_device_access_composite;
DROP INDEX IF EXISTS idx_devices_active_name_covering;
DROP INDEX IF EXISTS idx_positions_device_latest_covering;
DROP INDEX IF EXISTS idx_positions_recent_window;
DROP INDEX IF EXISTS idx_user_visible_devices_pattern;
DROP INDEX IF EXISTS idx_people_name_picture;

-- High-priority composite index for user device access
-- Optimizes: user_device_access lookups in sidebar queries
CREATE INDEX CONCURRENTLY idx_user_device_access_composite
ON user_device_access (user_id, device_id);

-- Covering index for active devices with name ordering
-- Optimizes: devices table scans with name-based ordering
CREATE INDEX CONCURRENTLY idx_devices_active_name_covering
ON devices (is_active, name) 
INCLUDE (id, icon, device_type, person_id, is_primary)
WHERE is_active = true;

-- Covering index for latest positions queries
-- Optimizes: latest_positions view performance with position data
CREATE INDEX CONCURRENTLY idx_positions_device_latest_covering
ON positions (device_id, timestamp DESC)
INCLUDE (latitude, longitude, readable_datetime, battery_level, battery_status)
WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Partial index for recent positions (simplified - removed immutable function issue)
-- Optimizes: latest_positions view for recent data window
CREATE INDEX CONCURRENTLY idx_positions_recent_window
ON positions (device_id, timestamp DESC)
WHERE timestamp > 1704067200000; -- Fixed timestamp instead of NOW() function

-- Optimized index for user visible devices pattern
-- Optimizes: user_visible_devices view performance
CREATE INDEX CONCURRENTLY idx_user_visible_devices_pattern
ON user_device_access (user_id) 
INCLUDE (device_id);

-- People table optimization for sidebar person data
-- Optimizes: person information lookups in sidebar
CREATE INDEX CONCURRENTLY idx_people_name_picture
ON people (id) 
INCLUDE (name, picture);

-- Verification queries to confirm index creation
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes 
WHERE indexname LIKE '%user_device%' 
   OR indexname LIKE '%devices_active%'
   OR indexname LIKE '%positions_device%'
   OR indexname LIKE '%positions_recent%'
   OR indexname LIKE '%visible_devices%'
   OR indexname LIKE '%people_name%'
ORDER BY tablename, indexname;

-- Show index sizes for monitoring
SELECT 
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexname::regclass)) as index_size
FROM pg_indexes 
WHERE indexname LIKE '%user_device%' 
   OR indexname LIKE '%devices_active%'
   OR indexname LIKE '%positions_device%'
   OR indexname LIKE '%positions_recent%'
   OR indexname LIKE '%visible_devices%'
   OR indexname LIKE '%people_name%'
ORDER BY pg_relation_size(indexname::regclass) DESC;