#!/usr/bin/env node

/**
 * Test Calendar Endpoint Connectivity
 * 
 * This script tests the calendar API endpoint to diagnose the 503 Service Unavailable error
 */

const axios = require('axios');

// Configuration
const PRODUCTION_URL = 'https://vcbabackend-production.up.railway.app';

async function testEndpoint(url, description) {
  console.log(`\n🔍 Testing ${description}`);
  console.log(`   URL: ${url}`);
  
  try {
    const response = await axios.get(url, {
      timeout: 15000,
      headers: {
        'User-Agent': 'VCBA-Calendar-Test/1.0'
      }
    });
    
    console.log(`   ✅ Status: ${response.status} ${response.statusText}`);
    console.log(`   📊 Response size: ${JSON.stringify(response.data).length} bytes`);
    
    if (response.data && response.data.success !== undefined) {
      console.log(`   🎯 Success: ${response.data.success}`);
      if (response.data.message) {
        console.log(`   💬 Message: ${response.data.message}`);
      }
      if (response.data.data && response.data.data.events) {
        console.log(`   📅 Events count: ${response.data.data.events.length}`);
      }
    }
    
    return { success: true, status: response.status, data: response.data };
    
  } catch (error) {
    if (error.response) {
      console.log(`   ❌ HTTP Error: ${error.response.status} ${error.response.statusText}`);
      console.log(`   📝 Response: ${JSON.stringify(error.response.data)}`);
      return { success: false, status: error.response.status, error: error.response.data };
    } else if (error.code === 'ECONNREFUSED') {
      console.log(`   ❌ Connection refused - server may be down`);
      return { success: false, error: 'Connection refused' };
    } else if (error.code === 'ETIMEDOUT') {
      console.log(`   ❌ Request timeout - server may be overloaded`);
      return { success: false, error: 'Timeout' };
    } else {
      console.log(`   ❌ Network error: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
}

async function main() {
  console.log('🚀 Calendar Endpoint Connectivity Test');
  console.log('=====================================');
  
  const tests = [
    {
      url: `${PRODUCTION_URL}/api/time/current`,
      description: 'Time API (Basic connectivity)'
    },
    {
      url: `${PRODUCTION_URL}/api/calendar`,
      description: 'Calendar API (Default parameters)'
    },
    {
      url: `${PRODUCTION_URL}/api/calendar?limit=50&sort_by=event_date&sort_order=ASC`,
      description: 'Calendar API (With query parameters)'
    },
    {
      url: `${PRODUCTION_URL}/api/calendar?limit=10`,
      description: 'Calendar API (Minimal parameters)'
    }
  ];
  
  const results = [];
  
  for (const test of tests) {
    const result = await testEndpoint(test.url, test.description);
    results.push({ ...test, result });
    
    // Add delay between requests to avoid overwhelming the server
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n📊 Test Summary');
  console.log('===============');
  
  let successCount = 0;
  results.forEach((test, index) => {
    const status = test.result.success ? '✅ PASS' : '❌ FAIL';
    console.log(`${index + 1}. ${test.description}: ${status}`);
    if (test.result.success) {
      successCount++;
    } else {
      console.log(`   Error: ${test.result.error || test.result.status}`);
    }
  });
  
  console.log(`\n🎯 Results: ${successCount}/${results.length} tests passed`);
  
  if (successCount === 0) {
    console.log('\n🚨 CRITICAL: Backend server appears to be completely down');
    console.log('   - Check Railway deployment status');
    console.log('   - Verify environment variables');
    console.log('   - Check database connectivity');
  } else if (successCount < results.length) {
    console.log('\n⚠️  PARTIAL: Some endpoints are failing');
    console.log('   - Calendar-specific issue detected');
    console.log('   - Check calendar route configuration');
    console.log('   - Verify database table structure');
  } else {
    console.log('\n🎉 SUCCESS: All endpoints are working correctly');
  }
  
  console.log('\n💡 Next Steps:');
  console.log('   1. Check Railway deployment logs');
  console.log('   2. Verify database connection');
  console.log('   3. Test calendar endpoint manually');
  console.log('   4. Check for any recent code changes');
}

if (require.main === module) {
  main().catch(console.error);
}
