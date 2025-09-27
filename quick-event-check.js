// Quick check for events 1564 and 1565
const db = require('./src/config/database');

async function checkEvents() {
  console.log('🔍 CHECKING EVENTS 1564 AND 1565');
  console.log('=================================');

  try {
    // Check if events exist and their status
    const results = await db.query(
      'SELECT calendar_id, title, is_active, is_published, is_alert, event_date, end_date, deleted_at FROM school_calendar WHERE calendar_id IN (1564, 1565) ORDER BY calendar_id'
    );
    console.log('Events found:', results.length);

    if (results.length === 0) {
      console.log('❌ NO EVENTS FOUND! Events 1564 and 1565 do not exist in the database.');
      process.exit(1);
    }

    results.forEach(event => {
      console.log(`\n📅 Event ${event.calendar_id}:`);
      console.log('  Title:', event.title);
      console.log('  is_active:', event.is_active);
      console.log('  is_published:', event.is_published);
      console.log('  is_alert:', event.is_alert);
      console.log('  event_date:', event.event_date);
      console.log('  end_date:', event.end_date);
      console.log('  deleted_at:', event.deleted_at);

      // Check if this event should be visible
      const shouldBeVisible = event.is_active === 1 && event.deleted_at === null;
      console.log('  Should be visible:', shouldBeVisible ? '✅ YES' : '❌ NO');

      if (!shouldBeVisible) {
        if (event.is_active === 0) {
          console.log('  ⚠️ ISSUE: Event is INACTIVE (is_active = 0)');
        }
        if (event.deleted_at !== null) {
          console.log('  ⚠️ ISSUE: Event is SOFT DELETED');
        }
      }
    });

    // Check what the API would return
    console.log('\n🔍 CHECKING API QUERY RESULTS:');
    const apiResults = await db.query(
      `SELECT calendar_id, title, is_active
       FROM school_calendar
       WHERE deleted_at IS NULL AND is_active = 1
       ORDER BY event_date ASC
       LIMIT 10`
    );

    console.log('API would return these events:');
    apiResults.forEach(event => {
      console.log(`  ${event.calendar_id}: ${event.title}`);
    });

    const hasTargetEvents = apiResults.some(e => e.calendar_id === 1564 || e.calendar_id === 1565);
    console.log('\nTarget events in API results:', hasTargetEvents ? '✅ YES' : '❌ NO');

    if (!hasTargetEvents) {
      console.log('\n🎯 SOLUTION NEEDED:');
      console.log('The target events are not being returned by the API.');
      console.log('They need to be activated (is_active = 1) and not deleted.');

      // Check if we need to activate them
      const inactiveEvents = results.filter(e => e.is_active === 0);
      if (inactiveEvents.length > 0) {
        console.log('\n🔧 QUICK FIX: Run this SQL to activate the events:');
        inactiveEvents.forEach(event => {
          console.log(`UPDATE school_calendar SET is_active = 1 WHERE calendar_id = ${event.calendar_id};`);
        });
      }
    } else {
      console.log('\n✅ Events should be visible in the frontend!');
    }

  } catch (error) {
    console.error('❌ Database error:', error);
  } finally {
    process.exit(0);
  }
}

checkEvents();
