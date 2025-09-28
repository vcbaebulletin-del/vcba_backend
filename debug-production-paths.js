#!/usr/bin/env node

/**
 * Debug Production Paths
 * Test different path combinations to understand how Railway serves static files
 */

const axios = require('axios');

const PRODUCTION_BASE_URL = 'https://vcbabackend-production.up.railway.app';

async function testPath(path, description) {
  try {
    const url = `${PRODUCTION_BASE_URL}${path}`;
    console.log(`🔍 ${description}: ${url}`);
    
    const response = await axios.get(url, { 
      timeout: 8000,
      validateStatus: (status) => status < 500 
    });
    
    const contentType = response.headers['content-type'] || 'unknown';
    const contentLength = response.headers['content-length'] || 'unknown';
    
    if (response.status === 200) {
      console.log(`✅ SUCCESS: ${response.status} | ${contentType} | ${contentLength} bytes`);
      return true;
    } else {
      console.log(`⚠️  ${response.status} ${response.statusText}`);
      return false;
    }
  } catch (error) {
    if (error.response) {
      console.log(`❌ ${error.response.status} ${error.response.statusText}`);
    } else {
      console.log(`❌ ${error.message}`);
    }
    return false;
  }
}

async function main() {
  console.log('🔍 Railway Static File Path Debug');
  console.log('==================================');
  
  // Test API endpoints first
  console.log('\n🔌 API Endpoints:');
  await testPath('/api/time/current', 'Time API');
  await testPath('/api/health', 'Health API');
  await testPath('/api/welcome-page/test', 'Welcome Test API');
  
  // Test static files with different path patterns
  console.log('\n📁 Static File Paths:');
  
  // Test carousel images (should be in public/carousel/)
  await testPath('/carousel/vcba_adv_1.jpg', 'Carousel Direct');
  await testPath('/public/carousel/vcba_adv_1.jpg', 'Carousel with /public');
  
  // Test uploaded files (should be in public/uploads/)
  await testPath('/uploads/profiles/profile-1753156119262-817446167.jpeg', 'Uploads Direct');
  await testPath('/public/uploads/profiles/profile-1753156119262-817446167.jpeg', 'Uploads with /public');
  
  // Test other static files
  await testPath('/vcba_images/mission_vision.jpg', 'VCBA Images Direct');
  await testPath('/public/vcba_images/mission_vision.jpg', 'VCBA Images with /public');
  
  // Test websocket test file
  await testPath('/websocket-test.html', 'WebSocket Test HTML');
  await testPath('/public/websocket-test.html', 'WebSocket Test HTML with /public');
  
  console.log('\n🏁 Debug completed!');
  console.log('\n💡 Analysis:');
  console.log('   - If /public/* paths work, static middleware needs /public prefix');
  console.log('   - If direct paths work, static middleware is correctly configured');
  console.log('   - If nothing works, there may be a deployment or path resolution issue');
}

main().catch(console.error);
