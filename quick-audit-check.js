const mysql = require('mysql2/promise');

async function quickAuditCheck() {
  console.log('🔍 Quick Audit Check...\n');

  try {
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'db_ebulletin_system'
    });

    console.log('✅ Connected to database');

    // Get the 5 most recent audit logs
    const [rows] = await connection.execute(`
      SELECT log_id, user_type, user_id, action_type, target_table, description, performed_at
      FROM audit_logs 
      ORDER BY performed_at DESC 
      LIMIT 5
    `);

    if (rows.length > 0) {
      console.log('\n📋 Recent audit logs:');
      rows.forEach((log, index) => {
        console.log(`  ${index + 1}. ${log.action_type} on ${log.target_table}`);
        console.log(`     Description: ${log.description}`);
        console.log(`     User: ${log.user_type} (ID: ${log.user_id})`);
        console.log(`     Time: ${log.performed_at}`);
        console.log('');
      });
    } else {
      console.log('❌ No audit logs found');
    }

    // Check specifically for welcome_cards logs in the last hour
    const [welcomeRows] = await connection.execute(`
      SELECT log_id, action_type, description, performed_at
      FROM audit_logs 
      WHERE target_table = 'welcome_cards' 
        AND performed_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
      ORDER BY performed_at DESC
    `);

    if (welcomeRows.length > 0) {
      console.log('🎯 Recent welcome_cards audit logs:');
      welcomeRows.forEach((log, index) => {
        console.log(`  ${index + 1}. ${log.action_type} - ${log.description} (${log.performed_at})`);
      });
    } else {
      console.log('❌ No recent welcome_cards audit logs found');
    }

    await connection.end();

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

quickAuditCheck();
