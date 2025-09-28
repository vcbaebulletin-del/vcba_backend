const axios = require('axios');

async function testAuthenticatedCalendarAPI() {
  try {
    console.log('🔍 Testing Authenticated Calendar API endpoint...\n');

    // First, let's get an admin token by logging in
    console.log('1️⃣ Getting admin authentication token...');
    const loginResponse = await axios.post('http://localhost:5000/api/auth/login', {
      email: 'zaira123@gmail.com',
      password: 'password123',
      role: 'admin'
    });

    if (!loginResponse.data.success) {
      console.error('❌ Failed to login:', loginResponse.data.message);
      return;
    }

    const authToken = loginResponse.data.data.token;
    console.log('✅ Admin token obtained:', authToken.substring(0, 20) + '...');

    // Test the calendar API endpoint with authentication
    console.log('\n2️⃣ Testing calendar API with admin authentication...');
    const response = await axios.get('http://localhost:5000/api/calendar?limit=50&sort_by=event_date&sort_order=ASC', {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('📊 API Response Status:', response.status);
    console.log('📊 API Response Success:', response.data.success);
    console.log('📊 Total events returned:', response.data.data?.events?.length || 0);

    if (response.data.success && response.data.data?.events) {
      const events = response.data.data.events;
      
      // Look for our specific events
      const event1564 = events.find(e => e.calendar_id === 1564);
      const event1565 = events.find(e => e.calendar_id === 1565);
      
      console.log('\n📅 Target Events Check:');
      console.log(`   Event 1564 (Earthquake) found: ${!!event1564}`);
      console.log(`   Event 1565 (Marsquake) found: ${!!event1565}`);

      if (event1564) {
        console.log('\n🚨 Event 1564 Details:');
        console.log('   Title:', event1564.title);
        console.log('   Event Date:', event1564.event_date);
        console.log('   End Date:', event1564.end_date);
        console.log('   Is Active:', event1564.is_active);
        console.log('   Is Alert:', event1564.is_alert);
        console.log('   Is Published:', event1564.is_published);
      }

      if (event1565) {
        console.log('\n📅 Event 1565 Details:');
        console.log('   Title:', event1565.title);
        console.log('   Event Date:', event1565.event_date);
        console.log('   End Date:', event1565.end_date);
        console.log('   Is Active:', event1565.is_active);
        console.log('   Is Alert:', event1565.is_alert);
        console.log('   Is Published:', event1565.is_published);
      }

      // Show first 10 events for debugging
      console.log('\n📋 First 10 events returned:');
      events.slice(0, 10).forEach((event, index) => {
        console.log(`   ${index + 1}. ${event.title} (ID: ${event.calendar_id}, Active: ${event.is_active}, Alert: ${event.is_alert})`);
      });

      // Check if there are any active events
      const activeEvents = events.filter(e => e.is_active === 1);
      console.log(`\n📊 Active events: ${activeEvents.length} out of ${events.length}`);
      
      if (activeEvents.length > 0) {
        console.log('   Active event IDs:', activeEvents.map(e => e.calendar_id).slice(0, 10));
      }

      // Check events by date range
      const today = new Date();
      const todayString = today.getFullYear() + '-' + 
        String(today.getMonth() + 1).padStart(2, '0') + '-' + 
        String(today.getDate()).padStart(2, '0');
      
      console.log(`\n📅 Events active today (${todayString}):`);
      const todayEvents = events.filter(event => {
        const eventStartDate = new Date(event.event_date);
        const eventStartDateString = eventStartDate.getFullYear() + '-' +
          String(eventStartDate.getMonth() + 1).padStart(2, '0') + '-' +
          String(eventStartDate.getDate()).padStart(2, '0');

        const eventEndDateString = event.end_date ? (() => {
          const endDate = new Date(event.end_date);
          return endDate.getFullYear() + '-' +
            String(endDate.getMonth() + 1).padStart(2, '0') + '-' +
            String(endDate.getDate()).padStart(2, '0');
        })() : eventStartDateString;

        const isEventActive = todayString >= eventStartDateString && todayString <= eventEndDateString;
        return event.is_active === 1 && isEventActive;
      });

      console.log(`   Found ${todayEvents.length} events active today:`);
      todayEvents.forEach(event => {
        console.log(`   - ${event.title} (ID: ${event.calendar_id}, Alert: ${event.is_alert})`);
      });

    } else {
      console.error('❌ API response failed or no events data:', response.data);
    }

    // Test without authentication to compare
    console.log('\n3️⃣ Testing calendar API without authentication...');
    try {
      const noAuthResponse = await axios.get('http://localhost:5000/api/calendar?limit=50&sort_by=event_date&sort_order=ASC');
      console.log('📊 No-auth API Response Status:', noAuthResponse.status);
      console.log('📊 No-auth Total events:', noAuthResponse.data.data?.events?.length || 0);
      
      if (noAuthResponse.data.data?.events) {
        const noAuthEvents = noAuthResponse.data.data.events;
        const noAuthEvent1564 = noAuthEvents.find(e => e.calendar_id === 1564);
        const noAuthEvent1565 = noAuthEvents.find(e => e.calendar_id === 1565);
        
        console.log(`   No-auth Event 1564 found: ${!!noAuthEvent1564}`);
        console.log(`   No-auth Event 1565 found: ${!!noAuthEvent1565}`);
      }
    } catch (noAuthError) {
      console.log('📊 No-auth API failed (expected if auth required):', noAuthError.response?.status || noAuthError.message);
    }

  } catch (error) {
    console.error('❌ Error testing authenticated calendar API:', error.message);
    if (error.response) {
      console.error('Response Status:', error.response.status);
      console.error('Response Data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testAuthenticatedCalendarAPI();
