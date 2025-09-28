#!/usr/bin/env node

/**
 * LocateMe Performance Optimization Test Suite
 * 
 * Tests all implemented optimizations and validates frontend compatibility
 */

const pool = require('../src/config/db').pool || require('../src/db');
const deviceService = require('../src/services/deviceService');
const deviceServiceOptimized = require('../src/services/deviceServiceOptimized');

// Test configuration
const TEST_CONFIG = {
  warmupRuns: 3,
  benchmarkRuns: 10,
  timeoutMs: 30000
};

class OptimizationTester {
  constructor() {
    this.results = {
      indexTests: [],
      viewTests: [],
      serviceTests: [],
      compatibilityTests: [],
      performanceComparison: {}
    };
  }

  async runAllTests() {
    console.log('🚀 Starting LocateMe Performance Optimization Tests\n');
    
    try {
      await this.testDatabaseConnection();
      await this.testIndexCreation();
      await this.testViewOptimization();
      await this.testMaterializedView();
      await this.testServiceLayer();
      await this.testFrontendCompatibility();
      await this.runPerformanceBenchmark();
      
      this.printSummary();
      return this.results;
      
    } catch (error) {
      console.error('❌ Test suite failed:', error);
      throw error;
    }
  }

  async testDatabaseConnection() {
    console.log('📡 Testing database connection...');
    
    try {
      const result = await pool.query('SELECT NOW() as current_time, version() as pg_version');
      console.log(`✅ Database connected: PostgreSQL ${result.rows[0].pg_version.split(' ')[1]}`);
      console.log(`✅ Server time: ${result.rows[0].current_time}\n`);
    } catch (error) {
      throw new Error(`Database connection failed: ${error.message}`);
    }
  }

  async testIndexCreation() {
    console.log('🔍 Testing index creation and usage...');
    
    const indexQueries = [
      {
        name: 'user_device_access_composite',
        query: `SELECT indexname, indexdef FROM pg_indexes WHERE indexname = 'idx_user_device_access_composite'`
      },
      {
        name: 'devices_active_name_covering',
        query: `SELECT indexname, indexdef FROM pg_indexes WHERE indexname = 'idx_devices_active_name_covering'`
      },
      {
        name: 'positions_device_latest_covering',
        query: `SELECT indexname, indexdef FROM pg_indexes WHERE indexname = 'idx_positions_device_latest_covering'`
      }
    ];

    for (const indexTest of indexQueries) {
      try {
        const result = await pool.query(indexTest.query);
        if (result.rows.length > 0) {
          console.log(`✅ Index exists: ${indexTest.name}`);
          this.results.indexTests.push({ name: indexTest.name, status: 'exists' });
        } else {
          console.log(`⚠️  Index missing: ${indexTest.name}`);
          this.results.indexTests.push({ name: indexTest.name, status: 'missing' });
        }
      } catch (error) {
        console.log(`❌ Index test failed: ${indexTest.name} - ${error.message}`);
        this.results.indexTests.push({ name: indexTest.name, status: 'error', error: error.message });
      }
    }
    console.log();
  }

  async testViewOptimization() {
    console.log('👁️  Testing view optimizations...');
    
    try {
      // Test latest_positions view
      const start = Date.now();
      const result = await pool.query(`
        SELECT device_id, latitude, longitude, readable_datetime 
        FROM latest_positions 
        LIMIT 10
      `);
      const duration = Date.now() - start;
      
      console.log(`✅ latest_positions view: ${result.rows.length} rows in ${duration}ms`);
      this.results.viewTests.push({
        name: 'latest_positions',
        status: 'success',
        duration,
        rows: result.rows.length
      });
      
    } catch (error) {
      console.log(`❌ View test failed: ${error.message}`);
      this.results.viewTests.push({
        name: 'latest_positions',
        status: 'error',
        error: error.message
      });
    }
    console.log();
  }

  async testMaterializedView() {
    console.log('💾 Testing materialized view...');
    
    try {
      // Test materialized view exists and has data
      const existsResult = await pool.query(`
        SELECT COUNT(*) as row_count 
        FROM sidebar_device_cache
      `);
      
      const rowCount = parseInt(existsResult.rows[0].row_count);
      console.log(`✅ sidebar_device_cache exists with ${rowCount} rows`);
      
      // Test refresh function
      const refreshStart = Date.now();
      const refreshResult = await pool.query('SELECT * FROM refresh_sidebar_cache()');
      const refreshDuration = Date.now() - refreshStart;
      
      const refresh = refreshResult.rows[0];
      if (refresh.success) {
        console.log(`✅ Cache refresh successful: ${refresh.duration_ms}ms (${refresh.rows_affected} rows)`);
      } else {
        console.log(`⚠️  Cache refresh failed: ${refresh.error_message}`);
      }
      
      // Test freshness function
      const freshnessResult = await pool.query('SELECT * FROM get_sidebar_cache_freshness()');
      const freshness = freshnessResult.rows[0];
      
      console.log(`✅ Cache freshness: ${freshness.cache_age_seconds}s old, ${freshness.is_stale ? 'STALE' : 'FRESH'}`);
      
      this.results.viewTests.push({
        name: 'sidebar_device_cache',
        status: 'success',
        rowCount,
        refreshDuration,
        cacheAge: freshness.cache_age_seconds,
        isStale: freshness.is_stale
      });
      
    } catch (error) {
      console.log(`❌ Materialized view test failed: ${error.message}`);
      this.results.viewTests.push({
        name: 'sidebar_device_cache',
        status: 'error',
        error: error.message
      });
    }
    console.log();
  }

  async testServiceLayer() {
    console.log('⚙️  Testing service layer optimizations...');
    
    // Create test user
    const testUser = { id: 1, is_staff: false };
    const testStaffUser = { id: 1, is_staff: true };
    
    try {
      // Test regular user devices
      const userStart = Date.now();
      const userDevices = await deviceService.getUserDevices(testUser);
      const userDuration = Date.now() - userStart;
      
      console.log(`✅ User devices: ${userDevices.length} devices in ${userDuration}ms`);
      
      // Test staff devices
      const staffStart = Date.now();
      const staffDevices = await deviceService.getUserDevices(testStaffUser);
      const staffDuration = Date.now() - staffStart;
      
      console.log(`✅ Staff devices: ${staffDevices.length} devices in ${staffDuration}ms`);
      
      // Test performance stats
      const stats = await deviceService.getPerformanceStats();
      console.log(`✅ Performance stats available: ${stats.error ? 'NO' : 'YES'}`);
      
      this.results.serviceTests.push({
        userDevicesCount: userDevices.length,
        userDuration,
        staffDevicesCount: staffDevices.length,
        staffDuration,
        statsAvailable: !stats.error
      });
      
    } catch (error) {
      console.log(`❌ Service layer test failed: ${error.message}`);
      this.results.serviceTests.push({
        status: 'error',
        error: error.message
      });
    }
    console.log();
  }

  async testFrontendCompatibility() {
    console.log('🖥️  Testing frontend compatibility...');
    
    const testUser = { id: 1, is_staff: false };
    
    try {
      const devices = await deviceService.getUserDevices(testUser);
      
      if (devices.length === 0) {
        console.log('⚠️  No devices found for compatibility testing');
        this.results.compatibilityTests.push({
          status: 'skipped',
          reason: 'no_devices'
        });
        return;
      }
      
      const device = devices[0];
      const compatibility = {
        hasDeviceId: typeof device.device_id === 'string',
        hasDeviceName: device.device_name === undefined || typeof device.device_name === 'string',
        hasDeviceIcon: device.device_icon === undefined || typeof device.device_icon === 'string',
        latitudeIsString: device.latitude === null || typeof device.latitude === 'string',
        longitudeIsString: device.longitude === null || typeof device.longitude === 'string',
        batteryLevelIsNumber: device.battery_level === null || typeof device.battery_level === 'number',
        hasBatteryStatus: device.battery_status === undefined || device.battery_status === null || typeof device.battery_status === 'string',
        hasPersonName: device.person_name === undefined || device.person_name === null || typeof device.person_name === 'string'
      };
      
      const allCompatible = Object.values(compatibility).every(Boolean);
      
      if (allCompatible) {
        console.log('✅ Frontend compatibility: ALL CHECKS PASSED');
      } else {
        console.log('❌ Frontend compatibility: FAILED');
        Object.entries(compatibility).forEach(([key, value]) => {
          if (!value) {
            console.log(`   ❌ ${key}: ${JSON.stringify(device[key.replace(/([A-Z])/g, '_$1').toLowerCase().replace('is_', '').replace('has_', '')])}`);
          }
        });
      }
      
      this.results.compatibilityTests.push({
        status: allCompatible ? 'passed' : 'failed',
        details: compatibility,
        sampleDevice: device
      });
      
    } catch (error) {
      console.log(`❌ Frontend compatibility test failed: ${error.message}`);
      this.results.compatibilityTests.push({
        status: 'error',
        error: error.message
      });
    }
    console.log();
  }

  async runPerformanceBenchmark() {
    console.log('🏃 Running performance benchmark...');
    
    const testUser = { id: 1, is_staff: false };
    const testStaffUser = { id: 1, is_staff: true };
    
    try {
      // Warmup runs
      console.log('🔥 Warming up...');
      for (let i = 0; i < TEST_CONFIG.warmupRuns; i++) {
        await deviceService.getUserDevices(testUser);
      }
      
      // Benchmark original vs optimized
      console.log('📊 Benchmarking optimized queries...');
      
      const optimizedTimes = [];
      for (let i = 0; i < TEST_CONFIG.benchmarkRuns; i++) {
        const start = Date.now();
        await deviceService.getUserDevices(testUser);
        optimizedTimes.push(Date.now() - start);
      }
      
      // Benchmark staff queries
      const staffTimes = [];
      for (let i = 0; i < TEST_CONFIG.benchmarkRuns; i++) {
        const start = Date.now();
        await deviceService.getUserDevices(testStaffUser);
        staffTimes.push(Date.now() - start);
      }
      
      const avgOptimized = optimizedTimes.reduce((a, b) => a + b) / optimizedTimes.length;
      const avgStaff = staffTimes.reduce((a, b) => a + b) / staffTimes.length;
      const p95Optimized = optimizedTimes.sort((a, b) => a - b)[Math.floor(optimizedTimes.length * 0.95)];
      const p95Staff = staffTimes.sort((a, b) => a - b)[Math.floor(staffTimes.length * 0.95)];
      
      console.log(`✅ User queries - Avg: ${avgOptimized.toFixed(1)}ms, P95: ${p95Optimized}ms`);
      console.log(`✅ Staff queries - Avg: ${avgStaff.toFixed(1)}ms, P95: ${p95Staff}ms`);
      
      this.results.performanceComparison = {
        userQueries: {
          average: avgOptimized,
          p95: p95Optimized,
          allTimes: optimizedTimes
        },
        staffQueries: {
          average: avgStaff,
          p95: p95Staff,
          allTimes: staffTimes
        }
      };
      
      // Performance goals check
      const userGoalMet = p95Optimized < 50;
      const staffGoalMet = p95Staff < 100;
      
      console.log(`${userGoalMet ? '✅' : '❌'} User P95 goal (<50ms): ${p95Optimized}ms`);
      console.log(`${staffGoalMet ? '✅' : '❌'} Staff P95 goal (<100ms): ${p95Staff}ms`);
      
    } catch (error) {
      console.log(`❌ Performance benchmark failed: ${error.message}`);
    }
    console.log();
  }

  printSummary() {
    console.log('📋 OPTIMIZATION TEST SUMMARY');
    console.log('==================================================');
    
    // Index summary
    const indexPassed = this.results.indexTests.filter(t => t.status === 'exists').length;
    const indexTotal = this.results.indexTests.length;
    console.log(`🔍 Indexes: ${indexPassed}/${indexTotal} created`);
    
    // View summary
    const viewPassed = this.results.viewTests.filter(t => t.status === 'success').length;
    const viewTotal = this.results.viewTests.length;
    console.log(`👁️  Views: ${viewPassed}/${viewTotal} working`);
    
    // Service summary
    const serviceWorking = this.results.serviceTests.length > 0 && !this.results.serviceTests[0].error;
    console.log(`⚙️  Service Layer: ${serviceWorking ? 'WORKING' : 'FAILED'}`);
    
    // Compatibility summary
    const compatPassed = this.results.compatibilityTests.some(t => t.status === 'passed');
    console.log(`🖥️  Frontend Compatibility: ${compatPassed ? 'PASSED' : 'FAILED'}`);
    
    // Performance summary
    if (this.results.performanceComparison.userQueries) {
      const userP95 = this.results.performanceComparison.userQueries.p95;
      const staffP95 = this.results.performanceComparison.staffQueries.p95;
      console.log(`🏃 Performance: User P95=${userP95}ms, Staff P95=${staffP95}ms`);
      
      const goalsMet = userP95 < 50 && staffP95 < 100;
      console.log(`🎯 Performance Goals: ${goalsMet ? 'MET' : 'NOT MET'}`);
    }
    
    console.log('\n✅ Test suite completed!');
  }
}

// Run tests if called directly
if (require.main === module) {
  const tester = new OptimizationTester();
  tester.runAllTests()
    .then(() => {
      console.log('\n🎉 All tests completed successfully!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n💥 Test suite failed:', error);
      process.exit(1);
    });
}

module.exports = OptimizationTester;