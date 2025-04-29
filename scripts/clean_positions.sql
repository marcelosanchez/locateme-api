DELETE FROM positions
WHERE created_at < NOW() - INTERVAL '3 months';
