const axios = require('axios');

async function testCalendarAPI() {
  try {
    console.log('🔍 Testing Calendar API directly...');
    
    // Test the exact API call that NewsFeed component makes
    const cacheBuster = Date.now();
    const url = `http://localhost:5000/api/calendar?limit=50&sort_by=event_date&sort_order=ASC&_t=${cacheBuster}`;
    
    console.log('📡 Making request to:', url);
    
    const response = await axios.get(url, {
      headers: {
        'cache-control': 'no-cache',
        'pragma': 'no-cache',
        'Content-Type': 'application/json'
      }
    });
    
    console.log('\n✅ API Response Status:', response.status);
    console.log('📊 Response Data Structure:');
    console.log('- Success:', response.data.success);
    console.log('- Message:', response.data.message);
    
    if (response.data.data && response.data.data.events) {
      const events = response.data.data.events;
      console.log('- Total Events Returned:', events.length);
      
      // Look for target events
      const event1564 = events.find(e => e.calendar_id === 1564);
      const event1565 = events.find(e => e.calendar_id === 1565);
      
      console.log('\n🎯 TARGET EVENTS CHECK:');
      console.log('Event 1564 (Earthquake):', event1564 ? '✅ FOUND' : '❌ NOT FOUND');
      console.log('Event 1565 (Marsquake):', event1565 ? '✅ FOUND' : '❌ NOT FOUND');
      
      if (event1564) {
        console.log('\n🚨 Event 1564 Details:');
        console.log('- Title:', event1564.title);
        console.log('- Active:', event1564.is_active);
        console.log('- Alert:', event1564.is_alert);
        console.log('- Published:', event1564.is_published);
        console.log('- Event Date:', event1564.event_date);
        console.log('- End Date:', event1564.end_date);
        console.log('- Deleted At:', event1564.deleted_at);
      }
      
      if (event1565) {
        console.log('\n📰 Event 1565 Details:');
        console.log('- Title:', event1565.title);
        console.log('- Active:', event1565.is_active);
        console.log('- Alert:', event1565.is_alert);
        console.log('- Published:', event1565.is_published);
        console.log('- Event Date:', event1565.event_date);
        console.log('- End Date:', event1565.end_date);
        console.log('- Deleted At:', event1565.deleted_at);
      }
      
      // Show first few events for context
      console.log('\n📋 First 5 Events from API:');
      events.slice(0, 5).forEach((event, index) => {
        console.log(`${index + 1}. ${event.title} (ID: ${event.calendar_id}) - Active: ${event.is_active}, Alert: ${event.is_alert}, Published: ${event.is_published}`);
      });
      
      // Check pagination info
      if (response.data.data.pagination) {
        console.log('\n📄 Pagination Info:');
        console.log('- Page:', response.data.data.pagination.page);
        console.log('- Limit:', response.data.data.pagination.limit);
        console.log('- Total:', response.data.data.pagination.total);
        console.log('- Total Pages:', response.data.data.pagination.totalPages);
      }
      
      // Filter events by current date range
      const now = new Date();
      const currentEvents = events.filter(event => {
        const eventStart = new Date(event.event_date);
        const eventEnd = event.end_date ? new Date(event.end_date) : eventStart;
        return now >= eventStart && now <= eventEnd && event.is_active;
      });
      
      console.log('\n📅 CURRENT ACTIVE EVENTS (within date range):');
      console.log('Total current events:', currentEvents.length);
      currentEvents.forEach(event => {
        console.log(`- ${event.title} (ID: ${event.calendar_id}) - Alert: ${event.is_alert ? 'YES' : 'NO'}`);
      });
      
    } else {
      console.log('❌ No events data in response');
      console.log('Full response:', JSON.stringify(response.data, null, 2));
    }
    
  } catch (error) {
    console.error('❌ API Test Failed:', error.message);
    if (error.response) {
      console.error('Response Status:', error.response.status);
      console.error('Response Data:', error.response.data);
    }
  }
}

testCalendarAPI();
