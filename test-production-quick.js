#!/usr/bin/env node

/**
 * Quick Production Test
 * Test if the Railway backend is responding and serving static files
 */

const axios = require('axios');

const PRODUCTION_BASE_URL = 'https://vcbabackend-production.up.railway.app';

async function testEndpoint(url, description) {
  try {
    console.log(`🔍 Testing ${description}: ${url}`);
    const response = await axios.get(url, { 
      timeout: 10000,
      validateStatus: (status) => status < 500 
    });
    
    if (response.status === 200) {
      console.log(`✅ SUCCESS: ${description} (${response.status})`);
      return true;
    } else {
      console.log(`⚠️  ${description}: ${response.status} ${response.statusText}`);
      return false;
    }
  } catch (error) {
    if (error.response) {
      console.log(`❌ ${description}: ${error.response.status} ${error.response.statusText}`);
    } else if (error.code === 'ECONNREFUSED') {
      console.log(`🔌 ${description}: Connection refused`);
    } else {
      console.log(`❌ ${description}: ${error.message}`);
    }
    return false;
  }
}

async function main() {
  console.log('🚀 Quick Production Test');
  console.log('========================');
  
  // Test basic endpoints
  await testEndpoint(`${PRODUCTION_BASE_URL}/api/health`, 'Health Check');
  await testEndpoint(`${PRODUCTION_BASE_URL}/api/time/current`, 'Time API');
  
  // Test static files
  console.log('\n📁 Testing Static Files:');
  await testEndpoint(`${PRODUCTION_BASE_URL}/carousel/vcba_adv_1.jpg`, 'Carousel Image 1');
  await testEndpoint(`${PRODUCTION_BASE_URL}/carousel/vcba_adv_2.jpg`, 'Carousel Image 2');
  await testEndpoint(`${PRODUCTION_BASE_URL}/uploads/profiles/profile-1753156119262-817446167.jpeg`, 'Profile Image');
  await testEndpoint(`${PRODUCTION_BASE_URL}/uploads/newsfeed/newsfeed-1757251663000-764684253.jpg`, 'Newsfeed Image');
  
  console.log('\n🏁 Test completed!');
}

main().catch(console.error);
