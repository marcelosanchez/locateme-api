-- ======================================================================
-- LocateMe Performance Optimization - Materialized View Refresh Strategy
-- 
-- Purpose: Automated refresh strategy for sidebar_device_cache
-- Refresh Interval: 30 seconds (balances performance vs freshness)
-- Frontend Impact: Compatible with 15s map polling and cached sidebar data
-- ======================================================================

-- Function for incremental materialized view refresh
-- CONSTRAINT: Keep refresh interval at 30s for now to balance performance vs freshness
CREATE OR REPLACE FUNCTION refresh_sidebar_cache()
RETURNS TABLE(
    duration_ms NUMERIC,
    rows_affected INTEGER,
    success BOOLEAN,
    error_message TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
    start_time TIMESTAMP;
    end_time TIMESTAMP;
    duration NUMERIC;
    row_count INTEGER;
    error_msg TEXT;
BEGIN
    start_time := clock_timestamp();
    error_msg := NULL;
    
    BEGIN
        -- Use CONCURRENTLY to avoid locking during refresh
        REFRESH MATERIALIZED VIEW CONCURRENTLY sidebar_device_cache;
        
        end_time := clock_timestamp();
        duration := EXTRACT(epoch FROM (end_time - start_time)) * 1000;
        
        -- Get row count from materialized view
        SELECT COUNT(*) INTO row_count FROM sidebar_device_cache;
        
        -- Log refresh activity for monitoring
        INSERT INTO materialized_view_refresh_log (view_name, refreshed_at, duration_ms, rows_affected)
        VALUES ('sidebar_device_cache', start_time, duration, row_count);
        
        RETURN QUERY SELECT duration, row_count, true, error_msg;
        
    EXCEPTION WHEN OTHERS THEN
        end_time := clock_timestamp();
        duration := EXTRACT(epoch FROM (end_time - start_time)) * 1000;
        error_msg := SQLERRM;
        
        -- Log error
        INSERT INTO materialized_view_refresh_log (view_name, refreshed_at, duration_ms, rows_affected)
        VALUES ('sidebar_device_cache_error', start_time, duration, 0);
        
        RETURN QUERY SELECT duration, 0, false, error_msg;
    END;
END;
$$;

-- Function to check cache freshness
CREATE OR REPLACE FUNCTION get_sidebar_cache_freshness()
RETURNS TABLE(
    cache_age_seconds NUMERIC,
    is_stale BOOLEAN,
    last_refresh TIMESTAMP,
    rows_count INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
    last_refresh_time TIMESTAMP;
    cache_age NUMERIC;
    row_count INTEGER;
BEGIN
    -- Get last successful refresh time
    SELECT refreshed_at INTO last_refresh_time
    FROM materialized_view_refresh_log
    WHERE view_name = 'sidebar_device_cache'
    ORDER BY refreshed_at DESC
    LIMIT 1;
    
    -- Calculate cache age
    cache_age := EXTRACT(epoch FROM (NOW() - COALESCE(last_refresh_time, NOW() - INTERVAL '1 hour')));
    
    -- Get current row count
    SELECT COUNT(*) INTO row_count FROM sidebar_device_cache;
    
    RETURN QUERY SELECT 
        cache_age,
        cache_age > 300, -- Consider stale if older than 5 minutes (300 seconds)
        last_refresh_time,
        row_count;
END;
$$;

-- Function to get refresh statistics
CREATE OR REPLACE FUNCTION get_sidebar_refresh_stats()
RETURNS TABLE(
    avg_duration_ms NUMERIC,
    max_duration_ms NUMERIC,
    refresh_count INTEGER,
    last_24h_refreshes INTEGER,
    success_rate NUMERIC
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        AVG(mvrl.duration_ms)::NUMERIC as avg_duration_ms,
        MAX(mvrl.duration_ms)::NUMERIC as max_duration_ms,
        COUNT(*)::INTEGER as refresh_count,
        COUNT(CASE WHEN mvrl.refreshed_at > NOW() - INTERVAL '24 hours' THEN 1 END)::INTEGER as last_24h_refreshes,
        (COUNT(CASE WHEN mvrl.view_name = 'sidebar_device_cache' THEN 1 END)::NUMERIC / 
         NULLIF(COUNT(*)::NUMERIC, 0) * 100)::NUMERIC as success_rate
    FROM materialized_view_refresh_log mvrl
    WHERE mvrl.view_name IN ('sidebar_device_cache', 'sidebar_device_cache_error')
    AND mvrl.refreshed_at > NOW() - INTERVAL '7 days';
END;
$$;

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION refresh_sidebar_cache() TO locator_user;
GRANT EXECUTE ON FUNCTION get_sidebar_cache_freshness() TO locator_user;
GRANT EXECUTE ON FUNCTION get_sidebar_refresh_stats() TO locator_user;

-- Initial refresh to populate the materialized view
SELECT refresh_sidebar_cache();

-- Test freshness function
SELECT * FROM get_sidebar_cache_freshness();