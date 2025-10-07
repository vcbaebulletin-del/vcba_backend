const mysql = require('mysql2/promise');

async function debugLogoutAudit() {
  const connection = await mysql.createConnection({
    host: 'centerbeam.proxy.rlwy.net',
    port: 14376,
    user: 'root',
    password: 'TtTMjTElsEGhDREYyaIBcNyjbQGajuqi',
    database: 'railway'
  });

  try {
    console.log('🔍 Checking recent LOGOUT audit log entries...\n');

    // Get recent logout entries
    const [logoutEntries] = await connection.query(`
      SELECT 
        audit_log_id,
        user_type,
        user_id,
        action_type,
        description,
        new_values,
        created_at
      FROM audit_logs
      WHERE action_type = 'LOGOUT'
      ORDER BY created_at DESC
      LIMIT 10
    `);

    console.log(`Found ${logoutEntries.length} recent LOGOUT entries:\n`);

    logoutEntries.forEach((entry, index) => {
      console.log(`${index + 1}. Audit Log ID: ${entry.audit_log_id}`);
      console.log(`   User Type: ${entry.user_type}`);
      console.log(`   User ID: ${entry.user_id}`);
      console.log(`   Action: ${entry.action_type}`);
      console.log(`   Description: ${entry.description}`);
      console.log(`   New Values: ${entry.new_values}`);
      console.log(`   Created At: ${entry.created_at}`);
      
      // Check if it's a failed logout
      if (entry.description.includes('failed')) {
        console.log(`   ⚠️  STATUS: FAILED (INCORRECT)`);
      } else if (entry.description.includes('successful')) {
        console.log(`   ✅ STATUS: SUCCESSFUL (CORRECT)`);
      }
      console.log('');
    });

    // Count failed vs successful
    const failedCount = logoutEntries.filter(e => e.description.includes('failed')).length;
    const successCount = logoutEntries.filter(e => e.description.includes('successful')).length;

    console.log('\n📊 SUMMARY:');
    console.log(`Total LOGOUT entries: ${logoutEntries.length}`);
    console.log(`Failed (incorrect): ${failedCount}`);
    console.log(`Successful (correct): ${successCount}`);

    if (failedCount > 0) {
      console.log('\n⚠️  ISSUE CONFIRMED: Logout operations are being logged as "failed"');
      console.log('This indicates the isSuccess calculation in auditLogger.js is incorrect.');
    } else {
      console.log('\n✅ No issues found - all logout operations logged correctly');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await connection.end();
  }
}

debugLogoutAudit();

