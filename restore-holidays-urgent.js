const mysql = require('mysql2/promise');

/**
 * URGENT: Restore holidays that were incorrectly archived
 */

async function restoreHolidays() {
  let connection;
  
  try {
    console.log('🚨 URGENT: RESTORING INCORRECTLY ARCHIVED HOLIDAYS');
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

    await connection.beginTransaction();

    try {
      // Find all holidays that were archived
      const [archivedHolidays] = await connection.query(`
        SELECT 
          calendar_id,
          title,
          event_date,
          is_holiday
        FROM school_calendar
        WHERE is_holiday = 1
          AND is_active = 0
        FOR UPDATE
      `);

      console.log(`Found ${archivedHolidays.length} holidays to restore\n`);

      if (archivedHolidays.length > 0) {
        // Restore all holidays
        const [result] = await connection.query(`
          UPDATE school_calendar
          SET 
            is_active = 1,
            updated_at = NOW()
          WHERE is_holiday = 1
            AND is_active = 0
        `);

        console.log(`✅ Restored ${result.affectedRows} holidays\n`);
        
        console.log('Restored holidays:');
        console.log('-'.repeat(80));
        archivedHolidays.forEach((holiday, index) => {
          console.log(`${index + 1}. ${holiday.title} (${holiday.event_date})`);
        });

        await connection.commit();
        console.log('\n✅ All holidays have been restored successfully!');
      } else {
        await connection.commit();
        console.log('✅ No holidays need to be restored');
      }

    } catch (error) {
      await connection.rollback();
      console.error('❌ Error restoring holidays:', error.message);
      throw error;
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ RESTORATION COMPLETED');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('❌ Fatal Error:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 Disconnected from database\n');
    }
  }
}

restoreHolidays();
