const database = require('./src/config/database');

async function debugCalendarEvents() {
  try {
    console.log('🔍 Debugging calendar events 1564 and 1565...\n');

    // Check if events exist
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

    console.log('📅 Calendar Events Data:');
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

    // Check current server time
    const serverTime = await database.query('SELECT NOW() as server_time');
    console.log(`\n🕐 Current Server Time: ${serverTime[0].server_time}`);

    // Check what the API would return
    console.log('\n🔍 Testing API query conditions...');
    
    // Simulate the API query with default filters
    const apiEvents = await database.query(`
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
      LIMIT 50 OFFSET 0
    `);

    console.log(`\n📊 API Query Results: ${apiEvents.length} events found`);
    apiEvents.forEach(event => {
      console.log(`- ${event.title} (ID: ${event.calendar_id}, Active: ${event.is_active}, Alert: ${event.is_alert})`);
    });

    // Check if there are any archival processes that might affect these events
    console.log('\n🗄️ Checking for archival/cleanup processes...');
    
    // Check if there are any scheduled jobs or triggers
    const triggers = await database.query(`
      SHOW TRIGGERS FROM vcba_e_bulletin_board 
      WHERE \`Table\` = 'school_calendar'
    `);
    
    console.log(`Found ${triggers.length} triggers on school_calendar table:`);
    triggers.forEach(trigger => {
      console.log(`- ${trigger.Trigger}: ${trigger.Event} ${trigger.Timing}`);
    });

    // Check for any events that might have been automatically archived
    const recentlyUpdated = await database.query(`
      SELECT 
        calendar_id, 
        title, 
        is_active, 
        updated_at,
        end_date
      FROM school_calendar 
      WHERE updated_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        AND calendar_id IN (1564, 1565)
      ORDER BY updated_at DESC
    `);

    console.log(`\n📝 Recently updated events (last 7 days): ${recentlyUpdated.length}`);
    recentlyUpdated.forEach(event => {
      console.log(`- ${event.title}: Active=${event.is_active}, Updated=${event.updated_at}, End=${event.end_date}`);
    });

  } catch (error) {
    console.error('❌ Error debugging calendar events:', error);
  } finally {
    await database.close();
  }
}

debugCalendarEvents();
