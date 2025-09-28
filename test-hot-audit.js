const HotAuditLogger = require('./src/utils/hotAuditLogger');

async function testHotAudit() {
  console.log('🔥 Testing Hot Audit Logger...\n');

  try {
    // Test card reorder logging
    console.log('1. Testing card reorder logging...');
    await HotAuditLogger.logCardReorder(3);

    // Test card toggle logging
    console.log('\n2. Testing card toggle logging...');
    await HotAuditLogger.logCardToggle(1);

    // Test carousel reorder logging
    console.log('\n3. Testing carousel reorder logging...');
    await HotAuditLogger.logCarouselReorder(2);

    // Test card creation logging
    console.log('\n4. Testing card creation logging...');
    await HotAuditLogger.logCardCreate(999);

    // Wait for logs to be written
    console.log('\n5. Waiting for logs to be written...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Check if logs were created
    console.log('\n6. Checking for new audit logs...');
    const mysql = require('mysql2/promise');
    
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'db_ebulletin_system'
    });

    // Get recent audit logs
    const [rows] = await connection.execute(`
      SELECT log_id, action_type, target_table, description, performed_at
      FROM audit_logs 
      ORDER BY performed_at DESC 
      LIMIT 5
    `);

    if (rows.length > 0) {
      console.log('✅ Recent audit logs:');
      rows.forEach((log, index) => {
        const logTime = new Date(log.performed_at);
        const now = new Date();
        const timeDiff = (now - logTime) / 1000; // seconds
        
        console.log(`  ${index + 1}. ${log.action_type} on ${log.target_table}`);
        console.log(`     Description: ${log.description}`);
        console.log(`     Time: ${log.performed_at} (${timeDiff.toFixed(1)}s ago)`);
        
        // Check if this log was created in the last 10 seconds
        if (timeDiff < 10) {
          console.log('     🎯 This is a new log from our test!');
        }
        console.log('');
      });
    } else {
      console.log('❌ No audit logs found');
    }

    await connection.end();

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

testHotAudit();
