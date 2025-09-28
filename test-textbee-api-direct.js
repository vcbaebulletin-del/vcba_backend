/**
 * Direct test of TextBee API to debug SMS sending issues
 */

const axios = require('axios');

// Test configuration
const config = {
  baseURL: 'https://api.textbee.dev/api/v1',
  apiKey: '8b8f9e20-0f2b-4949-b8a6-877f56e0b399',
  deviceId: '68c85987c27bd0d0b9608142'
};

async function testTextBeeAPI() {
  console.log('🧪 Testing TextBee API Direct Integration...\n');

  try {
    // Test 1: Check API endpoint accessibility
    console.log('1️⃣ Testing TextBee API Endpoint Accessibility...');
    const endpoint = `${config.baseURL}/gateway/devices/${config.deviceId}/send-sms`;
    console.log('Endpoint:', endpoint);
    console.log('API Key:', config.apiKey ? `${config.apiKey.substring(0, 8)}...` : 'Not set');
    console.log('Device ID:', config.deviceId ? `${config.deviceId.substring(0, 8)}...` : 'Not set');
    console.log();

    // Test 2: Prepare test SMS data
    console.log('2️⃣ Preparing Test SMS Data...');
    const testData = {
      recipients: ['+639123456789'], // Test Philippine number
      message: 'Test SMS from VCBA E-Bulletin Board - API Integration Test'
    };
    console.log('Test data:', {
      recipients: testData.recipients,
      messageLength: testData.message.length
    });
    console.log();

    // Test 3: Send test SMS
    console.log('3️⃣ Sending Test SMS via TextBee API...');
    try {
      const response = await axios.post(endpoint, testData, {
        headers: {
          'x-api-key': config.apiKey,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      console.log('✅ SMS sent successfully!');
      console.log('Response status:', response.status);
      console.log('Response data:', response.data);
      
    } catch (error) {
      console.log('❌ SMS sending failed');
      console.log('Error details:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        code: error.code
      });

      // Analyze the error
      if (error.code === 'ENOTFOUND') {
        console.log('🔍 Analysis: DNS resolution failed - check internet connection');
      } else if (error.code === 'ECONNREFUSED') {
        console.log('🔍 Analysis: Connection refused - TextBee API might be down');
      } else if (error.response?.status === 401) {
        console.log('🔍 Analysis: Unauthorized - check API key');
      } else if (error.response?.status === 404) {
        console.log('🔍 Analysis: Not found - check device ID or endpoint URL');
      } else if (error.response?.status === 400) {
        console.log('🔍 Analysis: Bad request - check request format');
      } else if (error.response?.status === 429) {
        console.log('🔍 Analysis: Rate limited - too many requests');
      }
    }
    console.log();

    // Test 4: Test alternative endpoint format (if main fails)
    console.log('4️⃣ Testing Alternative Endpoint Formats...');
    const alternativeEndpoints = [
      `${config.baseURL}/send-sms`,
      `${config.baseURL}/sms/send`,
      `${config.baseURL}/gateway/send-sms`
    ];

    for (const altEndpoint of alternativeEndpoints) {
      console.log(`Testing: ${altEndpoint}`);
      try {
        const response = await axios.post(altEndpoint, testData, {
          headers: {
            'x-api-key': config.apiKey,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        });
        console.log(`✅ Alternative endpoint works: ${altEndpoint}`);
        console.log('Response:', response.data);
        break;
      } catch (error) {
        console.log(`❌ Failed: ${error.response?.status || error.code}`);
      }
    }
    console.log();

    console.log('🎉 TEXTBEE API TEST COMPLETED!');
    console.log();
    console.log('📋 RECOMMENDATIONS:');
    console.log('1. Check TextBee API documentation for correct endpoint format');
    console.log('2. Verify API key is valid and has SMS sending permissions');
    console.log('3. Confirm device ID is correctly registered with TextBee');
    console.log('4. Test with a real phone number if using test numbers');
    console.log('5. Check TextBee account balance and limits');
    console.log('6. Review TextBee API rate limiting policies');

  } catch (error) {
    console.error('❌ Test setup failed:', error.message);
  }
}

// Run the test
testTextBeeAPI();
