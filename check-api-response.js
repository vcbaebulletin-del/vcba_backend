// Check what the API actually returns
const axios = require('axios');

async function checkAPI() {
  try {
    console.log('🔍 CHECKING API RESPONSE');
    console.log('========================');
    
    const response = await axios.get('http://localhost:5000/api/calendar?limit=50&sort_by=event_date&sort_order=ASC');
    const events = response.data.data.events || [];
    
    console.log('Total events returned:', events.length);
    
    // Look for target events
    const event1564 = events.find(e => e.calendar_id === 1564);
    const event1565 = events.find(e => e.calendar_id === 1565);
    
    console.log('\nTarget events in response:');
    console.log('Event 1564 (Earthquake):', event1564 ? '✅ FOUND' : '❌ NOT FOUND');
    console.log('Event 1565 (Marsquake):', event1565 ? '✅ FOUND' : '❌ NOT FOUND');
    
    if (!event1564 && !event1565) {
      console.log('\n❌ NEITHER TARGET EVENT IS IN THE API RESPONSE!');
      console.log('\nFirst 10 events returned:');
      events.slice(0, 10).forEach((event, index) => {
        console.log(`${index + 1}. ${event.calendar_id}: ${event.title} (${event.event_date})`);
      });
      
      console.log('\nLast 10 events returned:');
      events.slice(-10).forEach((event, index) => {
        console.log(`${events.length - 9 + index}. ${event.calendar_id}: ${event.title} (${event.event_date})`);
      });
      
      // Check if we need more events
      console.log('\n🔧 SOLUTION: Try increasing the limit to get more events');
      
      // Test with higher limit
      console.log('\n🔍 TESTING WITH HIGHER LIMIT (100 events):');
      const response2 = await axios.get('http://localhost:5000/api/calendar?limit=100&sort_by=event_date&sort_order=ASC');
      const events2 = response2.data.data.events || [];
      
      const event1564_2 = events2.find(e => e.calendar_id === 1564);
      const event1565_2 = events2.find(e => e.calendar_id === 1565);
      
      console.log('With limit=100:');
      console.log('Event 1564 (Earthquake):', event1564_2 ? '✅ FOUND' : '❌ NOT FOUND');
      console.log('Event 1565 (Marsquake):', event1565_2 ? '✅ FOUND' : '❌ NOT FOUND');
      
      if (event1564_2 || event1565_2) {
        console.log('\n🎯 SOLUTION FOUND: The events exist but the limit=50 is too low!');
        console.log('The frontend needs to request more events or filter by date range.');
      } else {
        console.log('\n❌ Even with limit=100, events are not found. There may be a deeper issue.');
      }
    } else {
      console.log('\n✅ Target events found in API response!');
      if (event1564) {
        console.log('Event 1564 details:', {
          title: event1564.title,
          is_active: event1564.is_active,
          is_alert: event1564.is_alert,
          event_date: event1564.event_date
        });
      }
      if (event1565) {
        console.log('Event 1565 details:', {
          title: event1565.title,
          is_active: event1565.is_active,
          is_alert: event1565.is_alert,
          event_date: event1565.event_date
        });
      }
    }
    
  } catch (error) {
    console.error('❌ API check failed:', error.message);
  }
}

checkAPI();
