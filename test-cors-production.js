// Test CORS configuration for production deployment
const axios = require('axios');

async function testProductionCORS() {
  console.log('🧪 Testing Production CORS Configuration...\n');
  
  const backendUrl = 'https://vcbabackend-production.up.railway.app';
  const frontendOrigin = 'https://vcba-frontend.vercel.app';
  
  try {
    // Test 1: Health check endpoint
    console.log('1️⃣ Testing health check endpoint...');
    const healthResponse = await axios.get(`${backendUrl}/health`, {
      headers: {
        'Origin': frontendOrigin,
        'Content-Type': 'application/json'
      }
    });
    console.log('✅ Health check successful:', healthResponse.status);
    console.log('📋 CORS Headers:', {
      'access-control-allow-origin': healthResponse.headers['access-control-allow-origin'],
      'access-control-allow-credentials': healthResponse.headers['access-control-allow-credentials'],
      'access-control-allow-methods': healthResponse.headers['access-control-allow-methods']
    });
    
    // Test 2: Preflight request (OPTIONS)
    console.log('\n2️⃣ Testing preflight request...');
    const preflightResponse = await axios.options(`${backendUrl}/api/auth/login`, {
      headers: {
        'Origin': frontendOrigin,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type, Authorization'
      }
    });
    console.log('✅ Preflight successful:', preflightResponse.status);
    console.log('📋 Preflight CORS Headers:', {
      'access-control-allow-origin': preflightResponse.headers['access-control-allow-origin'],
      'access-control-allow-credentials': preflightResponse.headers['access-control-allow-credentials'],
      'access-control-allow-methods': preflightResponse.headers['access-control-allow-methods'],
      'access-control-allow-headers': preflightResponse.headers['access-control-allow-headers']
    });
    
    // Test 3: API endpoint with credentials
    console.log('\n3️⃣ Testing API endpoint with credentials...');
    try {
      const apiResponse = await axios.post(`${backendUrl}/api/auth/login`, {
        email: 'test@example.com',
        password: 'testpassword'
      }, {
        headers: {
          'Origin': frontendOrigin,
          'Content-Type': 'application/json'
        },
        withCredentials: true
      });
      console.log('✅ API call successful (or expected auth error):', apiResponse.status);
    } catch (apiError) {
      if (apiError.response && apiError.response.status === 401) {
        console.log('✅ API call reached backend (401 auth error expected)');
        console.log('📋 API CORS Headers:', {
          'access-control-allow-origin': apiError.response.headers['access-control-allow-origin'],
          'access-control-allow-credentials': apiError.response.headers['access-control-allow-credentials']
        });
      } else {
        console.error('❌ API call failed with CORS error:', apiError.message);
      }
    }
    
    console.log('\n🎉 CORS Configuration Test Complete!');
    
  } catch (error) {
    console.error('❌ CORS Test Failed:', error.message);
    if (error.response) {
      console.error('📋 Error Response:', {
        status: error.response.status,
        statusText: error.response.statusText,
        headers: error.response.headers
      });
    }
  }
}

// Run the test
testProductionCORS().catch(console.error);
