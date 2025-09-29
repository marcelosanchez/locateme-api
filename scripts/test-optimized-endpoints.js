#!/usr/bin/env node

/**
 * LocateMe Optimized Endpoints Test Suite
 * 
 * Tests the performance and functionality of new optimized endpoints
 */

const axios = require('axios');

// Test configuration
const TEST_CONFIG = {
  baseURL: 'http://localhost:3001',  // Adjust for your server port
  timeout: 10000,
  testUser: {
    // You'll need to get a valid JWT token for testing
    // Replace this with a real token from your authentication
    token: 'your_jwt_token_here'
  }
};

class OptimizedEndpointTester {
  constructor() {
    this.results = {
      sidebar: [],
      map: [],
      device: [],
      performance: []
    };
    
    this.axios = axios.create({
      baseURL: TEST_CONFIG.baseURL,
      timeout: TEST_CONFIG.timeout,
      headers: {
        'Authorization': `Bearer ${TEST_CONFIG.testUser.token}`,
        'Content-Type': 'application/json'
      }
    });
  }

  async runAllTests() {
    console.log('🚀 Starting LocateMe Optimized Endpoints Tests\n');
    
    try {
      await this.testSidebarEndpoints();
      await this.testMapEndpoints();
      await this.testDeviceEndpoints();
      await this.testPerformanceEndpoints();
      
      this.printSummary();
      return this.results;
      
    } catch (error) {
      console.error('❌ Test suite failed:', error.message);
      if (error.response) {
        console.error('Response:', error.response.status, error.response.data);
      }
      throw error;
    }
  }

  async testSidebarEndpoints() {
    console.log('📋 Testing Sidebar Endpoints...');
    
    // Test device names endpoint
    const deviceNamesTest = await this.timeRequest(
      'GET', 
      '/locateme/optimized/sidebar/device-names',
      'Sidebar Device Names'
    );
    
    this.results.sidebar.push(deviceNamesTest);
    
    if (deviceNamesTest.success && deviceNamesTest.data.count > 0) {
      console.log(`✅ Found ${deviceNamesTest.data.count} devices`);
      console.log(`⚡ Response time: ${deviceNamesTest.responseTime}ms`);
      
      // Validate response structure
      const firstDevice = deviceNamesTest.data.data[0];
      const hasRequiredFields = ['device_id', 'device_name'].every(field => 
        firstDevice.hasOwnProperty(field)
      );
      
      if (hasRequiredFields) {
        console.log('✅ Response structure valid');
      } else {
        console.log('❌ Response structure invalid');
      }
      
      // Check that no position data is included (optimization check)
      const hasPositionData = firstDevice.hasOwnProperty('latitude') || 
                             firstDevice.hasOwnProperty('longitude');
      
      if (!hasPositionData) {
        console.log('✅ No position data in sidebar response (optimized)');
      } else {
        console.log('⚠️  Position data found in sidebar response (not optimized)');
      }
    }
    
    console.log();
  }

  async testMapEndpoints() {
    console.log('🗺️  Testing Map Endpoints...');
    
    // Test all device positions endpoint
    const allPositionsTest = await this.timeRequest(
      'GET', 
      '/locateme/optimized/map/device-positions',
      'All Device Positions'
    );
    
    this.results.map.push(allPositionsTest);
    
    if (allPositionsTest.success && allPositionsTest.data.count > 0) {
      console.log(`✅ Found ${allPositionsTest.data.count} device positions`);
      console.log(`⚡ Response time: ${allPositionsTest.responseTime}ms`);
      
      // Validate position data
      const firstPosition = allPositionsTest.data.data[0];
      const hasPositionData = ['latitude', 'longitude'].every(field => 
        firstPosition.hasOwnProperty(field) && firstPosition[field] !== null
      );
      
      if (hasPositionData) {
        console.log('✅ Position data present in map response');
      } else {
        console.log('❌ Missing position data in map response');
      }
    }
    
    // Test batch positions endpoint
    const batchPositionsTest = await this.timeRequest(
      'GET', 
      '/locateme/optimized/map/batch-positions',
      'Batch Device Positions'
    );
    
    this.results.map.push(batchPositionsTest);
    
    if (batchPositionsTest.success) {
      console.log(`✅ Batch positions: ${batchPositionsTest.data.count} devices`);
      console.log(`⚡ Response time: ${batchPositionsTest.responseTime}ms`);
    }
    
    console.log();
  }

  async testDeviceEndpoints() {
    console.log('📱 Testing Device Endpoints...');
    
    // First get a device ID to test with
    try {
      const devicesResponse = await this.axios.get('/locateme/optimized/sidebar/device-names');
      
      if (devicesResponse.data.success && devicesResponse.data.count > 0) {
        const testDeviceId = devicesResponse.data.data[0].device_id;
        console.log(`Using test device: ${testDeviceId}`);
        
        // Test single device position
        const singlePositionTest = await this.timeRequest(
          'GET', 
          `/locateme/optimized/devices/${testDeviceId}/position`,
          'Single Device Position'
        );
        
        this.results.device.push(singlePositionTest);
        
        if (singlePositionTest.success) {
          console.log(`✅ Single device position retrieved`);
          console.log(`⚡ Response time: ${singlePositionTest.responseTime}ms`);
          
          if (singlePositionTest.data.real_time) {
            console.log('✅ Real-time data confirmed');
          }
        }
        
        // Test device route
        const routeTest = await this.timeRequest(
          'GET', 
          `/locateme/optimized/devices/${testDeviceId}/route?hours=24&limit=50`,
          'Device Route'
        );
        
        this.results.device.push(routeTest);
        
        if (routeTest.success) {
          console.log(`✅ Device route: ${routeTest.data.count} points`);
          console.log(`⚡ Response time: ${routeTest.responseTime}ms`);
        }
      }
    } catch (error) {
      console.log('❌ Could not test device endpoints: No test device available');
    }
    
    console.log();
  }

  async testPerformanceEndpoints() {
    console.log('📊 Testing Performance Endpoints...');
    
    const performanceTest = await this.timeRequest(
      'GET', 
      '/performance/endpoints',
      'Performance Check'
    );
    
    this.results.performance.push(performanceTest);
    
    if (performanceTest.success) {
      console.log(`✅ Performance endpoint accessible`);
      console.log(`⚡ Response time: ${performanceTest.responseTime}ms`);
      
      if (performanceTest.data.health_check) {
        Object.entries(performanceTest.data.health_check).forEach(([key, status]) => {
          console.log(`${status === 'OK' ? '✅' : '❌'} ${key}: ${status}`);
        });
      }
    }
    
    console.log();
  }

  async timeRequest(method, endpoint, description) {
    const startTime = Date.now();
    
    try {
      const response = await this.axios.request({
        method,
        url: endpoint
      });
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      return {
        endpoint,
        description,
        success: true,
        responseTime,
        data: response.data,
        status: response.status
      };
      
    } catch (error) {
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      return {
        endpoint,
        description,
        success: false,
        responseTime,
        error: error.response?.data || error.message,
        status: error.response?.status || 'NETWORK_ERROR'
      };
    }
  }

  printSummary() {
    console.log('📋 OPTIMIZED ENDPOINTS TEST SUMMARY');
    console.log('==================================================');
    
    const allTests = [
      ...this.results.sidebar,
      ...this.results.map, 
      ...this.results.device,
      ...this.results.performance
    ];
    
    const successfulTests = allTests.filter(test => test.success);
    const failedTests = allTests.filter(test => !test.success);
    
    console.log(`✅ Successful Tests: ${successfulTests.length}/${allTests.length}`);
    console.log(`❌ Failed Tests: ${failedTests.length}/${allTests.length}`);
    
    if (successfulTests.length > 0) {
      const avgResponseTime = successfulTests.reduce((sum, test) => sum + test.responseTime, 0) / successfulTests.length;
      const fastestTest = successfulTests.reduce((fastest, test) => 
        test.responseTime < fastest.responseTime ? test : fastest
      );
      const slowestTest = successfulTests.reduce((slowest, test) => 
        test.responseTime > slowest.responseTime ? test : slowest
      );
      
      console.log(`⚡ Average Response Time: ${avgResponseTime.toFixed(1)}ms`);
      console.log(`🚀 Fastest: ${fastestTest.description} (${fastestTest.responseTime}ms)`);
      console.log(`🐌 Slowest: ${slowestTest.description} (${slowestTest.responseTime}ms)`);
    }
    
    if (failedTests.length > 0) {
      console.log('\n❌ Failed Tests:');
      failedTests.forEach(test => {
        console.log(`   - ${test.description}: ${test.status} - ${test.error}`);
      });
    }
    
    // Performance goals check
    const performanceGoals = {
      sidebar: 100,  // ms
      map: 500,      // ms
      device: 200    // ms
    };
    
    console.log('\n🎯 Performance Goals:');
    Object.entries(performanceGoals).forEach(([category, goal]) => {
      const categoryTests = this.results[category]?.filter(test => test.success) || [];
      if (categoryTests.length > 0) {
        const avgTime = categoryTests.reduce((sum, test) => sum + test.responseTime, 0) / categoryTests.length;
        const goalMet = avgTime <= goal;
        console.log(`${goalMet ? '✅' : '❌'} ${category}: ${avgTime.toFixed(1)}ms (goal: <${goal}ms)`);
      }
    });
    
    console.log('\n✅ Test suite completed!');
  }
}

// Instructions for running the test
if (require.main === module) {
  console.log('🔧 SETUP REQUIRED:');
  console.log('1. Update TEST_CONFIG.testUser.token with a valid JWT token');
  console.log('2. Ensure server is running on the configured port');
  console.log('3. Run: node scripts/test-optimized-endpoints.js\n');
  
  // Uncomment to run tests (after setting up token)
  // const tester = new OptimizedEndpointTester();
  // tester.runAllTests()
  //   .then(() => {
  //     console.log('\n🎉 All tests completed successfully!');
  //     process.exit(0);
  //   })
  //   .catch(error => {
  //     console.error('\n💥 Test suite failed:', error.message);
  //     process.exit(1);
  //   });
}

module.exports = OptimizedEndpointTester;