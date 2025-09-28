const mysql = require('mysql2/promise');

async function debugSeptemberData() {
  let connection;
  
  try {
    // Create database connection
    connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'db_ebulletin_system'
    });

    console.log('🔍 Debugging September 2024 Data for Reports\n');
    console.log('Connected to database successfully!');

    // Check announcements for September 2024
    console.log('📢 ANNOUNCEMENTS FOR SEPTEMBER 2024:');
    console.log('='.repeat(60));
    
    const [announcements] = await connection.execute(`
      SELECT 
        announcement_id,
        title,
        content,
        is_alert,
        status,
        created_at,
        posted_by,
        deleted_at
      FROM announcements 
      WHERE YEAR(created_at) = 2024 
        AND MONTH(created_at) = 9
      ORDER BY created_at DESC
    `);
    
    console.log(`Found ${announcements.length} announcements:`);
    announcements.forEach((ann, index) => {
      console.log(`${index + 1}. ID: ${ann.announcement_id}`);
      console.log(`   Title: ${ann.title}`);
      console.log(`   Alert: ${ann.is_alert ? 'YES' : 'NO'}`);
      console.log(`   Status: ${ann.status}`);
      console.log(`   Created: ${ann.created_at}`);
      console.log(`   Deleted: ${ann.deleted_at || 'NO'}`);
      console.log('');
    });

    // Check calendar events for September 2024
    console.log('📅 CALENDAR EVENTS FOR SEPTEMBER 2024:');
    console.log('='.repeat(60));
    
    const [calendarEvents] = await connection.execute(`
      SELECT 
        calendar_id,
        title,
        description,
        is_alert,
        is_active,
        is_published,
        event_date,
        created_at,
        created_by,
        deleted_at,
        is_holiday,
        holiday_type
      FROM school_calendar 
      WHERE YEAR(created_at) = 2024 
        AND MONTH(created_at) = 9
      ORDER BY created_at DESC
    `);
    
    console.log(`Found ${calendarEvents.length} calendar events:`);
    calendarEvents.forEach((event, index) => {
      console.log(`${index + 1}. ID: ${event.calendar_id}`);
      console.log(`   Title: ${event.title}`);
      console.log(`   Alert: ${event.is_alert ? 'YES' : 'NO'}`);
      console.log(`   Active: ${event.is_active ? 'YES' : 'NO'}`);
      console.log(`   Published: ${event.is_published ? 'YES' : 'NO'}`);
      console.log(`   Holiday: ${event.is_holiday ? 'YES' : 'NO'}`);
      console.log(`   Holiday Type: ${event.holiday_type || 'NONE'}`);
      console.log(`   Event Date: ${event.event_date}`);
      console.log(`   Created: ${event.created_at}`);
      console.log(`   Deleted: ${event.deleted_at || 'NO'}`);
      console.log('');
    });

    // Test the exact queries used by ReportModel
    console.log('🔧 TESTING REPORT MODEL QUERIES:');
    console.log('='.repeat(60));
    
    const testDate = '2024-09-01T00:00:00.000Z';
    
    // Test announcements query
    const [reportAnnouncements] = await connection.execute(`
      SELECT
        a.announcement_id,
        a.title,
        a.content,
        a.is_alert,
        a.created_at,
        a.posted_by,
        GROUP_CONCAT(
          CASE
            WHEN aa.file_path IS NOT NULL
            THEN aa.file_path
            ELSE NULL
          END
        ) as image_paths
      FROM announcements a
      LEFT JOIN announcement_attachments aa ON a.announcement_id = aa.announcement_id
        AND aa.deleted_at IS NULL
      WHERE YEAR(a.created_at) = YEAR(?)
        AND MONTH(a.created_at) = MONTH(?)
        AND a.deleted_at IS NULL
        AND a.status = 'published'
      GROUP BY a.announcement_id, a.title, a.content, a.is_alert, a.created_at, a.posted_by
      ORDER BY a.created_at DESC
    `, [testDate, testDate]);
    
    console.log(`Report query found ${reportAnnouncements.length} announcements:`);
    reportAnnouncements.forEach((ann, index) => {
      console.log(`${index + 1}. ${ann.title} (Alert: ${ann.is_alert ? 'YES' : 'NO'})`);
    });

    // Test calendar events query
    const [reportCalendarEvents] = await connection.execute(`
      SELECT
        sc.calendar_id,
        sc.title,
        sc.description,
        sc.is_alert,
        sc.event_date,
        sc.created_at,
        sc.created_by,
        GROUP_CONCAT(
          CASE
            WHEN ca.file_path IS NOT NULL
            THEN ca.file_path
            ELSE NULL
          END
        ) as image_paths
      FROM school_calendar sc
      LEFT JOIN calendar_attachments ca ON sc.calendar_id = ca.calendar_id
        AND ca.deleted_at IS NULL
      WHERE YEAR(sc.created_at) = YEAR(?)
        AND MONTH(sc.created_at) = MONTH(?)
        AND sc.deleted_at IS NULL
        AND sc.is_active = 1
        AND sc.is_published = 1
        AND (sc.is_holiday IS NULL OR sc.is_holiday = 0)
        AND sc.holiday_type IS NULL
      GROUP BY sc.calendar_id, sc.title, sc.description, sc.is_alert, sc.event_date, sc.created_at, sc.created_by
      ORDER BY sc.created_at DESC
    `, [testDate, testDate]);
    
    console.log(`Report query found ${reportCalendarEvents.length} calendar events:`);
    reportCalendarEvents.forEach((event, index) => {
      console.log(`${index + 1}. ${event.title} (Alert: ${event.is_alert ? 'YES' : 'NO'})`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run the debug script
debugSeptemberData();
