-- ======================================================================
-- Remove person_picture Column from sidebar_device_cache
-- 
-- Purpose: Remove references to person_picture column that doesn't exist
-- Issue: sidebar_device_cache references non-existent person_picture column
-- Solution: Exclude person_picture from materialized view for now
-- ======================================================================

-- Drop the existing materialized view if it exists
DROP MATERIALIZED VIEW IF EXISTS sidebar_device_cache CASCADE;

-- Recreate the materialized view WITHOUT person_picture column
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
WHERE uvd.is_active = TRUE;

-- Add the concurrent index for efficient refreshes
CREATE UNIQUE INDEX CONCURRENTLY idx_sidebar_device_cache_unique_device
ON sidebar_device_cache (device_id);

-- Grant appropriate permissions
GRANT SELECT ON sidebar_device_cache TO locator_user;

-- Initial refresh to populate the view
REFRESH MATERIALIZED VIEW sidebar_device_cache;

-- Test the view to make sure it works
DO $$
DECLARE
    test_count INTEGER;
    sample_record RECORD;
BEGIN
    -- Count total records
    SELECT COUNT(*) INTO test_count FROM sidebar_device_cache;
    RAISE NOTICE 'sidebar_device_cache contains % records', test_count;
    
    -- Try to select a sample record without person_picture
    SELECT device_id, device_name, person_name 
    INTO sample_record
    FROM sidebar_device_cache 
    LIMIT 1;
    
    IF FOUND THEN
        RAISE NOTICE 'Sample record: device_id=%, device_name=%, person_name=%', 
            sample_record.device_id, 
            sample_record.device_name, 
            sample_record.person_name;
    ELSE
        RAISE NOTICE 'No records found in sidebar_device_cache';
    END IF;
    
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Error testing sidebar_device_cache: %', SQLERRM;
END $$;

-- Verification: Show the schema of the recreated view
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'sidebar_device_cache'
ORDER BY ordinal_position;

-- Show a few sample records
SELECT 
    device_id, device_name, person_name,
    latitude, longitude, battery_level
FROM sidebar_device_cache 
LIMIT 3;