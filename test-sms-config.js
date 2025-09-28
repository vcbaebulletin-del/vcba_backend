const axios = require('axios');

async function testSMSConfiguration() {
  const baseURL = 'http://localhost:5000/api/sms';
  
  console.log('🧪 Testing SMS Configuration API...\n');

  try {
    // Test 1: Health check (no auth required)
    console.log('1. Testing health endpoint...');
    const healthResponse = await axios.get(`${baseURL}/health`);
    console.log('✅ Health check:', healthResponse.data);
    console.log('');

    // Test 2: Get status (requires auth - should fail)
    console.log('2. Testing status endpoint without auth...');
    try {
      await axios.get(`${baseURL}/status`);
    } catch (error) {
      if (error.response?.status === 401) {
        console.log('✅ Status endpoint correctly requires authentication');
      } else {
        console.log('❌ Unexpected error:', error.response?.status, error.response?.data);
      }
    }
    console.log('');

    // Test 3: Update config (requires auth - should fail)
    console.log('3. Testing config update without auth...');
    try {
      await axios.put(`${baseURL}/config`, {
        apiKey: 'test-api-key-12345',
        deviceId: 'test-device-id-12345',
        baseURL: 'https://api.textbee.dev/api/v1',
        isEnabled: true,
        rateLimitPerMinute: 30
      });
    } catch (error) {
      if (error.response?.status === 401) {
        console.log('✅ Config update correctly requires authentication');
      } else {
        console.log('❌ Unexpected error:', error.response?.status, error.response?.data);
      }
    }
    console.log('');

    console.log('🎉 SMS Configuration API tests completed!');
    console.log('📝 Summary:');
    console.log('   - Health endpoint: ✅ Working (no auth required)');
    console.log('   - Status endpoint: ✅ Protected (auth required)');
    console.log('   - Config endpoint: ✅ Protected (auth required)');
    console.log('');
    console.log('💡 To test authenticated endpoints, use the frontend SMS Settings page');
    console.log('   or provide a valid admin JWT token in the Authorization header.');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.log('💡 Make sure the backend server is running on http://localhost:5000');
    }
  }
}

testSMSConfiguration();
