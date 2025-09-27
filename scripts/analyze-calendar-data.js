const mysql = require("mysql2/promise");
require('dotenv').config();

/**
 * Analyze Calendar Data Script
 * Examines school_calendar table to understand holiday vs regular event patterns
 */
async function analyzeCalendarData() {
  let connection;
  
  try {
    console.log('🔍 Analyzing school calendar data...\n');
    
    // Create database connection
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASS || '',
      database: process.env.DB_NAME || 'vcba_e_bulletin_board',
      timezone: '+08:00'
    });

    console.log('✅ Connected to database successfully\n');

    // 1. Analyze holiday vs non-holiday records
    console.log('📊 HOLIDAY VS NON-HOLIDAY ANALYSIS:');
    console.log('='.repeat(50));
    
    const [holidayStats] = await connection.query(`
      SELECT 
        is_holiday,
        COUNT(*) as count,
        COUNT(CASE WHEN is_auto_generated = 1 THEN 1 END) as auto_generated_count,
        COUNT(CASE WHEN holiday_type IS NOT NULL THEN 1 END) as with_holiday_type,
        COUNT(CASE WHEN api_source IS NOT NULL THEN 1 END) as with_api_source
      FROM school_calendar 
      WHERE deleted_at IS NULL
      GROUP BY is_holiday
      ORDER BY is_holiday;
    `);
    
    console.table(holidayStats);

    // 2. Sample holiday records
    console.log('\n🎄 SAMPLE HOLIDAY RECORDS:');
    console.log('='.repeat(50));
    
    const [holidayRecords] = await connection.query(`
      SELECT 
        calendar_id,
        title,
        event_date,
        is_holiday,
        holiday_type,
        is_auto_generated,
        api_source,
        created_by
      FROM school_calendar 
      WHERE is_holiday = 1 
        AND deleted_at IS NULL
      ORDER BY event_date DESC
      LIMIT 10;
    `);
    
    console.table(holidayRecords);

    // 3. Sample non-holiday records
    console.log('\n📚 SAMPLE NON-HOLIDAY RECORDS:');
    console.log('='.repeat(50));
    
    const [nonHolidayRecords] = await connection.query(`
      SELECT 
        calendar_id,
        title,
        event_date,
        is_holiday,
        holiday_type,
        is_auto_generated,
        api_source,
        created_by
      FROM school_calendar 
      WHERE is_holiday = 0 
        AND deleted_at IS NULL
      ORDER BY event_date DESC
      LIMIT 10;
    `);
    
    console.table(nonHolidayRecords);

    // 4. Analyze created_by patterns
    console.log('\n👤 CREATED_BY ANALYSIS:');
    console.log('='.repeat(50));
    
    const [createdByStats] = await connection.query(`
      SELECT 
        is_holiday,
        created_by,
        COUNT(*) as count,
        MIN(event_date) as earliest_event,
        MAX(event_date) as latest_event
      FROM school_calendar 
      WHERE deleted_at IS NULL
      GROUP BY is_holiday, created_by
      ORDER BY is_holiday, count DESC;
    `);
    
    console.table(createdByStats);

    // 5. Holiday type distribution
    console.log('\n🏷️ HOLIDAY TYPE DISTRIBUTION:');
    console.log('='.repeat(50));
    
    const [holidayTypes] = await connection.query(`
      SELECT 
        holiday_type,
        COUNT(*) as count,
        COUNT(CASE WHEN is_auto_generated = 1 THEN 1 END) as auto_generated,
        COUNT(CASE WHEN api_source IS NOT NULL THEN 1 END) as from_api
      FROM school_calendar 
      WHERE is_holiday = 1 
        AND deleted_at IS NULL
      GROUP BY holiday_type
      ORDER BY count DESC;
    `);
    
    console.table(holidayTypes);

    // 6. Filtering criteria recommendation
    console.log('\n💡 FILTERING CRITERIA RECOMMENDATION:');
    console.log('='.repeat(50));
    
    console.log('Based on the analysis, to exclude holidays from TV content:');
    console.log('✅ Primary filter: is_holiday = 0');
    console.log('✅ Additional safety: is_auto_generated = 0 (optional)');
    console.log('✅ Admin-created events: created_by should reference admin_accounts');
    console.log('\nRecommended SQL for TV content filtering:');
    console.log(`
    SELECT * FROM school_calendar 
    WHERE is_holiday = 0 
      AND deleted_at IS NULL 
      AND is_active = 1
      AND is_published = 1
    ORDER BY event_date ASC;
    `);

    console.log('\n✅ Calendar data analysis completed successfully!');

  } catch (error) {
    console.error('❌ Error during analysis:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Database connection closed');
    }
  }
}

// Run the analysis
if (require.main === module) {
  analyzeCalendarData();
}

module.exports = analyzeCalendarData;
