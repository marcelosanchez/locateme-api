-- ======================================================================
-- Fix user_visible_devices View - Include ALL devices for staff users
-- 
-- Purpose: Fix the user_visible_devices view to show all active devices to staff users
-- Issue: Staff users can't see devices without explicit user_device_access permissions
-- Solution: UNION staff users seeing all devices + regular users seeing permitted devices
-- ======================================================================

-- Drop the existing view
DROP VIEW IF EXISTS user_visible_devices CASCADE;

-- Create the corrected view that handles staff users properly
CREATE VIEW user_visible_devices AS
-- For staff users: Show ALL active devices with each staff user_id
SELECT 
    u.id as user_id,
    d.id,
    d.name,
    d.icon,
    d.device_type,
    d.person_id,
    d.is_primary,
    d.created_at,
    d.updated_at,
    d.is_active,
    d.model,
    d.manufacturer,
    d.os_type
FROM users u
CROSS JOIN devices d
WHERE u.is_staff = true 
  AND d.is_active = true

UNION ALL

-- For regular users: Show only devices with explicit permissions
SELECT 
    uda.user_id,
    d.id,
    d.name,
    d.icon,
    d.device_type,
    d.person_id,
    d.is_primary,
    d.created_at,
    d.updated_at,
    d.is_active,
    d.model,
    d.manufacturer,
    d.os_type
FROM user_device_access uda
JOIN devices d ON uda.device_id::text = d.id::text
JOIN users u ON uda.user_id = u.id
WHERE d.is_active = true 
  AND u.is_staff = false;

-- Grant permissions
GRANT SELECT ON user_visible_devices TO locator_user;

-- Test the corrected view
DO $$
DECLARE
    staff_device_count INTEGER;
    regular_device_count INTEGER;
    total_active_devices INTEGER;
BEGIN
    -- Count devices visible to staff users
    SELECT COUNT(DISTINCT id) INTO staff_device_count
    FROM user_visible_devices uvd
    JOIN users u ON uvd.user_id = u.id
    WHERE u.is_staff = true;
    
    -- Count devices visible to regular users  
    SELECT COUNT(DISTINCT id) INTO regular_device_count
    FROM user_visible_devices uvd
    JOIN users u ON uvd.user_id = u.id
    WHERE u.is_staff = false;
    
    -- Count total active devices
    SELECT COUNT(*) INTO total_active_devices
    FROM devices 
    WHERE is_active = true;
    
    RAISE NOTICE 'Total active devices: %', total_active_devices;
    RAISE NOTICE 'Devices visible to staff users: %', staff_device_count;
    RAISE NOTICE 'Devices visible to regular users: %', regular_device_count;
    
    IF staff_device_count = total_active_devices THEN
        RAISE NOTICE '✅ Staff users can see all active devices';
    ELSE
        RAISE WARNING '❌ Staff users missing % devices', (total_active_devices - staff_device_count);
    END IF;
    
END $$;

-- Show sample data for verification
SELECT 
    u.email,
    u.is_staff,
    COUNT(uvd.id) as visible_device_count,
    STRING_AGG(CASE WHEN uvd.name ILIKE '%marcelo%' OR uvd.name ILIKE '%raquel%' OR uvd.name ILIKE '%sara%' THEN uvd.name END, ', ') as important_devices
FROM users u
LEFT JOIN user_visible_devices uvd ON u.id = uvd.user_id
GROUP BY u.id, u.email, u.is_staff
ORDER BY u.is_staff DESC, u.email;