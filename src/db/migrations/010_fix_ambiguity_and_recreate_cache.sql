-- ======================================================================
-- Fix Column Ambiguity and Recreate sidebar_device_cache
-- 
-- Purpose: Fix the ambiguous column reference and recreate materialized view
-- Issue: Column "id" is ambiguous in the test query, sidebar_device_cache was dropped
-- Solution: Use qualified column names and recreate the materialized view
-- ======================================================================

-- First, recreate the sidebar_device_cache materialized view that was dropped
CREATE MATERIALIZED VIEW sidebar_device_cache AS
SELECT DISTINCT ON (uvd.id)
  uvd.user_id,
  uvd.id AS device_id,                    -- Frontend expects: device_id (string)
  uvd.name AS device_name,                -- Frontend expects: device_name (string)
  uvd.icon AS device_icon,                -- Frontend expects: device_icon (string)
  uvd.device_type,
  uvd.is_primary,
  uvd.person_id,
  p.name AS person_name,                  -- Frontend expects: person_name (string)
  -- NOTE: person_picture column removed temporarily - will be added later
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
  NOW() AS cache_updated_at               -- For cache freshness tracking
FROM user_visible_devices uvd
LEFT JOIN people p ON p.id = uvd.person_id
LEFT JOIN latest_positions lp ON uvd.id = lp.device_id
WHERE uvd.is_active = TRUE
ORDER BY uvd.id, uvd.user_id;  -- Order for DISTINCT ON

-- Create the unique index
CREATE UNIQUE INDEX CONCURRENTLY idx_sidebar_device_cache_unique_device
ON sidebar_device_cache (device_id);

-- Also add index for cache freshness queries
CREATE INDEX CONCURRENTLY idx_sidebar_device_cache_updated_at
ON sidebar_device_cache (cache_updated_at);

-- Grant permissions
GRANT SELECT ON sidebar_device_cache TO locator_user;

-- Initial refresh to populate the view
REFRESH MATERIALIZED VIEW sidebar_device_cache;

-- Test the corrected views with qualified column names
DO $$
DECLARE
    staff_device_count INTEGER;
    regular_device_count INTEGER;
    total_active_devices INTEGER;
    cache_device_count INTEGER;
BEGIN
    -- Count devices visible to staff users (using qualified column names)
    SELECT COUNT(DISTINCT uvd.id) INTO staff_device_count
    FROM user_visible_devices uvd
    JOIN users u ON uvd.user_id = u.id
    WHERE u.is_staff = true;
    
    -- Count devices visible to regular users  
    SELECT COUNT(DISTINCT uvd.id) INTO regular_device_count
    FROM user_visible_devices uvd
    JOIN users u ON uvd.user_id = u.id
    WHERE u.is_staff = false;
    
    -- Count total active devices
    SELECT COUNT(*) INTO total_active_devices
    FROM devices 
    WHERE is_active = true;
    
    -- Count devices in sidebar cache
    SELECT COUNT(*) INTO cache_device_count
    FROM sidebar_device_cache;
    
    RAISE NOTICE 'Total active devices: %', total_active_devices;
    RAISE NOTICE 'Devices visible to staff users: %', staff_device_count;
    RAISE NOTICE 'Devices visible to regular users: %', regular_device_count;
    RAISE NOTICE 'Devices in sidebar cache: %', cache_device_count;
    
    IF staff_device_count = total_active_devices THEN
        RAISE NOTICE '✅ Staff users can see all active devices';
    ELSE
        RAISE WARNING '❌ Staff users missing % devices', (total_active_devices - staff_device_count);
    END IF;
    
    IF cache_device_count >= total_active_devices THEN
        RAISE NOTICE '✅ Sidebar cache includes all devices (may have duplicates for multi-user access)';
    ELSE
        RAISE WARNING '❌ Sidebar cache missing devices';
    END IF;
    
END $$;

-- Show sample data for verification
SELECT 
    u.email,
    u.is_staff,
    COUNT(uvd.id) as visible_device_count
FROM users u
LEFT JOIN user_visible_devices uvd ON u.id = uvd.user_id
GROUP BY u.id, u.email, u.is_staff
ORDER BY u.is_staff DESC, u.email;

-- Show devices now in sidebar cache
SELECT 
    COUNT(*) as total_cache_records,
    COUNT(DISTINCT device_id) as unique_devices,
    STRING_AGG(DISTINCT device_name, ', ') FILTER (WHERE device_name ILIKE '%marcelo%' OR device_name ILIKE '%raquel%' OR device_name ILIKE '%sara%' OR device_name ILIKE '%mariu%') as important_devices_found
FROM sidebar_device_cache;