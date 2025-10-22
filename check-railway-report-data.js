const mysql = require('mysql2/promise');

/**
 * Script to analyze Railway database for report status accuracy issues
 * Checks announcements and calendar events for October 2025
 */

async function analyzeReportData() {
  let connection;
  
  try {
    console.log('🔍 Connecting to Railway database...\n');
    
    // Connect to Railway database
    connection = await mysql.createConnection({
      host: 'centerbeam.proxy.rlwy.net',
      port: 14376,
      user: 'root',
      password: 'TtTMjTElsEGhDREYyaIBcNyjbQGajuqi',
      database: 'railway',
      timezone: '+08:00'
    });

    await connection.query("SET time_zone = '+08:00'");
    console.log('✅ Connected to Railway database\n');
    console.log('='.repeat(80));

    // Get current time in Philippines timezone
    const [currentTimeResult] = await connection.query("SELECT NOW() as `current_time`");
    const currentTime = currentTimeResult[0].current_time;
    console.log(`📅 Current Database Time (Asia/Manila): ${currentTime}\n`);
    console.log('='.repeat(80));

    // ========================================
    // ANALYZE ANNOUNCEMENTS FOR OCTOBER 2025
    // ========================================
    console.log('\n📢 ANNOUNCEMENTS ANALYSIS FOR OCTOBER 2025');
    console.log('='.repeat(80));

    const announcementsQuery = `
      SELECT
        announcement_id,
        title,
        status,
        visibility_start_at,
        visibility_end_at,
        created_at,
        deleted_at,
        archived_at,
        CASE
          WHEN deleted_at IS NOT NULL THEN 'Deleted'
          WHEN archived_at IS NOT NULL OR status = 'archived' THEN 'Archived'
          ELSE COALESCE(status, 'Unknown')
        END as derived_status,
        CASE
          WHEN visibility_end_at IS NOT NULL AND visibility_end_at < NOW() THEN 'EXPIRED'
          WHEN visibility_end_at IS NOT NULL AND visibility_end_at >= NOW() THEN 'ACTIVE'
          ELSE 'NO_END_DATE'
        END as expiration_status
      FROM announcements
      WHERE visibility_start_at >= '2025-10-01 00:00:00'
        AND visibility_start_at <= '2025-10-31 23:59:59'
      ORDER BY visibility_start_at DESC
    `;

    const [announcements] = await connection.query(announcementsQuery);
    
    console.log(`\nTotal Announcements in October 2025: ${announcements.length}\n`);

    if (announcements.length > 0) {
      console.log('Detailed Analysis:');
      console.log('-'.repeat(80));
      
      let expiredButNotArchived = 0;
      let correctlyArchived = 0;
      let activeAndValid = 0;

      announcements.forEach((ann, index) => {
        console.log(`\n${index + 1}. ${ann.title}`);
        console.log(`   ID: ${ann.announcement_id}`);
        console.log(`   Raw Status: ${ann.status}`);
        console.log(`   Derived Status: ${ann.derived_status}`);
        console.log(`   Visibility Start: ${ann.visibility_start_at}`);
        console.log(`   Visibility End: ${ann.visibility_end_at || 'No End Date'}`);
        console.log(`   Expiration Status: ${ann.expiration_status}`);
        console.log(`   Deleted At: ${ann.deleted_at || 'Not Deleted'}`);
        console.log(`   Archived At: ${ann.archived_at || 'Not Archived'}`);

        // Check for issues
        if (ann.expiration_status === 'EXPIRED' && ann.derived_status !== 'Archived' && ann.derived_status !== 'Deleted') {
          console.log(`   ⚠️  ISSUE: Expired but showing as "${ann.derived_status}" instead of "Archived"`);
          expiredButNotArchived++;
        } else if (ann.expiration_status === 'EXPIRED' && ann.derived_status === 'Archived') {
          console.log(`   ✅ Correctly archived`);
          correctlyArchived++;
        } else if (ann.expiration_status === 'ACTIVE') {
          console.log(`   ✅ Active and valid`);
          activeAndValid++;
        }
      });

      console.log('\n' + '='.repeat(80));
      console.log('ANNOUNCEMENTS SUMMARY:');
      console.log(`  Total: ${announcements.length}`);
      console.log(`  ✅ Active and Valid: ${activeAndValid}`);
      console.log(`  ✅ Correctly Archived: ${correctlyArchived}`);
      console.log(`  ⚠️  Expired but NOT Archived: ${expiredButNotArchived}`);
      console.log('='.repeat(80));
    }

    // ========================================
    // ANALYZE CALENDAR EVENTS FOR OCTOBER 2025
    // ========================================
    console.log('\n\n📅 CALENDAR EVENTS ANALYSIS FOR OCTOBER 2025');
    console.log('='.repeat(80));

    const calendarQuery = `
      SELECT
        calendar_id,
        title,
        event_date,
        end_date,
        created_at,
        is_active,
        is_published,
        deleted_at,
        CASE
          WHEN deleted_at IS NOT NULL THEN 'Deleted'
          WHEN is_active = 0 THEN 'Archived'
          ELSE 'Active'
        END as derived_status,
        CASE
          WHEN end_date IS NOT NULL AND end_date < CURDATE() THEN 'EXPIRED'
          WHEN end_date IS NOT NULL AND end_date >= CURDATE() THEN 'ACTIVE'
          WHEN event_date < CURDATE() THEN 'PAST_EVENT'
          ELSE 'UPCOMING'
        END as expiration_status
      FROM school_calendar
      WHERE event_date >= '2025-10-01'
        AND event_date <= '2025-10-31'
      ORDER BY event_date DESC
    `;

    const [calendarEvents] = await connection.query(calendarQuery);
    
    console.log(`\nTotal Calendar Events in October 2025: ${calendarEvents.length}\n`);

    if (calendarEvents.length > 0) {
      console.log('Detailed Analysis:');
      console.log('-'.repeat(80));
      
      let expiredButActive = 0;
      let correctlyArchived = 0;
      let activeAndValid = 0;

      calendarEvents.forEach((event, index) => {
        console.log(`\n${index + 1}. ${event.title}`);
        console.log(`   ID: ${event.calendar_id}`);
        console.log(`   is_active: ${event.is_active}`);
        console.log(`   Derived Status: ${event.derived_status}`);
        console.log(`   Event Date: ${event.event_date}`);
        console.log(`   End Date: ${event.end_date || 'No End Date'}`);
        console.log(`   Expiration Status: ${event.expiration_status}`);
        console.log(`   Deleted At: ${event.deleted_at || 'Not Deleted'}`);
        console.log(`   is_published: ${event.is_published}`);

        // Check for issues
        if ((event.expiration_status === 'EXPIRED' || event.expiration_status === 'PAST_EVENT') && 
            event.is_active === 1 && event.deleted_at === null) {
          console.log(`   ⚠️  ISSUE: Expired/Past but is_active=1 (showing as "Active" instead of "Archived")`);
          expiredButActive++;
        } else if ((event.expiration_status === 'EXPIRED' || event.expiration_status === 'PAST_EVENT') && 
                   event.is_active === 0) {
          console.log(`   ✅ Correctly archived (is_active=0)`);
          correctlyArchived++;
        } else if (event.expiration_status === 'ACTIVE' || event.expiration_status === 'UPCOMING') {
          console.log(`   ✅ Active and valid`);
          activeAndValid++;
        }
      });

      console.log('\n' + '='.repeat(80));
      console.log('CALENDAR EVENTS SUMMARY:');
      console.log(`  Total: ${calendarEvents.length}`);
      console.log(`  ✅ Active and Valid: ${activeAndValid}`);
      console.log(`  ✅ Correctly Archived: ${correctlyArchived}`);
      console.log(`  ⚠️  Expired but is_active=1: ${expiredButActive}`);
      console.log('='.repeat(80));
    }

    // ========================================
    // CHECK CRON JOB EXECUTION
    // ========================================
    console.log('\n\n🤖 CHECKING CRON JOB EXECUTION HISTORY');
    console.log('='.repeat(80));

    // Check if there's an audit log or system log table
    const [tables] = await connection.query("SHOW TABLES LIKE '%log%'");
    console.log('\nAvailable log tables:', tables.map(t => Object.values(t)[0]).join(', '));

    // Check last update times
    console.log('\n📊 Last Update Times:');
    
    const [lastAnnouncementUpdate] = await connection.query(`
      SELECT MAX(updated_at) as last_update
      FROM announcements
      WHERE archived_at IS NOT NULL
    `);
    console.log(`  Last Announcement Archival: ${lastAnnouncementUpdate[0].last_update || 'Never'}`);

    const [lastCalendarUpdate] = await connection.query(`
      SELECT MAX(updated_at) as last_update
      FROM school_calendar
      WHERE is_active = 0 AND deleted_at IS NULL
    `);
    console.log(`  Last Calendar Archival: ${lastCalendarUpdate[0].last_update || 'Never'}`);

    // ========================================
    // RECOMMENDATIONS
    // ========================================
    console.log('\n\n💡 RECOMMENDATIONS');
    console.log('='.repeat(80));

    // Get the counters from the analysis above
    let expiredButNotArchivedAnn = 0;
    let expiredButActiveCalendar = 0;
    
    // Re-count for summary
    announcements.forEach(ann => {
      if (ann.expiration_status === 'EXPIRED' && ann.derived_status !== 'Archived' && ann.derived_status !== 'Deleted') {
        expiredButNotArchivedAnn++;
      }
    });
    
    calendarEvents.forEach(event => {
      if ((event.expiration_status === 'EXPIRED' || event.expiration_status === 'PAST_EVENT') && 
          event.is_active === 1 && event.deleted_at === null) {
        expiredButActiveCalendar++;
      }
    });

    const totalIssues = expiredButNotArchivedAnn + expiredButActiveCalendar;
    
    if (totalIssues > 0) {
      console.log(`\n⚠️  Found ${totalIssues} records with status issues:\n`);
      
      if (expiredButNotArchivedAnn > 0) {
        console.log(`   • ${expiredButNotArchivedAnn} announcements are expired but not archived`);
        console.log('     → The cron job may not be running for announcements');
        console.log('     → Check: scripts/auto-archive-expired-content.js');
      }
      
      if (expiredButActiveCalendar > 0) {
        console.log(`   • ${expiredButActiveCalendar} calendar events are expired but is_active=1`);
        console.log('     → The cron job may not be running for calendar events');
        console.log('     → Check: scripts/auto-archive-expired-content.js');
      }

      console.log('\n📋 Action Items:');
      console.log('   1. Verify cron job is scheduled and running');
      console.log('   2. Check cron job logs for errors');
      console.log('   3. Manually run: node scripts/auto-archive-expired-content.js');
      console.log('   4. Consider adding monitoring/alerting for cron job failures');
    } else {
      console.log('\n✅ No status issues found! All records have correct status.');
    }

    console.log('\n' + '='.repeat(80));

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 Disconnected from database');
    }
  }
}

// Run the analysis
analyzeReportData();
