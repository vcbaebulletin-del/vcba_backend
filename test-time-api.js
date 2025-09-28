const axios = require('axios');

async function testTimeAPI() {
  try {
    console.log('🕐 Testing Time API endpoint...\n');

    // Test the time API endpoint that the frontend uses
    const response = await axios.get('http://localhost:5000/api/time/current');

    console.log('📊 API Response Status:', response.status);
    console.log('📊 API Response Success:', response.data.success);
    
    if (response.data.success && response.data.data) {
      const timeData = response.data.data;
      console.log('\n🕐 Server Time Data:');
      console.log(`  Timestamp: ${timeData.timestamp}`);
      console.log(`  Unix: ${timeData.unix}`);
      console.log(`  Timezone: ${timeData.timezone}`);
      console.log(`  Offset: ${timeData.offset}`);
      console.log(`  Formatted: ${timeData.formatted}`);
      console.log(`  Date Object: ${timeData.date.year}-${String(timeData.date.month).padStart(2, '0')}-${String(timeData.date.day).padStart(2, '0')}`);

      // Test how JavaScript Date handles this
      const jsDate = new Date(timeData.timestamp);
      console.log('\n🔍 JavaScript Date Conversion:');
      console.log(`  JS Date: ${jsDate}`);
      console.log(`  JS Date ISO: ${jsDate.toISOString()}`);
      console.log(`  JS Date Local String: ${jsDate.toLocaleDateString()}`);
      
      // Test the date string format that frontend uses
      const todayDateString = jsDate.getFullYear() + '-' +
        String(jsDate.getMonth() + 1).padStart(2, '0') + '-' +
        String(jsDate.getDate()).padStart(2, '0');
      console.log(`  Frontend Date String: ${todayDateString}`);

      // Test with our event dates
      console.log('\n📅 Event Date Conversion Test:');
      
      // Event 1564 dates from API
      const event1564Start = new Date('2025-09-23T16:00:00.000Z');
      const event1564End = new Date('2025-09-29T16:00:00.000Z');
      
      console.log('Event 1564 (Earthquake):');
      console.log(`  API Start Date: 2025-09-23T16:00:00.000Z`);
      console.log(`  JS Start Date: ${event1564Start}`);
      console.log(`  Start Date String: ${event1564Start.getFullYear()}-${String(event1564Start.getMonth() + 1).padStart(2, '0')}-${String(event1564Start.getDate()).padStart(2, '0')}`);
      console.log(`  API End Date: 2025-09-29T16:00:00.000Z`);
      console.log(`  JS End Date: ${event1564End}`);
      console.log(`  End Date String: ${event1564End.getFullYear()}-${String(event1564End.getMonth() + 1).padStart(2, '0')}-${String(event1564End.getDate()).padStart(2, '0')}`);

      // Event 1565 dates from API
      const event1565Start = new Date('2025-09-24T16:00:00.000Z');
      const event1565End = new Date('2025-09-28T16:00:00.000Z');
      
      console.log('\nEvent 1565 (Marsquake):');
      console.log(`  API Start Date: 2025-09-24T16:00:00.000Z`);
      console.log(`  JS Start Date: ${event1565Start}`);
      console.log(`  Start Date String: ${event1565Start.getFullYear()}-${String(event1565Start.getMonth() + 1).padStart(2, '0')}-${String(event1565Start.getDate()).padStart(2, '0')}`);
      console.log(`  API End Date: 2025-09-28T16:00:00.000Z`);
      console.log(`  JS End Date: ${event1565End}`);
      console.log(`  End Date String: ${event1565End.getFullYear()}-${String(event1565End.getMonth() + 1).padStart(2, '0')}-${String(event1565End.getDate()).padStart(2, '0')}`);

      // Test the filtering logic
      console.log('\n🔍 Filtering Logic Test:');
      console.log(`Today (Server): ${todayDateString}`);
      
      const event1564StartString = event1564Start.getFullYear() + '-' + String(event1564Start.getMonth() + 1).padStart(2, '0') + '-' + String(event1564Start.getDate()).padStart(2, '0');
      const event1564EndString = event1564End.getFullYear() + '-' + String(event1564End.getMonth() + 1).padStart(2, '0') + '-' + String(event1564End.getDate()).padStart(2, '0');
      
      const event1565StartString = event1565Start.getFullYear() + '-' + String(event1565Start.getMonth() + 1).padStart(2, '0') + '-' + String(event1565Start.getDate()).padStart(2, '0');
      const event1565EndString = event1565End.getFullYear() + '-' + String(event1565End.getMonth() + 1).padStart(2, '0') + '-' + String(event1565End.getDate()).padStart(2, '0');

      console.log(`Event 1564: ${event1564StartString} <= ${todayDateString} <= ${event1564EndString} = ${todayDateString >= event1564StartString && todayDateString <= event1564EndString}`);
      console.log(`Event 1565: ${event1565StartString} <= ${todayDateString} <= ${event1565EndString} = ${todayDateString >= event1565StartString && todayDateString <= event1565EndString}`);

    } else {
      console.log('❌ No time data in API response');
      console.log('Response data:', JSON.stringify(response.data, null, 2));
    }

  } catch (error) {
    console.error('❌ API Error:', error.message);
    if (error.response) {
      console.error('Response Status:', error.response.status);
      console.error('Response Data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testTimeAPI();
