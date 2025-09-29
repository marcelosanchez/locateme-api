-- ======================================================================
-- Smart Cache Triggers - Auto Refresh Without External Processes
-- 
-- Purpose: Automatically refresh sidebar cache when data changes
-- Method: PostgreSQL native triggers + smart refresh logic
-- Memory: Zero overhead, uses existing database connections
-- ======================================================================

-- Drop existing triggers and functions
DROP TRIGGER IF EXISTS trigger_refresh_sidebar_on_device_change ON devices;
DROP TRIGGER IF EXISTS trigger_refresh_sidebar_on_position_change ON positions;  
DROP TRIGGER IF EXISTS trigger_refresh_sidebar_on_people_change ON people;
DROP FUNCTION IF EXISTS smart_refresh_sidebar_cache();
DROP FUNCTION IF EXISTS is_cache_refresh_needed();

-- Create a simple flag table to prevent multiple concurrent refreshes
CREATE TABLE IF NOT EXISTS cache_refresh_locks (
    table_name VARCHAR(50) PRIMARY KEY,
    locked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    locked_by TEXT DEFAULT 'system'
);

-- Function to check if refresh is needed (avoid unnecessary work)
CREATE OR REPLACE FUNCTION is_cache_refresh_needed()
RETURNS BOOLEAN AS $$
DECLARE
    cache_age_seconds DOUBLE PRECISION;
    last_lock TIMESTAMP WITH TIME ZONE;
    lock_age_seconds DOUBLE PRECISION;
BEGIN
    -- Check cache age
    SELECT 
        EXTRACT(EPOCH FROM (NOW() - MAX(cache_updated_at)))
    INTO cache_age_seconds
    FROM sidebar_device_cache;
    
    -- If no cache exists, refresh needed
    IF cache_age_seconds IS NULL THEN
        RETURN TRUE;
    END IF;
    
    -- Check if there's a recent lock (prevent refresh spam)
    SELECT locked_at INTO last_lock
    FROM cache_refresh_locks 
    WHERE table_name = 'sidebar_device_cache';
    
    IF last_lock IS NOT NULL THEN
        lock_age_seconds := EXTRACT(EPOCH FROM (NOW() - last_lock));
        -- If locked within last 30 seconds, skip refresh
        IF lock_age_seconds < 30 THEN
            RETURN FALSE;
        END IF;
    END IF;
    
    -- Refresh needed if cache older than 5 minutes
    RETURN cache_age_seconds > 300;
END;
$$ LANGUAGE plpgsql;

-- Smart refresh function with locking mechanism
CREATE OR REPLACE FUNCTION smart_refresh_sidebar_cache()
RETURNS VOID AS $$
DECLARE
    refresh_needed BOOLEAN;
BEGIN
    -- Check if refresh is actually needed
    refresh_needed := is_cache_refresh_needed();
    
    IF NOT refresh_needed THEN
        -- Cache is fresh, no work needed
        RETURN;
    END IF;
    
    -- Set lock to prevent concurrent refreshes
    INSERT INTO cache_refresh_locks (table_name, locked_at)
    VALUES ('sidebar_device_cache', NOW())
    ON CONFLICT (table_name) 
    DO UPDATE SET locked_at = NOW();
    
    -- Perform the actual refresh
    REFRESH MATERIALIZED VIEW CONCURRENTLY sidebar_device_cache;
    
    -- Remove lock
    DELETE FROM cache_refresh_locks WHERE table_name = 'sidebar_device_cache';
    
    -- Log success for monitoring
    RAISE NOTICE 'Sidebar cache refreshed automatically';
    
EXCEPTION WHEN OTHERS THEN
    -- Remove lock on error
    DELETE FROM cache_refresh_locks WHERE table_name = 'sidebar_device_cache';
    
    -- Log error but don't fail the original operation
    RAISE WARNING 'Failed to refresh sidebar cache: %', SQLERRM;
END;
$$ LANGUAGE plpgsql;

-- Trigger function for devices table changes
CREATE OR REPLACE FUNCTION trigger_refresh_sidebar_on_device_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Only refresh if device properties that affect sidebar changed
    IF TG_OP = 'INSERT' OR 
       (TG_OP = 'UPDATE' AND (
           OLD.name IS DISTINCT FROM NEW.name OR
           OLD.icon IS DISTINCT FROM NEW.icon OR
           OLD.is_active IS DISTINCT FROM NEW.is_active OR
           OLD.person_id IS DISTINCT FROM NEW.person_id OR
           OLD.is_primary IS DISTINCT FROM NEW.is_primary
       )) OR
       TG_OP = 'DELETE' THEN
        
        -- Perform smart refresh (non-blocking)
        PERFORM smart_refresh_sidebar_cache();
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger function for people table changes  
CREATE OR REPLACE FUNCTION trigger_refresh_sidebar_on_people_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Only refresh if person name changed (affects sidebar display)
    IF TG_OP = 'INSERT' OR 
       (TG_OP = 'UPDATE' AND OLD.name IS DISTINCT FROM NEW.name) OR
       TG_OP = 'DELETE' THEN
        
        -- Perform smart refresh (non-blocking)
        PERFORM smart_refresh_sidebar_cache();
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger function for positions table (only for latest position changes)
CREATE OR REPLACE FUNCTION trigger_refresh_sidebar_on_position_change()
RETURNS TRIGGER AS $$
DECLARE
    is_latest_position BOOLEAN := FALSE;
BEGIN
    -- Only refresh if this is the latest position for a device
    -- Check if there's no newer position for this device
    SELECT NOT EXISTS(
        SELECT 1 FROM positions 
        WHERE device_id = NEW.device_id 
        AND timestamp > NEW.timestamp
    ) INTO is_latest_position;
    
    -- Only refresh for latest positions (to avoid spam on bulk inserts)
    IF is_latest_position THEN
        PERFORM smart_refresh_sidebar_cache();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
CREATE TRIGGER trigger_refresh_sidebar_on_device_change
    AFTER INSERT OR UPDATE OR DELETE ON devices
    FOR EACH ROW 
    EXECUTE FUNCTION trigger_refresh_sidebar_on_device_change();

CREATE TRIGGER trigger_refresh_sidebar_on_people_change
    AFTER INSERT OR UPDATE OR DELETE ON people
    FOR EACH ROW 
    EXECUTE FUNCTION trigger_refresh_sidebar_on_people_change();

CREATE TRIGGER trigger_refresh_sidebar_on_position_change
    AFTER INSERT ON positions
    FOR EACH ROW 
    EXECUTE FUNCTION trigger_refresh_sidebar_on_position_change();

-- Index for efficient lock checking
CREATE INDEX IF NOT EXISTS idx_cache_refresh_locks_table_time 
ON cache_refresh_locks (table_name, locked_at);

-- Cleanup old locks (in case of system crashes)
DELETE FROM cache_refresh_locks 
WHERE locked_at < NOW() - INTERVAL '1 hour';

-- Initial cache refresh to ensure it's populated
SELECT smart_refresh_sidebar_cache();

-- Verification queries
SELECT 
    'smart_cache_triggers_setup' as setup_complete,
    COUNT(*) as cache_rows,
    MAX(cache_updated_at) as last_cache_update
FROM sidebar_device_cache;

-- Show created triggers
SELECT 
    trigger_name,
    event_object_table as table_name,
    event_manipulation
FROM information_schema.triggers 
WHERE trigger_name LIKE '%refresh_sidebar%'
ORDER BY event_object_table, trigger_name;