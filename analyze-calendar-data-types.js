const mysql = require('mysql2/promise');

/**
 * Script to analyze school_calendar table structure and identify
 * the difference between user-made events and API-imported holidays
 */

async function analyzeCalendarDataTypes() {
  let connection;
  
  try {
    console.log('🔍 ANALYZING SCHOOL CALENDAR DATA TYPES');
    console.log('='.repeat(80));
    console.log('Connecting to Railway database...\n');
    
    connection = await mysql.createConnection({
      host: 'centerbeam.proxy.rlwy.net',
      port: 14376,
      user: 'root',
      password: 'TtTMjTElsEGhDREYyaIBcNyjbQGajuqi',
      database: 'railway',
      timezone: '+08:00'
    });

    await connection.query("SET time_zone = '+08:00'");
    console.log('✅ Connected\n');
    console.log('='.repeat(80));

    // ========================================
    // GET TABLE STRUCTURE
    // ========================================
    console.log('\n📋 SCHOOL_CALENDAR TABLE STRUCTURE');
    console.log('='.repeat(80));

    const [columns] = await connection.query(`
      SELECT 
        COLUMN_NAME,
        DATA_TYPE,
        IS_NULLABLE,
        COLUMN_DEFAULT,
        COLUMN_COMMENT
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'railway'
        AND TABLE_NAME = 'school_calendar'
      ORDER BY ORDINAL_POSITION
    `);

    console.log('\nAll Columns:');
    columns.forEach(col => {
      console.log(`  • ${col.COLUMN_NAME} (${col.DATA_TYPE}) - Nullable: ${col.IS_NULLABLE} - Default: ${col.COLUMN_DEFAULT || 'None'}`);
      if (col.COLUMN_COMMENT) {
        console.log(`    Comment: ${col.COLUMN_COMMENT}`);
      }
    });

    // ========================================
    // SAMPLE DATA ANALYSIS
    // ========================================
    console.log('\n\n📊 SAMPLE DATA ANALYSIS');
    console.log('='.repeat(80));

    // Get sample of different types
    const [allEvents] = await connection.query(`
      SELECT 
        calendar_id,
        title,
        description,
        event_date,
        end_date,
        created_by,
        is_alert,
        is_active,
        is_published,
        is_holiday,
        created_at,
        updated_at,
        deleted_at
      FROM school_calendar
      ORDER BY created_at DESC
      LIMIT 50
    `);

    console.log(`\nTotal events in sample: ${allEvents.length}\n`);

    // Analyze patterns
    const withCreatedBy = allEvents.filter(e => e.created_by !== null);
    const withoutCreatedBy = allEvents.filter(e => e.created_by === null);
    const withIsHoliday = allEvents.filter(e => e.is_holiday === 1);
    const withoutIsHoliday = allEvents.filter(e => e.is_holiday === 0 || e.is_holiday === null);

    console.log('📈 Pattern Analysis:');
    console.log(`  Events WITH created_by: ${withCreatedBy.length}`);
    console.log(`  Events WITHOUT created_by (NULL): ${withoutCreatedBy.length}`);
    console.log(`  Events WITH is_holiday=1: ${withIsHoliday.length}`);
    console.log(`  Events WITH is_holiday=0 or NULL: ${withoutIsHoliday.length}`);

    // ========================================
    // DETAILED COMPARISON
    // ========================================
    console.log('\n\n🔬 DETAILED COMPARISON');
    console.log('='.repeat(80));

    // Sample user-made event
    console.log('\n📝 SAMPLE USER-MADE EVENTS (created_by IS NOT NULL):');
    console.log('-'.repeat(80));
    const userMadeEvents = allEvents.filter(e => e.created_by !== null).slice(0, 5);
    userMadeEvents.forEach((event, index) => {
      console.log(`\n${index + 1}. ${event.title}`);
      console.log(`   ID: ${event.calendar_id}`);
      console.log(`   created_by: ${event.created_by}`);
      console.log(`   is_holiday: ${event.is_holiday}`);
      console.log(`   is_alert: ${event.is_alert}`);
      console.log(`   is_active: ${event.is_active}`);
      console.log(`   is_published: ${event.is_published}`);
      console.log(`   event_date: ${event.event_date}`);
      console.log(`   end_date: ${event.end_date || 'NULL'}`);
      console.log(`   created_at: ${event.created_at}`);
      console.log(`   description: ${event.description ? event.description.substring(0, 50) + '...' : 'NULL'}`);
    });

    // Sample API-imported holidays
    console.log('\n\n🌍 SAMPLE API-IMPORTED HOLIDAYS (created_by IS NULL):');
    console.log('-'.repeat(80));
    const apiHolidays = allEvents.filter(e => e.created_by === null).slice(0, 5);
    apiHolidays.forEach((event, index) => {
      console.log(`\n${index + 1}. ${event.title}`);
      console.log(`   ID: ${event.calendar_id}`);
      console.log(`   created_by: ${event.created_by || 'NULL'}`);
      console.log(`   is_holiday: ${event.is_holiday}`);
      console.log(`   is_alert: ${event.is_alert}`);
      console.log(`   is_active: ${event.is_active}`);
      console.log(`   is_published: ${event.is_published}`);
      console.log(`   event_date: ${event.event_date}`);
      console.log(`   end_date: ${event.end_date || 'NULL'}`);
      console.log(`   created_at: ${event.created_at}`);
      console.log(`   description: ${event.description ? event.description.substring(0, 50) + '...' : 'NULL'}`);
    });

    // ========================================
    // CHECK is_holiday COLUMN
    // ========================================
    console.log('\n\n🏖️ CHECKING is_holiday COLUMN');
    console.log('='.repeat(80));

    const [holidayStats] = await connection.query(`
      SELECT 
        is_holiday,
        COUNT(*) as count,
        COUNT(CASE WHEN created_by IS NULL THEN 1 END) as null_created_by,
        COUNT(CASE WHEN created_by IS NOT NULL THEN 1 END) as has_created_by
      FROM school_calendar
      GROUP BY is_holiday
    `);

    console.log('\nHoliday Flag Statistics:');
    holidayStats.forEach(stat => {
      console.log(`\n  is_holiday = ${stat.is_holiday}:`);
      console.log(`    Total: ${stat.count}`);
      console.log(`    With created_by NULL: ${stat.null_created_by}`);
      console.log(`    With created_by NOT NULL: ${stat.has_created_by}`);
    });

    // ========================================
    // IDENTIFY THE PATTERN
    // ========================================
    console.log('\n\n🎯 PATTERN IDENTIFICATION');
    console.log('='.repeat(80));

    const [patternCheck] = await connection.query(`
      SELECT 
        CASE 
          WHEN created_by IS NULL THEN 'API Holiday'
          WHEN created_by IS NOT NULL THEN 'User-Made Event'
        END as event_type,
        COUNT(*) as count,
        AVG(is_holiday) as avg_is_holiday,
        COUNT(CASE WHEN is_holiday = 1 THEN 1 END) as holiday_flag_count
      FROM school_calendar
      GROUP BY event_type
    `);

    console.log('\nEvent Type Distribution:');
    patternCheck.forEach(pattern => {
      console.log(`\n  ${pattern.event_type}:`);
      console.log(`    Count: ${pattern.count}`);
      console.log(`    Average is_holiday: ${pattern.avg_is_holiday}`);
      console.log(`    With is_holiday=1: ${pattern.holiday_flag_count}`);
    });

    // ========================================
    // RECOMMENDATIONS
    // ========================================
    console.log('\n\n💡 RECOMMENDATIONS');
    console.log('='.repeat(80));

    const hasIsHolidayColumn = columns.some(col => col.COLUMN_NAME === 'is_holiday');
    
    if (hasIsHolidayColumn) {
      console.log('\n✅ is_holiday column EXISTS');
      console.log('\n📋 Recommended Filter for Archival:');
      console.log('   Use BOTH conditions to identify user-made events:');
      console.log('   1. created_by IS NOT NULL (user-made)');
      console.log('   2. is_holiday = 0 OR is_holiday IS NULL (not a holiday)');
      console.log('\n   SQL WHERE clause:');
      console.log('   WHERE created_by IS NOT NULL');
      console.log('     AND (is_holiday = 0 OR is_holiday IS NULL)');
      console.log('     AND ... (other archival conditions)');
    } else {
      console.log('\n⚠️  is_holiday column DOES NOT EXIST');
      console.log('\n📋 Recommended Filter for Archival:');
      console.log('   Use created_by to identify user-made events:');
      console.log('   WHERE created_by IS NOT NULL');
      console.log('     AND ... (other archival conditions)');
    }

    console.log('\n\n🔒 WHAT TO PROTECT:');
    console.log('   • API-imported holidays (created_by IS NULL)');
    console.log('   • Events with is_holiday = 1 (if column exists)');
    console.log('\n✅ WHAT TO ARCHIVE:');
    console.log('   • User-made events (created_by IS NOT NULL)');
    console.log('   • Events with is_holiday = 0 or NULL');
    console.log('   • Events that have expired (based on end_date or event_date)');

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

// Run the analysis
analyzeCalendarDataTypes();
