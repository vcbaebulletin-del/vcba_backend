const axios = require('axios');

async function testDebugEndpoint() {
  console.log('🔍 Testing Debug Endpoint for Validation Issues...\n');
  
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
      name: 'Short API Key (< 10 chars)',
      config: {
        apiKey: 'short',
        deviceId: 'test-device-id-123456789',
        baseURL: 'https://api.textbee.dev/api/v1',
        isEnabled: true,
        rateLimitPerMinute: 60
      }
    },
    {
      name: 'Short Device ID (< 10 chars)',
      config: {
        apiKey: 'test-api-key-123456789',
        deviceId: 'short',
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
      name: 'Invalid Boolean (string instead of boolean)',
      config: {
        apiKey: 'test-api-key-123456789',
        deviceId: 'test-device-id-123456789',
        baseURL: 'https://api.textbee.dev/api/v1',
        isEnabled: 'true', // String instead of boolean
        rateLimitPerMinute: 60
      }
    },
    {
      name: 'Invalid Rate Limit (string instead of number)',
      config: {
        apiKey: 'test-api-key-123456789',
        deviceId: 'test-device-id-123456789',
        baseURL: 'https://api.textbee.dev/api/v1',
        isEnabled: true,
        rateLimitPerMinute: '60' // String instead of number
      }
    },
    {
      name: 'Frontend-like Configuration (Real Values)',
      config: {
        apiKey: '8b8f9e20-0f2b-4949-b8a6-877f56e0b399',
        deviceId: '68c85987c27bd0d0b9608142',
        baseURL: 'https://api.textbee.dev/api/v1',
        isEnabled: true,
        rateLimitPerMinute: 60
      }
    }
  ];
  
  for (const test of testConfigs) {
    console.log(`\n📝 Testing: ${test.name}`);
    console.log('Config:', JSON.stringify(test.config, null, 2));
    
    try {
      const response = await axios.put(`${BASE_URL}/debug-config`, test.config, {
        headers: {
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
          console.log('🔍 VALIDATION ERROR FOUND! Check details above.');
        }
      } else {
        console.log('❌ Network Error:', error.message);
      }
    }
    
    console.log('─'.repeat(50));
  }
  
  console.log('\n🎯 Summary:');
  console.log('- Look for 400 validation errors above');
  console.log('- These show exactly what validation is failing');
  console.log('- Compare with what the frontend is sending');
}

testDebugEndpoint();
