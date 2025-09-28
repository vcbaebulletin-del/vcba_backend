const axios = require('axios');

async function debug400Error() {
  console.log('🔍 Debugging 400 Bad Request Error...\n');
  
  const BASE_URL = 'http://localhost:5000/api/sms';
  
  // Test different configurations to identify the validation issue
  const testConfigs = [
    {
      name: 'Valid Configuration',
      config: {
        apiKey: 'test-api-key-123456789',
        deviceId: 'test-device-id-123456789',
        baseURL: 'https://api.textbee.dev/api/v1',
        isEnabled: true,
        rateLimitPerMinute: 60
      }
    },
    {
      name: 'Missing API Key',
      config: {
        deviceId: 'test-device-id-123456789',
        baseURL: 'https://api.textbee.dev/api/v1',
        isEnabled: true,
        rateLimitPerMinute: 60
      }
    },
    {
      name: 'Empty API Key',
      config: {
        apiKey: '',
        deviceId: 'test-device-id-123456789',
        baseURL: 'https://api.textbee.dev/api/v1',
        isEnabled: true,
        rateLimitPerMinute: 60
      }
    },
    {
      name: 'Invalid URL',
      config: {
        apiKey: 'test-api-key-123456789',
        deviceId: 'test-device-id-123456789',
        baseURL: 'not-a-valid-url',
        isEnabled: true,
        rateLimitPerMinute: 60
      }
    },
    {
      name: 'Invalid Rate Limit',
      config: {
        apiKey: 'test-api-key-123456789',
        deviceId: 'test-device-id-123456789',
        baseURL: 'https://api.textbee.dev/api/v1',
        isEnabled: true,
        rateLimitPerMinute: -1
      }
    },
    {
      name: 'Frontend-like Configuration',
      config: {
        apiKey: '8b8f9e20-0f2b-4949-b8a6-877f56e0b399',
        deviceId: '68c85987c27bd0d0b9608142',
        baseURL: 'https://api.textbee.dev/api/v1',
        isEnabled: true,
        rateLimitPerMinute: 60
      }
    }
  ];
  
  // Create a mock JWT token (this will still fail auth, but we can see validation errors)
  const mockToken = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhZG1pbl9pZCI6MSwidXNlcm5hbWUiOiJ0ZXN0YWRtaW4iLCJyb2xlIjoic3VwZXJfYWRtaW4iLCJpYXQiOjE2MzQ1Njc4OTAsImV4cCI6MTYzNDY1NDI5MH0.test';
  
  for (const test of testConfigs) {
    console.log(`\n📝 Testing: ${test.name}`);
    console.log('Config:', JSON.stringify(test.config, null, 2));
    
    try {
      const response = await axios.put(`${BASE_URL}/config`, test.config, {
        headers: {
          'Authorization': mockToken,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('✅ Success:', response.status);
      console.log('Response:', response.data);
      
    } catch (error) {
      if (error.response) {
        console.log(`❌ Error Status: ${error.response.status}`);
        console.log('Error Data:', JSON.stringify(error.response.data, null, 2));
        
        if (error.response.status === 400) {
          console.log('🔍 This is a validation error - check the message above');
        } else if (error.response.status === 401) {
          console.log('🔐 Authentication error (expected with mock token)');
        } else if (error.response.status === 500) {
          console.log('💥 Internal server error - this should not happen');
        }
      } else {
        console.log('❌ Network Error:', error.message);
      }
    }
    
    console.log('─'.repeat(50));
  }
  
  console.log('\n🎯 Summary:');
  console.log('- Look for 400 errors above to identify validation issues');
  console.log('- 401 errors are expected (authentication required)');
  console.log('- 500 errors indicate server problems');
  console.log('- The frontend is likely sending data that fails validation');
}

debug400Error();
