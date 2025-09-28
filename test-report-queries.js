const mysql = require('mysql2/promise');

async function testReportQueries() {
  let connection;
  
  try {
    connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'db_ebulletin_system'
    });

    console.log('🔧 Testing Report Queries for September 2024\n');

    const testDate = '2024-09-01T00:00:00.000Z';
    
    // Test announcements query (exact copy from ReportModel.js)
    console.log('📢 Testing announcements query...');
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
    
    console.log(`Found ${reportAnnouncements.length} announcements:`);
    reportAnnouncements.forEach((ann, index) => {
      console.log(`${index + 1}. ${ann.title}`);
      console.log(`   Alert: ${ann.is_alert ? 'YES' : 'NO'}`);
      console.log(`   Created: ${ann.created_at}`);
      console.log('');
    });

    // Test calendar events query (exact copy from ReportModel.js)
    console.log('📅 Testing calendar events query...');
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
    
    console.log(`Found ${reportCalendarEvents.length} calendar events:`);
    reportCalendarEvents.forEach((event, index) => {
      console.log(`${index + 1}. ${event.title}`);
      console.log(`   Alert: ${event.is_alert ? 'YES' : 'NO'}`);
      console.log(`   Created: ${event.created_at}`);
      console.log('');
    });

    // Calculate tallies like the report does
    console.log('📊 Calculating tallies...');
    const tallies = {
      announcements: { regular: 0, alert: 0, total: 0 },
      school_calendar: { regular: 0, alert: 0, total: 0 }
    };

    reportAnnouncements.forEach(announcement => {
      const category = announcement.is_alert ? 'alert' : 'regular';
      tallies.announcements[category]++;
      tallies.announcements.total++;
    });

    reportCalendarEvents.forEach(event => {
      const category = event.is_alert ? 'alert' : 'regular';
      tallies.school_calendar[category]++;
      tallies.school_calendar.total++;
    });

    console.log('Final tallies:');
    console.log('Announcements:', tallies.announcements);
    console.log('School Calendar:', tallies.school_calendar);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

testReportQueries();
