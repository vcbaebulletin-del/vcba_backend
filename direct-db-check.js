const mysql = require('mysql2/promise');

async function directDbCheck() {
  console.log('🔍 Direct Database Check...\n');

  try {
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'db_ebulletin_system'
    });

    console.log('✅ Connected to database');

    // Get the 3 most recent audit logs
    const [rows] = await connection.execute(`
      SELECT log_id, action_type, target_table, description, performed_at
      FROM audit_logs 
      ORDER BY performed_at DESC 
      LIMIT 3
    `);

    if (rows.length > 0) {
      console.log('\n📋 Most recent audit logs:');
      rows.forEach((log, index) => {
        console.log(`  ${index + 1}. ${log.action_type} on ${log.target_table}`);
        console.log(`     Description: ${log.description}`);
        console.log(`     Time: ${log.performed_at}`);
        console.log('');
      });
    } else {
      console.log('❌ No audit logs found');
    }

    await connection.end();
    console.log('✅ Database connection closed');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

directDbCheck();
