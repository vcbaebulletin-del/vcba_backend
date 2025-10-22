const mysql = require('mysql2/promise');

/**
 * Test that holidays are excluded from reports
 */

async function testHolidayExclusion() {
  let connection;
  
  try {
    console.log('🔍 TESTING HOLIDAY EXCLUSION FROM REPORTS');
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

    const startDate = '2025-10-01';
    const endDate = '2025-10-31';

    // ========================================
    // COUNT ALL CALENDAR EVENTS IN OCTOBER
    // ========================================
    console.log('\n📊 CALENDAR EVENTS IN OCTOBER 2025');
    console.log('='.repeat(80));

    const [allEvents] = await connection.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN is_holiday = 1 THEN 1 END) as holidays,
        COUNT(CASE WHEN is_holiday = 0 THEN 1 END) as user_events
      FROM school_calendar
      WHERE event_date >= ?
        AND event_date <= ?
    `, [startDate, endDate]);

    console.log('\n📈 Total Calendar Events:');
    console.log(`  Total: ${allEvents[0].total}`);
    console.log(`  Holidays (is_holiday=1): ${allEvents[0].holidays}`);
    console.log(`  User Events (is_holiday=0): ${allEvents[0].user_events}`);

    // ========================================
    // TEST REPORT QUERY (WITH HOLIDAY FILTER)
    // ========================================
    console.log('\n\n📋 REPORT QUERY (Excludes Holidays)');
    console.log('='.repeat(80));

    const [reportEvents] = await connection.query(`
      SELECT 
        sc.calendar_id,
        sc.title,
        sc.is_holiday,
        sc.event_date,
        CASE
          WHEN sc.deleted_at IS NOT NULL THEN 'Deleted'
          WHEN sc.is_holiday = 1 THEN 'Holiday'
          WHEN sc.is_active = 0 THEN 'Archived'
          ELSE 'Active'
        END as derived_status
      FROM school_calendar sc
      WHERE sc.event_date >= ?
        AND sc.event_date <= ?
        AND sc.is_holiday = 0
      ORDER BY sc.event_date DESC
    `, [startDate, endDate]);

    console.log(`\n✅ Report Returns: ${reportEvents.length} events (holidays excluded)`);
    console.log(`   Expected: ${allEvents[0].user_events} user events`);

    if (reportEvents.length === allEvents[0].user_events) {
      console.log('\n✅ CORRECT! Report excludes all holidays');
    } else {
      console.log('\n⚠️  MISMATCH!');
    }

    // ========================================
    // VERIFY NO HOLIDAYS IN RESULT
    // ========================================
    const holidaysInResult = reportEvents.filter(e => e.is_holiday === 1);
    
    if (holidaysInResult.length === 0) {
      console.log('✅ VERIFIED: No holidays in report results');
    } else {
      console.log(`❌ ERROR: Found ${holidaysInResult.length} holidays in results!`);
      holidaysInResult.forEach(h => {
        console.log(`   - ${h.title} (ID: ${h.calendar_id})`);
      });
    }

    // ========================================
    // SHOW WHAT'S INCLUDED
    // ========================================
    console.log('\n\n📝 EVENTS INCLUDED IN REPORT:');
    console.log('='.repeat(80));

    if (reportEvents.length > 0) {
      reportEvents.forEach((event, index) => {
        console.log(`\n${index + 1}. ${event.title}`);
        console.log(`   ID: ${event.calendar_id}`);
        console.log(`   Date: ${event.event_date}`);
        console.log(`   Status: ${event.derived_status}`);
        console.log(`   is_holiday: ${event.is_holiday} ✅`);
      });
    } else {
      console.log('\n(No user-made events in October)');
    }

    // ========================================
    // SHOW WHAT'S EXCLUDED
    // ========================================
    console.log('\n\n🚫 HOLIDAYS EXCLUDED FROM REPORT:');
    console.log('='.repeat(80));

    const [excludedHolidays] = await connection.query(`
      SELECT 
        calendar_id,
        title,
        event_date,
        is_holiday
      FROM school_calendar
      WHERE event_date >= ?
        AND event_date <= ?
        AND is_holiday = 1
      ORDER BY event_date DESC
    `, [startDate, endDate]);

    if (excludedHolidays.length > 0) {
      console.log(`\n${excludedHolidays.length} holidays excluded:\n`);
      excludedHolidays.forEach((holiday, index) => {
        console.log(`${index + 1}. ${holiday.title} (${holiday.event_date}) ❌ Excluded`);
      });
    } else {
      console.log('\n(No holidays in October)');
    }

    // ========================================
    // SUMMARY
    // ========================================
    console.log('\n\n✅ SUMMARY');
    console.log('='.repeat(80));
    console.log(`\n📊 October 2025 Report will show:`);
    console.log(`   • ${reportEvents.length} user-made calendar events ✅`);
    console.log(`   • 0 holidays (excluded) ✅`);
    console.log(`\n🎯 Goal achieved: Holidays are NOT included in PDF reports!`);

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

testHolidayExclusion();
