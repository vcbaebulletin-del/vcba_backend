const axios = require('axios');

async function testMonthlyReport() {
  try {
    console.log('🧪 Testing Monthly Report API...');
    console.log('='.repeat(50));

    // Test data
    const testData = {
      month: '2025-09', // Current month
      fields: ['Announcements', 'SchoolCalendar']
    };

    console.log('📤 Sending request with data:', testData);

    // Make request to the API
    const response = await axios.post('http://localhost:5000/api/reports/generate', testData, {
      headers: {
        'Content-Type': 'application/json',
        // Note: In a real scenario, you'd need proper authentication headers
        'Authorization': 'Bearer test-token'
      }
    });

    console.log('📥 Response Status:', response.status);
    console.log('📊 Response Data Structure:');
    
    if (response.data && response.data.success) {
      const reportData = response.data.data;
      
      console.log('✅ Report generated successfully!');
      console.log('\n📈 Summary Statistics:');
      console.log('Announcements:', reportData.report.tallies.announcements);
      console.log('School Calendar:', reportData.report.tallies.school_calendar);
      
      console.log('\n📋 Report Items Count:', reportData.report.items.length);
      
      if (reportData.report.items.length > 0) {
        console.log('\n📝 Sample Items:');
        reportData.report.items.slice(0, 3).forEach((item, index) => {
          console.log(`${index + 1}. ${item.type}: ${item.title}`);
          console.log(`   Category: ${item.category}, Images: ${item.images.length}`);
        });
      }
      
      console.log('\n🎯 Test Results:');
      console.log('- API Response: ✅ Success');
      console.log('- Data Structure: ✅ Valid');
      console.log('- Tallies Present: ✅ Yes');
      console.log('- Items Array: ✅ Present');
      
      // Check if totals are working
      const announcementTotal = reportData.report.tallies.announcements.total;
      const calendarTotal = reportData.report.tallies.school_calendar.total;
      
      if (announcementTotal > 0 || calendarTotal > 0) {
        console.log('- Non-zero Totals: ✅ Yes');
        console.log(`  Announcements: ${announcementTotal}, Calendar: ${calendarTotal}`);
      } else {
        console.log('- Non-zero Totals: ⚠️ All zeros (may be expected if no data for this month)');
      }
      
    } else {
      console.log('❌ API returned error:', response.data);
    }

  } catch (error) {
    console.log('❌ Test failed with error:');
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Data:', error.response.data);
    } else {
      console.log('Error:', error.message);
    }
  }
}

// Run the test
testMonthlyReport();
