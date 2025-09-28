const axios = require('axios');

async function testReportAPI() {
  try {
    console.log('🔧 Testing Report API Endpoint\n');

    // Test the report generation endpoint
    const requestData = {
      month: '2024-09',
      fields: ['Announcements', 'SchoolCalendar']
    };

    console.log('📤 Sending request to /api/reports/generate');
    console.log('Request data:', JSON.stringify(requestData, null, 2));

    const response = await axios.post('http://localhost:5000/api/reports/generate', requestData, {
      headers: {
        'Content-Type': 'application/json',
        // Add a test admin token if needed - you might need to get this from login
        'Authorization': 'Bearer test-token'
      },
      timeout: 10000
    });

    console.log('\n📥 Response received:');
    console.log('Status:', response.status);
    console.log('Data:', JSON.stringify(response.data, null, 2));

    if (response.data && response.data.data && response.data.data.report) {
      const report = response.data.data.report;
      console.log('\n📊 Report Summary:');
      console.log('Title:', report.title);
      console.log('Announcements tallies:', report.tallies.announcements);
      console.log('School calendar tallies:', report.tallies.school_calendar);
      console.log('Total items:', report.items.length);
      
      if (report.items.length > 0) {
        console.log('\n📝 First few items:');
        report.items.slice(0, 3).forEach((item, index) => {
          console.log(`${index + 1}. ${item.title} (${item.type}, ${item.category})`);
        });
      }
    }

  } catch (error) {
    console.error('❌ Error testing API:', error.message);
    
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      console.error('No response received. Is the server running on port 5000?');
    }
  }
}

testReportAPI();
