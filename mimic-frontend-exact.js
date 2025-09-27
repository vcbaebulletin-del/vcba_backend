// Mimic exactly what the frontend is doing
const axios = require('axios');

async function mimicFrontend() {
  try {
    console.log('🔍 MIMICKING EXACT FRONTEND REQUEST');
    console.log('===================================');
    
    // Use the exact URL from browser logs
    const cacheBuster = Date.now();
    const url = `http://localhost:5000/api/calendar?limit=50&sort_by=event_date&sort_order=ASC&_t=${cacheBuster}`;
    
    console.log('URL:', url);
    
    // Use the exact headers from frontend
    const headers = {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    };
    
    console.log('Headers:', headers);
    
    const response = await axios.get(url, { headers });
    
    console.log('Response status:', response.status);
    console.log('Response success:', response.data.success);
    
    const data = response.data;
    
    if (data.success && data.data) {
      const eventsData = data.data.events || data.data || [];
      
      console.log('\n📊 RESPONSE ANALYSIS:');
      console.log('Events count:', eventsData.length);
      console.log('Has event 1564:', eventsData.some(e => e.calendar_id === 1564));
      console.log('Has event 1565:', eventsData.some(e => e.calendar_id === 1565));
      
      console.log('\nFirst 10 event IDs:', eventsData.map(e => e.calendar_id).slice(0, 10));
      
      if (eventsData.length < 50) {
        console.log('\n❌ ISSUE FOUND: Only', eventsData.length, 'events returned instead of 50!');
        
        // Check if there's pagination or filtering happening
        console.log('\nFull response structure:');
        console.log('data keys:', Object.keys(data.data || {}));
        console.log('pagination info:', data.data.pagination || 'none');
        console.log('total available:', data.data.total || 'unknown');
        
        // Try without cache buster
        console.log('\n🔍 TESTING WITHOUT CACHE BUSTER:');
        const response2 = await axios.get('http://localhost:5000/api/calendar?limit=50&sort_by=event_date&sort_order=ASC', { headers });
        const events2 = response2.data.data.events || [];
        console.log('Events without cache buster:', events2.length);
        console.log('Has event 1564:', events2.some(e => e.calendar_id === 1564));
        console.log('Has event 1565:', events2.some(e => e.calendar_id === 1565));
        
        // Try with different limit
        console.log('\n🔍 TESTING WITH LIMIT=100:');
        const response3 = await axios.get(`http://localhost:5000/api/calendar?limit=100&sort_by=event_date&sort_order=ASC&_t=${Date.now()}`, { headers });
        const events3 = response3.data.data.events || [];
        console.log('Events with limit=100:', events3.length);
        console.log('Has event 1564:', events3.some(e => e.calendar_id === 1564));
        console.log('Has event 1565:', events3.some(e => e.calendar_id === 1565));
        
      } else {
        console.log('\n✅ Correct number of events returned');
        
        // Find target events
        const event1564 = eventsData.find(e => e.calendar_id === 1564);
        const event1565 = eventsData.find(e => e.calendar_id === 1565);
        
        if (event1564) {
          console.log('\nEvent 1564 found:', {
            title: event1564.title,
            is_active: event1564.is_active,
            is_alert: event1564.is_alert,
            event_date: event1564.event_date
          });
        }
        
        if (event1565) {
          console.log('\nEvent 1565 found:', {
            title: event1565.title,
            is_active: event1565.is_active,
            is_alert: event1565.is_alert,
            event_date: event1565.event_date
          });
        }
      }
      
    } else {
      console.log('❌ API response failed:', data);
    }
    
  } catch (error) {
    console.error('❌ Request failed:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

mimicFrontend();
