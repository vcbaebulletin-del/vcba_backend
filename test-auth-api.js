// Test API with authentication like the frontend does
const axios = require('axios');

async function testAuthAPI() {
  try {
    console.log('🔍 TESTING API WITH AUTHENTICATION');
    console.log('==================================');
    
    // Get a sample admin token (this would normally come from login)
    // For now, let's test both with and without auth
    
    console.log('\n1. Testing WITHOUT authentication:');
    const response1 = await axios.get('http://localhost:5000/api/calendar?limit=50&sort_by=event_date&sort_order=ASC');
    const events1 = response1.data.data.events || [];
    console.log('Events returned:', events1.length);
    console.log('Has event 1564:', events1.some(e => e.calendar_id === 1564));
    console.log('Has event 1565:', events1.some(e => e.calendar_id === 1565));
    
    console.log('\n2. Testing WITH fake auth token:');
    try {
      const response2 = await axios.get('http://localhost:5000/api/calendar?limit=50&sort_by=event_date&sort_order=ASC', {
        headers: {
          'Authorization': 'Bearer fake-token',
          'Content-Type': 'application/json'
        }
      });
      const events2 = response2.data.data.events || [];
      console.log('Events returned:', events2.length);
      console.log('Has event 1564:', events2.some(e => e.calendar_id === 1564));
      console.log('Has event 1565:', events2.some(e => e.calendar_id === 1565));
    } catch (authError) {
      console.log('Auth error (expected):', authError.response?.status, authError.response?.statusText);
      
      if (authError.response?.status === 401) {
        console.log('✅ API requires authentication - this might be the issue!');
        console.log('The frontend might be sending an invalid or expired token.');
      }
    }
    
    console.log('\n3. Testing with cache-busting headers (like frontend):');
    const response3 = await axios.get(`http://localhost:5000/api/calendar?limit=50&sort_by=event_date&sort_order=ASC&_t=${Date.now()}`, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
    const events3 = response3.data.data.events || [];
    console.log('Events returned:', events3.length);
    console.log('Has event 1564:', events3.some(e => e.calendar_id === 1564));
    console.log('Has event 1565:', events3.some(e => e.calendar_id === 1565));
    
    // Check if the issue is in the response structure
    console.log('\n4. Checking response structure:');
    console.log('Response structure:', {
      success: response3.data.success,
      hasData: !!response3.data.data,
      hasEvents: !!response3.data.data.events,
      eventsType: Array.isArray(response3.data.data.events) ? 'array' : typeof response3.data.data.events,
      firstEventId: events3[0]?.calendar_id,
      lastEventId: events3[events3.length - 1]?.calendar_id
    });
    
    // Show first few and last few events
    console.log('\nFirst 5 events:');
    events3.slice(0, 5).forEach(event => {
      console.log(`  ${event.calendar_id}: ${event.title} (${event.event_date})`);
    });
    
    console.log('\nLast 5 events:');
    events3.slice(-5).forEach(event => {
      console.log(`  ${event.calendar_id}: ${event.title} (${event.event_date})`);
    });
    
    // Look for our target events specifically
    const targetEvents = events3.filter(e => e.calendar_id === 1564 || e.calendar_id === 1565);
    if (targetEvents.length > 0) {
      console.log('\n✅ TARGET EVENTS FOUND:');
      targetEvents.forEach(event => {
        console.log(`  ${event.calendar_id}: ${event.title}`);
        console.log(`    is_active: ${event.is_active}`);
        console.log(`    is_alert: ${event.is_alert}`);
        console.log(`    event_date: ${event.event_date}`);
      });
    } else {
      console.log('\n❌ TARGET EVENTS NOT FOUND IN API RESPONSE');
      console.log('This confirms the issue is in the API or database query.');
    }
    
  } catch (error) {
    console.error('❌ API test failed:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

testAuthAPI();
