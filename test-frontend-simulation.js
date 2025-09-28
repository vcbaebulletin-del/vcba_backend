const axios = require('axios');

async function simulateFrontendFiltering() {
  try {
    console.log('🔍 Simulating frontend filtering logic...\n');

    // Step 1: Get server time (as frontend would)
    console.log('1️⃣ Getting server time...');
    const timeResponse = await axios.get('http://localhost:5000/api/time/current');
    const serverTimeData = timeResponse.data.data;
    const serverTime = new Date(serverTimeData.timestamp);
    
    console.log(`   Server Time: ${serverTime}`);
    console.log(`   Server Time ISO: ${serverTime.toISOString()}`);

    // Step 2: Get calendar events (as frontend would)
    console.log('\n2️⃣ Getting calendar events...');
    const calendarResponse = await axios.get('http://localhost:5000/api/calendar?limit=50&sort_by=event_date&sort_order=ASC');
    const allEvents = calendarResponse.data.data.events;
    
    console.log(`   Total events from API: ${allEvents.length}`);
    
    // Find our specific events
    const event1564 = allEvents.find(e => e.calendar_id === 1564);
    const event1565 = allEvents.find(e => e.calendar_id === 1565);
    
    console.log(`   Event 1564 found: ${!!event1564}`);
    console.log(`   Event 1565 found: ${!!event1565}`);

    if (!event1564 || !event1565) {
      console.log('❌ Events not found in API response!');
      return;
    }

    // Step 3: Simulate the frontend filtering logic exactly
    console.log('\n3️⃣ Simulating frontend filtering...');
    
    const calendarEvents = [event1564, event1565];
    const searchTerm = '';
    const filterCategory = '';

    const filteredCalendarEvents = calendarEvents.filter(event => {
      const matchesSearch = !searchTerm ||
        event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (event.description && event.description.toLowerCase().includes(searchTerm.toLowerCase()));

      // Add category filtering for calendar events (same logic as announcements)
      const matchesCategory = !filterCategory ||
        event.category_id?.toString() === filterCategory;

      // Show events that are currently active (between start and end date)
      // Use server time to prevent client-side time manipulation
      if (!serverTime) {
        // If server time is not loaded yet, don't filter by date
        console.log('⚠️ CALENDAR FILTER DEBUG: Server time not loaded yet, skipping date filtering for:', event.title);
        return matchesSearch && matchesCategory;
      }

      const todayDateString = serverTime.getFullYear() + '-' +
        String(serverTime.getMonth() + 1).padStart(2, '0') + '-' +
        String(serverTime.getDate()).padStart(2, '0');

      const eventStartDate = new Date(event.event_date);
      const eventStartDateString = eventStartDate.getFullYear() + '-' +
        String(eventStartDate.getMonth() + 1).padStart(2, '0') + '-' +
        String(eventStartDate.getDate()).padStart(2, '0');

      // If event has an end date, use it; otherwise, show for the event date only
      const eventEndDateString = event.end_date ? (() => {
        const endDate = new Date(event.end_date);
        return endDate.getFullYear() + '-' +
          String(endDate.getMonth() + 1).padStart(2, '0') + '-' +
          String(endDate.getDate()).padStart(2, '0');
      })() : eventStartDateString;

      // Event is active if server date is between start and end date (inclusive)
      const isEventActive = todayDateString >= eventStartDateString && todayDateString <= eventEndDateString;

      // For admins, show both published and unpublished events (but only currently active events)
      const isActive = Boolean(event.is_active);

      // Enhanced debugging for calendar events
      console.log('📅 CALENDAR EVENT FILTER DEBUG:', {
        title: event.title,
        calendar_id: event.calendar_id,
        event_date: event.event_date,
        end_date: event.end_date,
        is_active: event.is_active,
        is_alert: event.is_alert,
        serverTime: serverTime.toISOString(),
        todayDateString,
        eventStartDateString,
        eventEndDateString,
        matchesSearch,
        matchesCategory,
        isEventActive,
        isActive,
        finalResult: matchesSearch && matchesCategory && isEventActive && isActive
      });

      return matchesSearch && matchesCategory && isEventActive && isActive;
    });

    console.log(`\n📊 Filtered Calendar Events: ${filteredCalendarEvents.length}`);
    
    // Step 4: Simulate alert/regular separation
    console.log('\n4️⃣ Simulating alert/regular separation...');
    
    const alertCalendarEvents = filteredCalendarEvents.filter(event => Boolean(event.is_alert));
    const regularCalendarEvents = filteredCalendarEvents.filter(event => !Boolean(event.is_alert));
    
    console.log('📊 CONTENT SEPARATION DEBUG:', {
      totalCalendarEvents: calendarEvents.length,
      filteredCalendarEvents: filteredCalendarEvents.length,
      alertCalendarEvents: alertCalendarEvents.length,
      regularCalendarEvents: regularCalendarEvents.length,
      serverTime: serverTime ? serverTime.toISOString() : 'NOT_LOADED',
      serverTimeLoading: false
    });

    console.log('\n🚨 Alert Calendar Events:');
    alertCalendarEvents.forEach(event => {
      console.log(`- ${event.title} (ID: ${event.calendar_id})`);
    });

    console.log('\n📅 Regular Calendar Events:');
    regularCalendarEvents.forEach(event => {
      console.log(`- ${event.title} (ID: ${event.calendar_id})`);
    });

    // Step 5: Check if there are any issues with the post creation
    console.log('\n5️⃣ Simulating post creation...');
    
    const createSortedPosts = (items, type) => {
      return items.map(item => ({
        ...item,
        type,
        // Use end_date for events, visibility_end_at for announcements, with proper fallbacks
        sortDate: type === 'event'
          ? new Date(item.end_date || item.event_date)
          : new Date(item.visibility_end_at || item.visibility_start_at || item.created_at),
        displayDate: type === 'event'
          ? item.event_date
          : (item.visibility_start_at || item.created_at)
      })).sort((a, b) => {
        // Sort by end date ascending (posts ending sooner appear at the top)
        const dateA = a.sortDate.getTime();
        const dateB = b.sortDate.getTime();

        // Handle invalid dates by putting them at the end
        if (isNaN(dateA) && isNaN(dateB)) return 0;
        if (isNaN(dateA)) return 1;
        if (isNaN(dateB)) return -1;

        return dateA - dateB;
      });
    };

    const alertCalendarPosts = createSortedPosts(alertCalendarEvents, 'event');
    const regularCalendarPosts = createSortedPosts(regularCalendarEvents, 'event');

    console.log('\n🚨 Alert Posts (sorted by end date):');
    alertCalendarPosts.forEach(item => {
      console.log(`- ${item.title} (ends: ${item.end_date || item.event_date})`);
    });

    console.log('\n📅 Regular Posts (sorted by end date):');
    regularCalendarPosts.forEach(item => {
      console.log(`- ${item.title} (ends: ${item.end_date || item.event_date})`);
    });

  } catch (error) {
    console.error('❌ Error simulating frontend filtering:', error.message);
    if (error.response) {
      console.error('Response Status:', error.response.status);
      console.error('Response Data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

simulateFrontendFiltering();
