const database = require('./src/config/database');

async function debugFrontendFiltering() {
  try {
    console.log('🔍 Debugging frontend filtering logic...\n');

    // Get the events data as the API would return it
    const events = await database.query(`
      SELECT
        sc.*,
        c.name as category_name,
        c.color_code as category_color,
        s.name as subcategory_name,
        s.color_code as subcategory_color,
        CONCAT(IFNULL(ap.first_name, ''), ' ', IFNULL(ap.last_name, '')) as created_by_name,
        COALESCE(ap.profile_picture, '') as created_by_picture,
        COALESCE(reaction_counts.reaction_count, 0) as reaction_count,
        COALESCE(comment_counts.comment_count, 0) as comment_count
      FROM school_calendar sc
      LEFT JOIN categories c ON sc.category_id = c.category_id
      LEFT JOIN subcategories s ON sc.subcategory_id = s.subcategory_id
      LEFT JOIN admin_profiles ap ON sc.created_by = ap.admin_id
      LEFT JOIN (
        SELECT calendar_id, COUNT(*) as reaction_count
        FROM calendar_reactions
        GROUP BY calendar_id
      ) reaction_counts ON sc.calendar_id = reaction_counts.calendar_id
      LEFT JOIN (
        SELECT calendar_id, COUNT(*) as comment_count
        FROM comments
        WHERE calendar_id IS NOT NULL
        GROUP BY calendar_id
      ) comment_counts ON sc.calendar_id = comment_counts.calendar_id
      WHERE sc.deleted_at IS NULL 
        AND sc.is_active = 1
        AND sc.calendar_id IN (1564, 1565)
      ORDER BY sc.event_date ASC
    `);

    console.log('📅 Events from API:');
    events.forEach(event => {
      console.log(`- ${event.title} (ID: ${event.calendar_id})`);
      console.log(`  Event Date: ${event.event_date}`);
      console.log(`  End Date: ${event.end_date}`);
      console.log(`  Is Active: ${event.is_active}`);
      console.log(`  Is Alert: ${event.is_alert}`);
    });

    // Get current server time
    const serverTimeResult = await database.query('SELECT NOW() as server_time');
    const serverTime = new Date(serverTimeResult[0].server_time);
    
    console.log(`\n🕐 Server Time: ${serverTime}`);
    console.log(`Server Time ISO: ${serverTime.toISOString()}`);

    // Simulate the frontend filtering logic
    console.log('\n🔍 Simulating frontend filtering logic...\n');

    const filteredCalendarEvents = events.filter(event => {
      const matchesSearch = true; // No search term
      const matchesCategory = true; // No category filter

      // Show events that are currently active (between start and end date)
      // Use server time to prevent client-side time manipulation
      if (!serverTime) {
        // If server time is not loaded yet, don't filter by date
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

      console.log(`📊 Event: ${event.title} (ID: ${event.calendar_id})`);
      console.log(`  Today Date String: ${todayDateString}`);
      console.log(`  Event Start Date String: ${eventStartDateString}`);
      console.log(`  Event End Date String: ${eventEndDateString}`);
      console.log(`  Is Event Active (date check): ${isEventActive}`);
      console.log(`  Is Active (database): ${isActive}`);
      console.log(`  Final Result: ${matchesSearch && matchesCategory && isEventActive && isActive}`);
      console.log('  ---');

      return matchesSearch && matchesCategory && isEventActive && isActive;
    });

    console.log(`\n📊 Filtered Events: ${filteredCalendarEvents.length} out of ${events.length}`);
    filteredCalendarEvents.forEach(event => {
      console.log(`- ${event.title} (Alert: ${event.is_alert})`);
    });

    // Test the alert/regular separation
    console.log('\n🚨 Alert Events:');
    const alertCalendarEvents = filteredCalendarEvents.filter(event => Boolean(event.is_alert));
    alertCalendarEvents.forEach(event => {
      console.log(`- ${event.title} (ID: ${event.calendar_id})`);
    });

    console.log('\n📅 Regular Events:');
    const regularCalendarEvents = filteredCalendarEvents.filter(event => !Boolean(event.is_alert));
    regularCalendarEvents.forEach(event => {
      console.log(`- ${event.title} (ID: ${event.calendar_id})`);
    });

  } catch (error) {
    console.error('❌ Error debugging frontend filtering:', error);
  } finally {
    await database.close();
  }
}

debugFrontendFiltering();
