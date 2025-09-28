-- ======================================================================
-- LocateMe Performance Optimization - Phase 2B: Materialized View
-- 
-- Purpose: Create high-performance materialized view for sidebar queries
-- Expected Impact: 50-70% query time reduction for sidebar endpoints
-- Risk Level: Medium (new materialized view with refresh strategy)
-- ======================================================================

-- Create materialized view for high-performance sidebar queries
-- CRITICAL: Maintain exact field names and data types for frontend compatibility
CREATE MATERIALIZED VIEW sidebar_device_cache AS
SELECT 
  uvd.user_id,
  uvd.id AS device_id,                    -- Frontend expects: device_id (string)
  uvd.name AS device_name,                -- Frontend expects: device_name (string)
  uvd.icon AS device_icon,                -- Frontend expects: device_icon (string)
  uvd.device_type,
  uvd.is_primary,
  uvd.person_id,
  p.name AS person_name,                  -- Frontend expects: person_name (string)
  p.picture AS person_picture,            -- Frontend expects: person_picture (string)
  -- CRITICAL: Convert numeric lat/lng to strings for TypeScript compatibility
  CASE 
    WHEN lp.latitude IS NOT NULL THEN lp.latitude::text 
    ELSE NULL 
  END AS latitude,                        -- Frontend expects: latitude (string)
  CASE 
    WHEN lp.longitude IS NOT NULL THEN lp.longitude::text 
    ELSE NULL 
  END AS longitude,                       -- Frontend expects: longitude (string)
  lp.readable_datetime,                   -- Frontend expects: readable_datetime (string)
  lp.battery_level,                       -- Frontend expects: battery_level (number)
  lp.battery_status,                      -- Frontend expects: battery_status (string)
  NOW() as cache_updated_at
FROM user_visible_devices uvd
LEFT JOIN people p ON p.id = uvd.person_id
LEFT JOIN latest_positions lp ON uvd.id = lp.device_id;

-- Create unique index for fast lookups
CREATE UNIQUE INDEX idx_sidebar_cache_device_id 
ON sidebar_device_cache (device_id);

-- Create composite index for user-specific queries
CREATE INDEX idx_sidebar_cache_user_device
ON sidebar_device_cache (user_id, device_id);

-- Create index for name-based ordering
CREATE INDEX idx_sidebar_cache_name 
ON sidebar_device_cache (device_name);

-- Create index for person-based grouping (frontend groups by person)
CREATE INDEX idx_sidebar_cache_person
ON sidebar_device_cache (person_id, person_name);

-- Grant permissions
GRANT SELECT ON sidebar_device_cache TO locator_user;

-- Create refresh log table with performance tracking
CREATE TABLE IF NOT EXISTS materialized_view_refresh_log (
  id SERIAL PRIMARY KEY,
  view_name TEXT NOT NULL,
  refreshed_at TIMESTAMP DEFAULT NOW(),
  duration_ms NUMERIC,
  rows_affected INTEGER
);

-- Grant permissions on log table
GRANT SELECT,INSERT ON materialized_view_refresh_log TO locator_user;
GRANT USAGE ON SEQUENCE materialized_view_refresh_log_id_seq TO locator_user;

-- Log successful materialized view creation
INSERT INTO materialized_view_refresh_log (view_name, refreshed_at, rows_affected)
SELECT 'sidebar_device_cache', NOW(), COUNT(*)
FROM sidebar_device_cache;

-- Verification query to test materialized view
SELECT 
  COUNT(*) as total_devices,
  COUNT(DISTINCT user_id) as total_users,
  COUNT(CASE WHEN latitude IS NOT NULL THEN 1 END) as devices_with_position
FROM sidebar_device_cache;