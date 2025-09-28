const axios = require('axios');

// Test different report request payloads to verify validation works
async function testReportValidation() {
  console.log('🧪 [TEST] Starting comprehensive report validation testing...\n');

  // Try different ports in case 5000 is occupied
  const possiblePorts = [5000, 3001, 8000, 8080];
  let baseURL = null;

  // Test connectivity to find the right port
  for (const port of possiblePorts) {
    try {
      const testURL = `http://localhost:${port}`;
      console.log(`🔍 [TEST] Testing connectivity to ${testURL}...`);

      const response = await axios.get(`${testURL}/api/health`, { timeout: 2000 });
      console.log(`✅ [TEST] Server found at ${testURL}`);
      baseURL = testURL;
      break;
    } catch (error) {
      console.log(`❌ [TEST] No server at port ${port}: ${error.message}`);
    }
  }

  if (!baseURL) {
    console.log('❌ [TEST] No server found on any port. Please start the backend server first.');
    return;
  }

  const testCases = [
    {
      name: 'Monthly Report (should work)',
      payload: {
        month: '2024-09',
        fields: ['Announcements', 'SchoolCalendar'],
        includeImages: false
      }
    },
    {
      name: 'Weekly Report (should work after fix)',
      payload: {
        weekStart: '2024-09-01',
        weekEnd: '2024-09-07',
        fields: ['Announcements', 'SchoolCalendar'],
        includeImages: false
      }
    },
    {
      name: 'Daily Report (should work after fix)',
      payload: {
        startDate: '2024-09-26',
        endDate: '2024-09-26',
        fields: ['Announcements', 'SchoolCalendar'],
        includeImages: false
      }
    },
    {
      name: 'Custom Report (should work after fix)',
      payload: {
        startDate: '2024-09-01',
        endDate: '2024-09-30',
        fields: ['Announcements', 'SchoolCalendar'],
        includeImages: false
      }
    },
    {
      name: 'Invalid - No date fields (should fail)',
      payload: {
        fields: ['Announcements', 'SchoolCalendar'],
        includeImages: false
      }
    },
    {
      name: 'Invalid - Bad date format (should fail)',
      payload: {
        startDate: '2024/09/26',
        endDate: '2024/09/26',
        fields: ['Announcements', 'SchoolCalendar'],
        includeImages: false
      }
    },
    {
      name: 'Invalid - Missing fields (should fail)',
      payload: {
        month: '2024-09',
        includeImages: false
      }
    },
    {
      name: 'Invalid - Empty fields array (should fail)',
      payload: {
        month: '2024-09',
        fields: [],
        includeImages: false
      }
    }
  ];

  console.log(`🧪 [TEST] Testing Report Validation against ${baseURL}...\n`);

  for (const testCase of testCases) {
    console.log(`📋 [TEST] Testing: ${testCase.name}`);
    console.log(`📤 [TEST] Payload:`, JSON.stringify(testCase.payload, null, 2));

    try {
      console.log(`🔄 [TEST] Making POST request to ${baseURL}/api/reports/generate`);

      const response = await axios.post(`${baseURL}/api/reports/generate`, testCase.payload, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 15000
      });

      console.log(`✅ [TEST] Success: ${response.status} ${response.statusText}`);
      console.log(`📊 [TEST] Response data:`, JSON.stringify(response.data, null, 2));

      if (response.data?.data?.report?.items) {
        console.log(`📈 [TEST] Report contains ${response.data.data.report.items.length} items`);
      }

    } catch (error) {
      if (error.response) {
        console.log(`❌ [TEST] HTTP Error: ${error.response.status} ${error.response.statusText}`);
        console.log(`📝 [TEST] Error response:`, JSON.stringify(error.response.data, null, 2));

        // Log specific validation errors
        if (error.response.data?.error?.details) {
          console.log(`🔍 [TEST] Validation details:`);
          error.response.data.error.details.forEach((detail, index) => {
            console.log(`   ${index + 1}. Field: ${detail.field}, Message: ${detail.message}, Value: ${detail.value}`);
          });
        }
      } else if (error.code === 'ECONNREFUSED') {
        console.log(`❌ [TEST] Connection Error: Server not running on ${baseURL}`);
        break;
      } else if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
        console.log(`❌ [TEST] Network Error: ${error.message}`);
      } else {
        console.log(`❌ [TEST] Unexpected Error:`, error.message);
        console.log(`🔍 [TEST] Error details:`, error);
      }
    }

    console.log('─'.repeat(80));

    // Add a small delay between requests to avoid overwhelming the server
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('🏁 [TEST] All test cases completed');
}

// Run the test
testReportValidation().catch(console.error);
