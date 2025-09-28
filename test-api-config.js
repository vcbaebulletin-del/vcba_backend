const axios = require('axios');

async function testAPIConfig() {
  console.log('🧪 Testing SMS Configuration via API...\n');
  
  try {
    // Test 1: Health check
    console.log('1. Testing health endpoint...');
    const healthResponse = await axios.get('http://localhost:5000/api/sms/health');
    console.log('✅ Health check passed:', healthResponse.data.message);
    console.log('');
    
    // Test 2: Try to get status (will fail due to auth, but we can see the error)
    console.log('2. Testing status endpoint (should require auth)...');
    try {
      const statusResponse = await axios.get('http://localhost:5000/api/sms/status');
      console.log('Status response:', statusResponse.data);
    } catch (error) {
      if (error.response?.status === 401) {
        console.log('✅ Status endpoint correctly requires authentication');
        console.log('   Error:', error.response.data.error.message);
      } else {
        console.log('❌ Unexpected error:', error.response?.status, error.response?.data);
      }
    }
    console.log('');
    
    console.log('🎉 API Configuration tests completed!');
    console.log('💡 The backend server is running and SMS endpoints are accessible.');
    console.log('📝 To test authenticated endpoints, use the frontend SMS Settings page.');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.log('💡 Make sure the backend server is running on http://localhost:5000');
    }
  }
}

testAPIConfig();
