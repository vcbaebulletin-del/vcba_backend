const mysql = require('mysql2/promise');

/**
 * Check if any holidays were incorrectly archived
 */

async function checkArchivedHolidays() {
  let connection;
  
  try {
    console.log('🔍 CHECKING FOR INCORRECTLY ARCHIVED HOLIDAYS');
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

    // Check for holidays that were archived
    const [archivedHolidays] = await connection.query(`
      SELECT 
        calendar_id,
        title,
        event_date,
        is_holiday,
        is_active,
        created_by,
        updated_at
      FROM school_calendar
      WHERE is_holiday = 1
        AND is_active = 0
      ORDER BY event_date DESC
    `);

    console.log(`\n⚠️  Found ${archivedHolidays.length} HOLIDAYS that were archived (is_active=0)\n`);

    if (archivedHolidays.length > 0) {
      console.log('These holidays should NOT have been archived:');
      console.log('-'.repeat(80));
      archivedHolidays.forEach((holiday, index) => {
        console.log(`\n${index + 1}. ${holiday.title}`);
        console.log(`   ID: ${holiday.calendar_id}`);
        console.log(`   Event Date: ${holiday.event_date}`);
        console.log(`   is_holiday: ${holiday.is_holiday}`);
        console.log(`   is_active: ${holiday.is_active} ❌ (should be 1)`);
        console.log(`   created_by: ${holiday.created_by}`);
        console.log(`   Last Updated: ${holiday.updated_at}`);
      });

      console.log('\n' + '='.repeat(80));
      console.log('🔧 THESE HOLIDAYS NEED TO BE RESTORED');
      console.log('='.repeat(80));
    } else {
      console.log('✅ No holidays were incorrectly archived. Good!');
    }

    // Check user-made events that were correctly archived
    const [correctlyArchived] = await connection.query(`
      SELECT 
        COUNT(*) as count
      FROM school_calendar
      WHERE is_holiday = 0
        AND is_active = 0
        AND deleted_at IS NULL
    `);

    console.log(`\n✅ User-made events correctly archived: ${correctlyArchived[0].count}`);

    console.log('\n' + '='.repeat(80));

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 Disconnected from database\n');
    }
  }
}

checkArchivedHolidays();
