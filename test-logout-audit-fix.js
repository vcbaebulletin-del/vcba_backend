/**
 * Test script to verify the logout audit log fix
 * 
 * This script checks recent LOGOUT audit log entries to verify they are
 * being logged as "successful" instead of "failed"
 * 
 * Usage: node test-logout-audit-fix.js
 */

const mysql = require('mysql2/promise');

async function testLogoutAuditFix() {
  console.log('🔍 Testing Logout Audit Log Fix...\n');

  const connection = await mysql.createConnection({
    host: 'centerbeam.proxy.rlwy.net',
    port: 14376,
    user: 'root',
    password: 'TtTMjTElsEGhDREYyaIBcNyjbQGajuqi',
    database: 'railway'
  });

  try {
    // Get recent logout entries
    console.log('📊 Fetching recent LOGOUT audit log entries...\n');
    
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

    if (logoutEntries.length === 0) {
      console.log('⚠️  No LOGOUT entries found in audit logs.');
      console.log('   Please perform a logout and run this script again.\n');
      return;
    }

    console.log(`Found ${logoutEntries.length} recent LOGOUT entries:\n`);
    console.log('═'.repeat(80));

    let successCount = 0;
    let failedCount = 0;

    logoutEntries.forEach((entry, index) => {
      const isSuccess = entry.description.toLowerCase().includes('successful');
      const isFailed = entry.description.toLowerCase().includes('failed');

      console.log(`\n${index + 1}. Audit Log ID: ${entry.audit_log_id}`);
      console.log(`   User Type: ${entry.user_type}`);
      console.log(`   User ID: ${entry.user_id}`);
      console.log(`   Action: ${entry.action_type}`);
      console.log(`   Description: ${entry.description}`);
      console.log(`   Created At: ${entry.created_at}`);
      
      if (isSuccess) {
        console.log(`   ✅ STATUS: SUCCESSFUL (CORRECT)`);
        successCount++;
      } else if (isFailed) {
        console.log(`   ❌ STATUS: FAILED (INCORRECT - BUG STILL EXISTS)`);
        failedCount++;
      } else {
        console.log(`   ⚠️  STATUS: UNKNOWN`);
      }
    });

    console.log('\n' + '═'.repeat(80));
    console.log('\n📊 SUMMARY:');
    console.log(`   Total LOGOUT entries: ${logoutEntries.length}`);
    console.log(`   ✅ Successful (correct): ${successCount}`);
    console.log(`   ❌ Failed (incorrect): ${failedCount}`);
    console.log(`   ⚠️  Unknown: ${logoutEntries.length - successCount - failedCount}`);

    console.log('\n' + '═'.repeat(80));

    if (failedCount > 0) {
      console.log('\n❌ ISSUE STILL EXISTS!');
      console.log('   Logout operations are still being logged as "failed"');
      console.log('   This indicates the fix may not have been deployed yet.');
      console.log('\n📝 NEXT STEPS:');
      console.log('   1. Check Railway deployment status');
      console.log('   2. Verify commit aa85a0e is deployed');
      console.log('   3. Check Railway backend logs for [AUDIT DEBUG] messages');
      console.log('   4. Perform a fresh logout and run this script again');
    } else if (successCount > 0) {
      console.log('\n✅ FIX IS WORKING!');
      console.log('   All logout operations are being logged correctly as "successful"');
      console.log('   The audit log bug has been resolved! 🎉');
    } else {
      console.log('\n⚠️  INCONCLUSIVE RESULTS');
      console.log('   No clear success or failed entries found.');
      console.log('   Please perform a logout and run this script again.');
    }

    // Check for very recent entries (last 5 minutes)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const recentEntries = logoutEntries.filter(e => new Date(e.created_at) > fiveMinutesAgo);

    if (recentEntries.length > 0) {
      console.log('\n🕐 RECENT ACTIVITY (last 5 minutes):');
      console.log(`   Found ${recentEntries.length} logout(s) in the last 5 minutes`);
      
      recentEntries.forEach(entry => {
        const isSuccess = entry.description.toLowerCase().includes('successful');
        const status = isSuccess ? '✅ SUCCESSFUL' : '❌ FAILED';
        console.log(`   - ${entry.created_at}: ${status}`);
      });
    } else {
      console.log('\n🕐 NO RECENT ACTIVITY:');
      console.log('   No logouts in the last 5 minutes.');
      console.log('   To test the fix:');
      console.log('   1. Login to the application');
      console.log('   2. Logout');
      console.log('   3. Run this script again');
    }

    console.log('\n' + '═'.repeat(80));
    console.log('\n✨ Test complete!\n');

  } catch (error) {
    console.error('❌ Error testing logout audit fix:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

// Run the test
testLogoutAuditFix()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });

