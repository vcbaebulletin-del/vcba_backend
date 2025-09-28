const axios = require('axios');

async function testReportAPI() {
  console.log('🧪 Testing Report API directly...\n');
  
  const testCases = [
    {
      name: 'Monthly Report',
      payload: {
        month: '2024-09',
        fields: ['Announcements', 'SchoolCalendar'],
        includeImages: false
      }
    },
    {
      name: 'Weekly Report',
      payload: {
        weekStart: '2024-09-01',
        weekEnd: '2024-09-07',
        fields: ['Announcements', 'SchoolCalendar'],
        includeImages: false
      }
    },
    {
      name: 'Daily Report',
      payload: {
        startDate: '2024-09-26',
        endDate: '2024-09-26',
        fields: ['Announcements', 'SchoolCalendar'],
        includeImages: false
      }
    },
    {
      name: 'Custom Report (Multi-day)',
      payload: {
        startDate: '2024-09-01',
        endDate: '2024-09-30',
        fields: ['Announcements', 'SchoolCalendar'],
        includeImages: false
      }
    }
  ];

  for (const testCase of testCases) {
    console.log(`📋 Testing: ${testCase.name}`);
    console.log(`📤 Payload:`, JSON.stringify(testCase.payload, null, 2));
    
    try {
      const response = await axios.post('http://localhost:5000/api/reports/generate', testCase.payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      });
      
      console.log(`✅ Success: ${response.status}`);
      console.log(`📊 Response:`, response.data?.success ? 'Report generated' : response.data?.message);
      
    } catch (error) {
      if (error.response) {
        console.log(`❌ Error: ${error.response.status}`);
        console.log(`📝 Message:`, error.response.data?.error?.message || error.response.data?.message);
        console.log(`🔍 Full Error:`, JSON.stringify(error.response.data, null, 2));
      } else {
        console.log(`❌ Network Error:`, error.message);
      }
    }
    
    console.log('─'.repeat(50));
  }
}

testReportAPI().catch(console.error);
