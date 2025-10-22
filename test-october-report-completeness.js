const mysql = require('mysql2/promise');

/**
 * Test if October report includes ALL posts regardless of status
 */

async function testReportCompleteness() {
  let connection;
  
  try {
    console.log('🔍 TESTING OCTOBER REPORT COMPLETENESS');
    console.log('='.repeat(80));
    
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

    const startDate = '2025-10-01 00:00:00';
    const endDate = '2025-10-31 23:59:59';

    // ========================================
    // TEST ANNOUNCEMENTS
    // ========================================
    console.log('\n📢 ANNOUNCEMENTS IN OCTOBER 2025');
    console.log('='.repeat(80));

    // Count ALL announcements with visibility_start_at in October
    const [allAnnouncements] = await connection.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN deleted_at IS NOT NULL THEN 1 END) as deleted,
        COUNT(CASE WHEN archived_at IS NOT NULL OR status = 'archived' THEN 1 END) as archived,
        COUNT(CASE WHEN status = 'published' AND deleted_at IS NULL AND archived_at IS NULL THEN 1 END) as published,
        COUNT(CASE WHEN status = 'draft' THEN 1 END) as draft,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending
      FROM announcements
      WHERE visibility_start_at >= ?
        AND visibility_start_at <= ?
    `, [startDate, endDate]);

    console.log('\n📊 Total Announcements by Status:');
    console.log(`  Total: ${allAnnouncements[0].total}`);
    console.log(`  Published: ${allAnnouncements[0].published}`);
    console.log(`  Archived: ${allAnnouncements[0].archived}`);
    console.log(`  Deleted: ${allAnnouncements[0].deleted}`);
    console.log(`  Draft: ${allAnnouncements[0].draft}`);
    console.log(`  Pending: ${allAnnouncements[0].pending}`);

    // Get what the report query would return
    const [reportAnnouncements] = await connection.query(`
      SELECT 
        a.announcement_id,
        a.title,
        a.status,
        a.deleted_at,
        a.archived_at,
        a.visibility_start_at,
        CASE
          WHEN a.deleted_at IS NOT NULL THEN 'Deleted'
          WHEN a.archived_at IS NOT NULL OR a.status = 'archived' THEN 'Archived'
          ELSE COALESCE(a.status, 'Unknown')
        END as derived_status
      FROM announcements a
      WHERE a.visibility_start_at >= ?
        AND a.visibility_start_at <= ?
      ORDER BY a.visibility_start_at DESC
    `, [startDate, endDate]);

    console.log(`\n📋 Report Query Returns: ${reportAnnouncements.length} announcements`);

    if (reportAnnouncements.length !== allAnnouncements[0].total) {
      console.log(`\n⚠️  MISMATCH! Expected ${allAnnouncements[0].total} but got ${reportAnnouncements.length}`);
    } else {
      console.log('\n✅ Report includes ALL announcements');
    }

    // Show sample of each status
    console.log('\n📝 Sample Announcements:');
    console.log('-'.repeat(80));
    const statuses = ['Published', 'Archived', 'Deleted', 'Draft'];
    statuses.forEach(status => {
      const sample = reportAnnouncements.find(a => a.derived_status.toLowerCase() === status.toLowerCase());
      if (sample) {
        console.log(`\n  ${status}:`);
        console.log(`    Title: ${sample.title}`);
        console.log(`    ID: ${sample.announcement_id}`);
        console.log(`    Status: ${sample.status}`);
        console.log(`    Derived: ${sample.derived_status}`);
        console.log(`    Deleted: ${sample.deleted_at ? 'Yes' : 'No'}`);
        console.log(`    Archived: ${sample.archived_at ? 'Yes' : 'No'}`);
      }
    });

    // ========================================
    // TEST CALENDAR EVENTS
    // ========================================
    console.log('\n\n📅 CALENDAR EVENTS IN OCTOBER 2025');
    console.log('='.repeat(80));

    // Count ALL calendar events with event_date in October
    const [allEvents] = await connection.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN deleted_at IS NOT NULL THEN 1 END) as deleted,
        COUNT(CASE WHEN is_active = 0 AND deleted_at IS NULL THEN 1 END) as archived,
        COUNT(CASE WHEN is_active = 1 AND deleted_at IS NULL THEN 1 END) as active,
        COUNT(CASE WHEN is_holiday = 1 THEN 1 END) as holidays,
        COUNT(CASE WHEN is_holiday = 0 THEN 1 END) as user_events
      FROM school_calendar
      WHERE event_date >= '2025-10-01'
        AND event_date <= '2025-10-31'
    `);

    console.log('\n📊 Total Calendar Events by Status:');
    console.log(`  Total: ${allEvents[0].total}`);
    console.log(`  Active: ${allEvents[0].active}`);
    console.log(`  Archived: ${allEvents[0].archived}`);
    console.log(`  Deleted: ${allEvents[0].deleted}`);
    console.log(`  Holidays: ${allEvents[0].holidays}`);
    console.log(`  User Events: ${allEvents[0].user_events}`);

    // Get what the report query would return
    const [reportEvents] = await connection.query(`
      SELECT 
        sc.calendar_id,
        sc.title,
        sc.is_active,
        sc.is_holiday,
        sc.deleted_at,
        sc.event_date,
        CASE
          WHEN sc.deleted_at IS NOT NULL THEN 'Deleted'
          WHEN sc.is_holiday = 1 THEN 'Holiday'
          WHEN sc.is_active = 0 THEN 'Archived'
          ELSE 'Active'
        END as derived_status
      FROM school_calendar sc
      WHERE sc.event_date >= '2025-10-01'
        AND sc.event_date <= '2025-10-31'
      ORDER BY sc.event_date DESC
    `);

    console.log(`\n📋 Report Query Returns: ${reportEvents.length} calendar events`);

    if (reportEvents.length !== allEvents[0].total) {
      console.log(`\n⚠️  MISMATCH! Expected ${allEvents[0].total} but got ${reportEvents.length}`);
    } else {
      console.log('\n✅ Report includes ALL calendar events');
    }

    // Show sample of each status
    console.log('\n📝 Sample Calendar Events:');
    console.log('-'.repeat(80));
    const eventStatuses = ['Active', 'Archived', 'Deleted', 'Holiday'];
    eventStatuses.forEach(status => {
      const sample = reportEvents.find(e => e.derived_status === status);
      if (sample) {
        console.log(`\n  ${status}:`);
        console.log(`    Title: ${sample.title}`);
        console.log(`    ID: ${sample.calendar_id}`);
        console.log(`    is_active: ${sample.is_active}`);
        console.log(`    is_holiday: ${sample.is_holiday}`);
        console.log(`    Derived: ${sample.derived_status}`);
        console.log(`    Deleted: ${sample.deleted_at ? 'Yes' : 'No'}`);
      }
    });

    // ========================================
    // SUMMARY
    // ========================================
    console.log('\n\n📊 SUMMARY');
    console.log('='.repeat(80));
    
    const announcementMatch = reportAnnouncements.length === allAnnouncements[0].total;
    const eventsMatch = reportEvents.length === allEvents[0].total;

    if (announcementMatch && eventsMatch) {
      console.log('\n✅ SUCCESS! Report includes ALL posts regardless of status');
      console.log(`   • ${reportAnnouncements.length} announcements (including deleted & archived)`);
      console.log(`   • ${reportEvents.length} calendar events (including deleted, archived & holidays)`);
    } else {
      console.log('\n⚠️  ISSUE FOUND:');
      if (!announcementMatch) {
        console.log(`   • Announcements: Missing ${allAnnouncements[0].total - reportAnnouncements.length} records`);
      }
      if (!eventsMatch) {
        console.log(`   • Calendar Events: Missing ${allEvents[0].total - reportEvents.length} records`);
      }
    }

    console.log('\n' + '='.repeat(80));

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 Disconnected from database\n');
    }
  }
}

testReportCompleteness();
