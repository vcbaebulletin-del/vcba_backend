const axios = require('axios');

async function testCalendarAPI() {
  try {
    console.log('🔍 Testing Calendar API endpoint...\n');

    // Test the calendar API endpoint that the frontend uses
    const response = await axios.get('http://localhost:5000/api/calendar?limit=50&sort_by=event_date&sort_order=ASC', {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log('📊 API Response Status:', response.status);
    console.log('📊 API Response Success:', response.data.success);
    
    if (response.data.success && response.data.data?.events) {
      const events = response.data.data.events;
      console.log(`📊 Total Events Returned: ${events.length}\n`);

      // Look for our specific events
      const event1564 = events.find(e => e.calendar_id === 1564);
      const event1565 = events.find(e => e.calendar_id === 1565);

      console.log('🔍 Looking for specific events:');
      console.log(`Event 1564 (Earthquake) found: ${!!event1564}`);
      console.log(`Event 1565 (Marsquake) found: ${!!event1565}\n`);

      if (event1564) {
        console.log('📅 Event 1564 (Earthquake) details:');
        console.log(`  Calendar ID: ${event1564.calendar_id}`);
        console.log(`  Title: ${event1564.title}`);
        console.log(`  Event Date: ${event1564.event_date}`);
        console.log(`  End Date: ${event1564.end_date}`);
        console.log(`  Is Active: ${event1564.is_active}`);
        console.log(`  Is Alert: ${event1564.is_alert}`);
        console.log(`  Is Published: ${event1564.is_published}`);
        console.log(`  Category ID: ${event1564.category_id}`);
        console.log(`  Created By: ${event1564.created_by_name}`);
        console.log('');
      }

      if (event1565) {
        console.log('📅 Event 1565 (Marsquake) details:');
        console.log(`  Calendar ID: ${event1565.calendar_id}`);
        console.log(`  Title: ${event1565.title}`);
        console.log(`  Event Date: ${event1565.event_date}`);
        console.log(`  End Date: ${event1565.end_date}`);
        console.log(`  Is Active: ${event1565.is_active}`);
        console.log(`  Is Alert: ${event1565.is_alert}`);
        console.log(`  Is Published: ${event1565.is_published}`);
        console.log(`  Category ID: ${event1565.category_id}`);
        console.log(`  Created By: ${event1565.created_by_name}`);
        console.log('');
      }

      // Show all events for debugging
      console.log('📋 All Events from API:');
      events.forEach((event, index) => {
        console.log(`${index + 1}. ${event.title} (ID: ${event.calendar_id})`);
        console.log(`   Date: ${event.event_date} - ${event.end_date || 'N/A'}`);
        console.log(`   Active: ${event.is_active}, Alert: ${event.is_alert}, Published: ${event.is_published}`);
        console.log('');
      });

    } else {
      console.log('❌ No events data in API response');
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

testCalendarAPI();
