// Test frontend CORS issue resolution
const axios = require('axios');

async function testFrontendCORS() {
  try {
    console.log('🧪 Testing CORS with cache-control header...');
    
    const response = await axios.get('http://localhost:5000/api/calendar?limit=50&_t=' + Date.now(), {
      headers: {
        'cache-control': 'no-cache',
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ CORS Test Successful!');
    console.log('Status:', response.status);
    console.log('Events returned:', response.data.data?.events?.length || 0);
    
    // Look for our specific events
    const events = response.data.data?.events || [];
    const event1564 = events.find(e => e.calendar_id === 1564);
    const event1565 = events.find(e => e.calendar_id === 1565);
    
    console.log('\n📅 Target Events Status:');
    console.log('Event 1564 (Earthquake):', event1564 ? '✅ Found' : '❌ Not found');
    console.log('Event 1565 (Marsquake):', event1565 ? '✅ Found' : '❌ Not found');
    
    if (event1564) {
      console.log('Event 1564 details:', {
        title: event1564.title,
        is_active: event1564.is_active,
        is_alert: event1564.is_alert,
        event_date: event1564.event_date,
        end_date: event1564.end_date
      });
    }
    
    if (event1565) {
      console.log('Event 1565 details:', {
        title: event1565.title,
        is_active: event1565.is_active,
        is_alert: event1565.is_alert,
        event_date: event1565.event_date,
        end_date: event1565.end_date
      });
    }
    
  } catch (error) {
    console.error('❌ CORS Test Failed:', error.message);
    if (error.response) {
      console.error('Response Status:', error.response.status);
      console.error('Response Headers:', error.response.headers);
    }
  }
}

testFrontendCORS();
