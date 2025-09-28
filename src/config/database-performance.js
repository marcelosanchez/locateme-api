/**
 * LocateMe Database Performance Configuration
 * 
 * Optimized connection pool and session settings for sidebar performance
 */

const { Pool } = require('pg');

// Performance-optimized pool configuration
const createOptimizedPool = (config = {}) => {
  const poolConfig = {
    // Connection pool optimization
    min: 5,                    // Minimum connections to maintain
    max: 20,                   // Maximum connections for sidebar workload
    idleTimeoutMillis: 30000,  // Close idle connections after 30s
    connectionTimeoutMillis: 5000,  // Connection timeout
    
    // Statement timeout to prevent runaway queries
    statement_timeout: 10000,  // 10s statement timeout
    
    // Query timeout for individual queries
    query_timeout: 8000,       // 8s query timeout
    
    // Connection keepalive
    keepAlive: true,
    keepAliveInitialDelayMillis: 0,
    
    // Override with provided config
    ...config
  };

  const pool = new Pool(poolConfig);

  // Add connection event monitoring
  pool.on('connect', (client) => {
    console.log(`[DB] New client connected (total: ${pool.totalCount})`);
    
    // Set session-level optimizations for sidebar queries
    client.query(`
      SET work_mem = '16MB';
      SET random_page_cost = 1.1;
      SET effective_cache_size = '2GB';
      SET enable_seqscan = on;
      SET enable_indexscan = on;
      SET enable_bitmapscan = on;
    `).catch(err => {
      console.warn('[DB] Failed to set session optimizations:', err.message);
    });
  });

  pool.on('error', (err, client) => {
    console.error('[DB] Unexpected error on idle client', err);
  });

  pool.on('acquire', (client) => {
    console.debug('[DB] Client acquired from pool');
  });

  pool.on('remove', (client) => {
    console.debug('[DB] Client removed from pool');
  });

  return pool;
};

// Prepared statement cache for frequent queries
class PreparedStatementCache {
  constructor(pool) {
    this.pool = pool;
    this.cache = new Map();
  }

  async prepare(name, text) {
    if (!this.cache.has(name)) {
      try {
        await this.pool.query(`PREPARE ${name} AS ${text}`);
        this.cache.set(name, { text, prepared: true });
        console.log(`[DB] Prepared statement cached: ${name}`);
      } catch (error) {
        console.error(`[DB] Failed to prepare statement ${name}:`, error);
        throw error;
      }
    }
    return name;
  }

  async execute(name, values = []) {
    if (!this.cache.has(name)) {
      throw new Error(`Prepared statement not found: ${name}`);
    }
    
    try {
      return await this.pool.query(`EXECUTE ${name}${values.length ? `(${values.map((_, i) => `$${i + 1}`).join(',')})` : ''}`, values);
    } catch (error) {
      console.error(`[DB] Failed to execute prepared statement ${name}:`, error);
      throw error;
    }
  }

  getStats() {
    return {
      cachedStatements: this.cache.size,
      statements: Array.from(this.cache.keys())
    };
  }
}

// Database performance monitoring
class PerformanceMonitor {
  constructor(pool) {
    this.pool = pool;
    this.metrics = {
      totalQueries: 0,
      slowQueries: 0,
      errorQueries: 0,
      averageResponseTime: 0,
      connectionPoolStats: {}
    };
    
    this.slowQueryThreshold = 1000; // 1 second
  }

  async executeWithMonitoring(query, values = []) {
    const startTime = Date.now();
    this.metrics.totalQueries++;

    try {
      const result = await this.pool.query(query, values);
      const duration = Date.now() - startTime;
      
      // Update average response time
      this.metrics.averageResponseTime = 
        (this.metrics.averageResponseTime * (this.metrics.totalQueries - 1) + duration) / this.metrics.totalQueries;
      
      // Track slow queries
      if (duration > this.slowQueryThreshold) {
        this.metrics.slowQueries++;
        console.warn(`[DB] Slow query detected (${duration}ms):`, query.substring(0, 100));
      }
      
      return result;
    } catch (error) {
      this.metrics.errorQueries++;
      console.error('[DB] Query error:', error);
      throw error;
    }
  }

  getPoolStats() {
    return {
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount
    };
  }

  getMetrics() {
    return {
      ...this.metrics,
      connectionPoolStats: this.getPoolStats(),
      errorRate: this.metrics.totalQueries > 0 ? (this.metrics.errorQueries / this.metrics.totalQueries * 100) : 0,
      slowQueryRate: this.metrics.totalQueries > 0 ? (this.metrics.slowQueries / this.metrics.totalQueries * 100) : 0
    };
  }

  reset() {
    this.metrics = {
      totalQueries: 0,
      slowQueries: 0,
      errorQueries: 0,
      averageResponseTime: 0,
      connectionPoolStats: {}
    };
  }
}

// Sidebar-specific performance optimizations
const sidebarOptimizations = {
  // Common prepared statements for sidebar queries
  SIDEBAR_USER_DEVICES: 'sidebar_user_devices',
  SIDEBAR_STAFF_DEVICES: 'sidebar_staff_devices',
  SIDEBAR_CACHE_FRESHNESS: 'sidebar_cache_freshness',
  
  // SQL templates
  sqlTemplates: {
    sidebarUserDevices: `
      SELECT 
        sdc.device_id, sdc.device_name, sdc.device_icon, sdc.device_type,
        sdc.is_primary, sdc.person_id, sdc.person_name, sdc.person_picture,
        sdc.latitude, sdc.longitude, sdc.readable_datetime,
        sdc.battery_level, sdc.battery_status
      FROM user_device_access uda
      JOIN sidebar_device_cache sdc ON uda.device_id = sdc.device_id
      WHERE uda.user_id = $1
      ORDER BY sdc.device_name
    `,
    
    sidebarStaffDevices: `
      SELECT 
        device_id, device_name, device_icon, device_type, is_primary,
        person_id, person_name, person_picture,
        latitude, longitude, readable_datetime, battery_level, battery_status
      FROM sidebar_device_cache
      ORDER BY device_name
      LIMIT 1000
    `,
    
    cacheFreshness: `
      SELECT 
        EXTRACT(epoch FROM (NOW() - cache_updated_at)) as cache_age_seconds,
        cache_updated_at,
        COUNT(*) as rows_count
      FROM sidebar_device_cache
      GROUP BY cache_updated_at
      ORDER BY cache_updated_at DESC
      LIMIT 1
    `
  }
};

module.exports = {
  createOptimizedPool,
  PreparedStatementCache,
  PerformanceMonitor,
  sidebarOptimizations
};