-- ======================================================================
-- LocateMe Performance Optimization - Phase 1: Index Optimization
-- 
-- Purpose: Create covering indexes for sidebar device list performance
-- Expected Impact: 40-60% query time reduction
-- Risk Level: Low (CONCURRENTLY creation, no downtime)
-- ======================================================================

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

-- Partial index for recent positions (last 7 days optimization)
-- Optimizes: latest_positions view for recent data window
CREATE INDEX CONCURRENTLY idx_positions_recent_window
ON positions (device_id, timestamp DESC)
WHERE timestamp > (EXTRACT(epoch FROM NOW() - INTERVAL '7 days') * 1000);

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

-- Log successful index creation
INSERT INTO pg_stat_activity_log (message, created_at)
SELECT 'Phase 1 sidebar performance indexes created successfully', NOW()
WHERE EXISTS (SELECT 1 FROM pg_class WHERE relname = 'pg_stat_activity_log');

-- Verification queries to confirm index creation
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes 
WHERE indexname LIKE '%sidebar%' 
   OR indexname LIKE '%device%' 
   OR indexname LIKE '%position%'
   OR indexname LIKE '%user_device%'
ORDER BY tablename, indexname;