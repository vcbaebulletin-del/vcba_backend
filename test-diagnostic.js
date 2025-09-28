#!/usr/bin/env node

/**
 * Test Diagnostic Endpoint
 * Get Railway environment information to debug static file issues
 */

const axios = require('axios');

const PRODUCTION_BASE_URL = 'https://vcbabackend-production.up.railway.app';

async function testDiagnostic() {
  try {
    console.log('🔍 Testing Railway Diagnostic Endpoint');
    console.log('=====================================');
    
    const url = `${PRODUCTION_BASE_URL}/api/debug/paths`;
    console.log(`📡 Requesting: ${url}`);
    
    const response = await axios.get(url, { timeout: 15000 });
    
    if (response.status === 200) {
      console.log('✅ Diagnostic endpoint successful!');
      console.log('\n📊 Railway Environment Information:');
      console.log('====================================');
      
      const data = response.data;
      
      console.log(`🏠 Working Directory: ${data['process.cwd()']}`);
      console.log(`📁 __dirname: ${data.__dirname}`);
      console.log(`🌍 Environment: ${data.environment}`);
      console.log(`🖥️  Platform: ${data.platform}`);
      console.log(`⚙️  Node Version: ${data.nodeVersion}`);
      
      console.log('\n📂 Directory Paths:');
      console.log(`   Public Dir: ${data.publicDir}`);
      console.log(`   Uploads Dir: ${data.uploadsDir}`);
      
      console.log('\n✅ Directory Existence:');
      console.log(`   Public Exists: ${data.publicExists ? '✅' : '❌'}`);
      console.log(`   Uploads Exists: ${data.uploadsExists ? '✅' : '❌'}`);
      console.log(`   Alt Public Exists: ${data.altPublicExists ? '✅' : '❌'}`);
      console.log(`   Alt Uploads Exists: ${data.altUploadsExists ? '✅' : '❌'}`);
      
      if (data.publicContents) {
        console.log('\n📋 Public Directory Contents:');
        data.publicContents.forEach(item => console.log(`   - ${item}`));
      }
      
      if (data.uploadsContents) {
        console.log('\n📋 Uploads Directory Contents (first 10):');
        data.uploadsContents.forEach(item => console.log(`   - ${item}`));
      }
      
      if (data.altPublicContents) {
        console.log('\n📋 Alternative Public Directory Contents:');
        data.altPublicContents.forEach(item => console.log(`   - ${item}`));
      }
      
      if (data.error) {
        console.log(`\n❌ Error: ${data.error}`);
      }
      
      // Analysis
      console.log('\n🔍 Analysis:');
      if (data.publicExists) {
        console.log('✅ Static files should be accessible via Express static middleware');
      } else if (data.altPublicExists) {
        console.log('⚠️  Public directory exists but at different path - need to update static middleware');
      } else {
        console.log('❌ Public directory not found - files may not be deployed correctly');
      }
      
    } else {
      console.log(`⚠️  Diagnostic endpoint returned: ${response.status} ${response.statusText}`);
    }
    
  } catch (error) {
    if (error.response) {
      console.log(`❌ Diagnostic endpoint failed: ${error.response.status} ${error.response.statusText}`);
    } else {
      console.log(`❌ Diagnostic endpoint error: ${error.message}`);
    }
  }
}

testDiagnostic();
