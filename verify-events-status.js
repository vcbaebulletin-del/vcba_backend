const database = require('./src/config/database');

async function verifyEventsStatus() {
  try {
    console.log('🔍 Verifying current status of events 1564 and 1565...\n');

    // Check current status
    const events = await database.query(`
      SELECT 
        calendar_id, 
        title, 
        event_date, 
        end_date, 
        is_active, 
        is_alert, 
        is_published,
        deleted_at,
        created_at,
        updated_at
      FROM school_calendar 
      WHERE calendar_id IN (1564, 1565)
      ORDER BY calendar_id
    `);

    console.log('📅 Current Event Status:');
    console.log('========================');
    events.forEach(event => {
      console.log(`Event ID: ${event.calendar_id}`);
      console.log(`Title: ${event.title}`);
      console.log(`Event Date: ${event.event_date}`);
      console.log(`End Date: ${event.end_date}`);
      console.log(`Is Active: ${event.is_active}`);
      console.log(`Is Alert: ${event.is_alert}`);
      console.log(`Is Published: ${event.is_published}`);
      console.log(`Deleted At: ${event.deleted_at}`);
      console.log(`Created At: ${event.created_at}`);
      console.log(`Updated At: ${event.updated_at}`);
      console.log('---');
    });

    // Check if they would be returned by the API query
    const apiEvents = await database.query(`
      SELECT
        sc.*,
        c.name as category_name
      FROM school_calendar sc
      LEFT JOIN categories c ON sc.category_id = c.category_id
      WHERE sc.deleted_at IS NULL 
        AND sc.is_active = 1
        AND sc.calendar_id IN (1564, 1565)
      ORDER BY sc.event_date ASC
    `);

    console.log(`\n📊 Events that would be returned by API: ${apiEvents.length}`);
    apiEvents.forEach(event => {
      console.log(`- ${event.title} (ID: ${event.calendar_id}, Active: ${event.is_active}, Alert: ${event.is_alert})`);
    });

    // Check recent updates to these events
    const recentUpdates = await database.query(`
      SELECT 
        calendar_id, 
        title, 
        is_active, 
        updated_at,
        end_date
      FROM school_calendar 
      WHERE calendar_id IN (1564, 1565)
        AND updated_at >= DATE_SUB(NOW(), INTERVAL 1 DAY)
      ORDER BY updated_at DESC
    `);

    console.log(`\n📝 Recent updates (last 24 hours): ${recentUpdates.length}`);
    recentUpdates.forEach(event => {
      console.log(`- ${event.title}: Active=${event.is_active}, Updated=${event.updated_at}, End=${event.end_date}`);
    });

    // Check current server time
    const serverTime = await database.query('SELECT NOW() as server_time');
    console.log(`\n🕐 Current Server Time: ${serverTime[0].server_time}`);

    // Check if there are any triggers or procedures that might affect these events
    console.log('\n🔍 Checking for database triggers...');
    try {
      const triggers = await database.query(`
        SELECT 
          TRIGGER_NAME,
          EVENT_MANIPULATION,
          EVENT_OBJECT_TABLE,
          TRIGGER_BODY
        FROM information_schema.TRIGGERS 
        WHERE EVENT_OBJECT_SCHEMA = DATABASE()
          AND EVENT_OBJECT_TABLE = 'school_calendar'
      `);
      
      console.log(`Found ${triggers.length} triggers on school_calendar table:`);
      triggers.forEach(trigger => {
        console.log(`- ${trigger.TRIGGER_NAME}: ${trigger.EVENT_MANIPULATION} on ${trigger.EVENT_OBJECT_TABLE}`);
      });
    } catch (error) {
      console.log('Could not check triggers (might not have permissions)');
    }

  } catch (error) {
    console.error('❌ Error verifying events status:', error);
  } finally {
    await database.close();
  }
}

verifyEventsStatus();
