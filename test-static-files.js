#!/usr/bin/env node

/**
 * Test Static File Serving
 * 
 * This script tests if static files are properly served from the Express server
 * both locally and in production deployment scenarios.
 */

const axios = require('axios');
const path = require('path');
const fs = require('fs');

// Configuration
const LOCAL_BASE_URL = 'http://localhost:5000';
const PRODUCTION_BASE_URL = 'https://vcbabackend-production.up.railway.app';

// Test files to check
const TEST_FILES = [
  // Carousel images
  '/carousel/vcba_adv_1.jpg',
  '/carousel/vcba_adv_2.jpg',
  
  // Uploaded images (if they exist)
  '/uploads/profiles/profile-1753156119262-817446167.jpeg',
  '/uploads/carousel/carousel-1755831183131-902571693.png',
  '/uploads/newsfeed/newsfeed-1757251663000-764684253.jpg',
  '/uploads/welcome/welcome-1755830973221-742461762.png',
  
  // Other static files
  '/vcba_images/mission_vision.jpg',
  '/villamor-image/villamor-collge-BG-landscape.jpg'
];

async function testStaticFile(baseUrl, filePath) {
  try {
    const url = `${baseUrl}${filePath}`;
    console.log(`🔍 Testing: ${url}`);
    
    const response = await axios.get(url, {
      timeout: 10000,
      validateStatus: (status) => status < 500 // Accept 404 as valid response
    });
    
    if (response.status === 200) {
      console.log(`✅ SUCCESS: ${filePath} (${response.headers['content-type']}, ${response.headers['content-length']} bytes)`);
      return true;
    } else if (response.status === 404) {
      console.log(`⚠️  NOT FOUND: ${filePath} (404)`);
      return false;
    } else {
      console.log(`❌ ERROR: ${filePath} (${response.status})`);
      return false;
    }
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.log(`🔌 CONNECTION REFUSED: ${filePath} (server not running)`);
    } else if (error.response) {
      console.log(`❌ ERROR: ${filePath} (${error.response.status}: ${error.response.statusText})`);
    } else {
      console.log(`❌ ERROR: ${filePath} (${error.message})`);
    }
    return false;
  }
}

async function checkLocalFiles() {
  console.log('\n📁 Checking local file system...');
  const publicDir = path.join(__dirname, 'public');
  
  if (!fs.existsSync(publicDir)) {
    console.log('❌ Public directory does not exist:', publicDir);
    return;
  }
  
  console.log('✅ Public directory exists:', publicDir);
  
  for (const filePath of TEST_FILES) {
    const fullPath = path.join(publicDir, filePath);
    if (fs.existsSync(fullPath)) {
      const stats = fs.statSync(fullPath);
      console.log(`✅ File exists: ${filePath} (${stats.size} bytes)`);
    } else {
      console.log(`❌ File missing: ${filePath}`);
    }
  }
}

async function testServer(baseUrl, serverName) {
  console.log(`\n🚀 Testing ${serverName} (${baseUrl})...`);
  
  let successCount = 0;
  let totalCount = TEST_FILES.length;
  
  for (const filePath of TEST_FILES) {
    const success = await testStaticFile(baseUrl, filePath);
    if (success) successCount++;
  }
  
  console.log(`\n📊 ${serverName} Results: ${successCount}/${totalCount} files served successfully`);
  return successCount;
}

async function main() {
  console.log('🧪 VCBA Static File Serving Test');
  console.log('================================');
  
  // Check local files first
  await checkLocalFiles();
  
  // Test local server (if running)
  console.log('\n🏠 Testing Local Server...');
  try {
    await axios.get(`${LOCAL_BASE_URL}/api/health`, { timeout: 5000 });
    await testServer(LOCAL_BASE_URL, 'Local Server');
  } catch (error) {
    console.log('⚠️  Local server not running or not accessible');
  }
  
  // Test production server
  console.log('\n🌐 Testing Production Server...');
  try {
    await axios.get(`${PRODUCTION_BASE_URL}/api/health`, { timeout: 10000 });
    const productionSuccess = await testServer(PRODUCTION_BASE_URL, 'Production Server');
    
    if (productionSuccess === 0) {
      console.log('\n❌ CRITICAL: No static files are being served from production!');
      console.log('   This indicates a deployment or configuration issue.');
    } else if (productionSuccess < TEST_FILES.length / 2) {
      console.log('\n⚠️  WARNING: Many static files are missing from production.');
    } else {
      console.log('\n✅ Production static file serving appears to be working!');
    }
  } catch (error) {
    console.log('❌ Production server not accessible:', error.message);
  }
  
  console.log('\n🏁 Test completed!');
}

// Run the test
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { testStaticFile, testServer };
