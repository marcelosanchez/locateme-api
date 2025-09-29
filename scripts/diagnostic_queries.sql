-- ======================================================================
-- DIAGNOSTIC QUERIES - Missing Devices Investigation
-- Execute these queries to understand why devices are not showing
-- ======================================================================

\echo '=== 1. CHECKING SIDEBAR_DEVICE_CACHE STATUS ==='
SELECT 
    'sidebar_device_cache' as table_name,
    COUNT(*) as total_records,
    MIN(cache_updated_at) as oldest_cache,
    MAX(cache_updated_at) as newest_cache
FROM sidebar_device_cache;

\echo ''
\echo '=== 2. DEVICES IN SIDEBAR_DEVICE_CACHE ==='
SELECT 
    device_id, 
    device_name, 
    person_name,
    CASE 
        WHEN latitude IS NOT NULL AND longitude IS NOT NULL THEN 'HAS_POSITION'
        ELSE 'NO_POSITION'
    END as position_status,
    cache_updated_at
FROM sidebar_device_cache 
ORDER BY device_name
LIMIT 10;

\echo ''
\echo '=== 3. CHECKING USER_VISIBLE_DEVICES ==='
SELECT 
    'user_visible_devices' as table_name,
    COUNT(*) as total_records
FROM user_visible_devices;

\echo ''
\echo '=== 4. SAMPLE FROM USER_VISIBLE_DEVICES ==='
SELECT 
    id as device_id, 
    name as device_name, 
    user_id,
    is_active,
    person_id
FROM user_visible_devices 
WHERE is_active = true
ORDER BY name
LIMIT 10;

\echo ''
\echo '=== 5. CHECKING LATEST_POSITIONS ==='
SELECT 
    'latest_positions' as table_name,
    COUNT(*) as total_records,
    COUNT(CASE WHEN latitude IS NOT NULL THEN 1 END) as records_with_position
FROM latest_positions;

\echo ''
\echo '=== 6. DEVICES WITH RECENT POSITIONS ==='
SELECT 
    lp.device_id,
    d.name as device_name,
    lp.readable_datetime,
    CASE 
        WHEN lp.latitude IS NOT NULL AND lp.longitude IS NOT NULL THEN 'HAS_COORDS'
        ELSE 'NO_COORDS'
    END as coords_status,
    EXTRACT(EPOCH FROM (NOW() - lp.timestamp)) / 3600 as hours_ago
FROM latest_positions lp
JOIN devices d ON lp.device_id = d.id
WHERE d.is_active = true
ORDER BY lp.timestamp DESC
LIMIT 10;

\echo ''
\echo '=== 7. MISSING DEVICES ANALYSIS ==='
-- Devices that exist but are NOT in sidebar_device_cache
SELECT 
    d.id as device_id,
    d.name as device_name,
    d.is_active,
    CASE 
        WHEN uvd.id IS NOT NULL THEN 'IN_USER_VISIBLE'
        ELSE 'NOT_IN_USER_VISIBLE'
    END as visibility_status,
    CASE 
        WHEN sdc.device_id IS NOT NULL THEN 'IN_SIDEBAR_CACHE'
        ELSE 'NOT_IN_SIDEBAR_CACHE'
    END as cache_status
FROM devices d
LEFT JOIN user_visible_devices uvd ON d.id = uvd.id
LEFT JOIN sidebar_device_cache sdc ON d.id = sdc.device_id
WHERE d.is_active = true
  AND d.name ILIKE ANY(ARRAY['%sara%', '%marcelo%', '%raquel%', '%fabiola%', '%isidro%'])
ORDER BY d.name;

\echo ''
\echo '=== 8. CHECKING MATERIALIZED VIEW DEFINITION ==='
SELECT 
    schemaname,
    matviewname,
    hasindexes,
    ispopulated
FROM pg_matviews 
WHERE matviewname = 'sidebar_device_cache';

\echo ''
\echo '=== 9. RECENT CACHE REFRESH ATTEMPTS ==='
-- Check if there are any refresh locks
SELECT * FROM cache_refresh_locks WHERE table_name = 'sidebar_device_cache';

\echo ''
\echo '=== 10. PERFORMANCE CHECK ==='
-- Check if the materialized view needs refresh
SELECT 
    EXTRACT(EPOCH FROM (NOW() - MAX(cache_updated_at))) / 60 as minutes_since_cache_update
FROM sidebar_device_cache;