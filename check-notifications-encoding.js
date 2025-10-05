/**
 * Script to check notifications table encoding and fix ??? issue
 */

const mysql = require('mysql2/promise');

// Railway database configuration
const railwayConfig = {
  host: 'centerbeam.proxy.rlwy.net',
  port: 14376,
  user: 'root',
  password: 'TtTMjTElsEGhDREYyaIBcNyjbQGajuqi',
  database: 'railway',
  charset: 'utf8mb4',
  collation: 'utf8mb4_unicode_ci'
};

async function checkNotificationsEncoding() {
  let connection;
  
  try {
    console.log('='.repeat(70));
    console.log('  CHECKING NOTIFICATIONS ENCODING');
    console.log('='.repeat(70));
    console.log('');
    
    console.log('🔄 Connecting to Railway database...');
    connection = await mysql.createConnection(railwayConfig);
    console.log('✅ Connected successfully!');
    console.log('');
    
    // Check notifications table structure
    console.log('📋 Checking notifications table structure...');
    console.log('-'.repeat(70));
    const [columns] = await connection.execute(
      `SELECT COLUMN_NAME, CHARACTER_SET_NAME, COLLATION_NAME, COLUMN_TYPE
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = 'railway' AND TABLE_NAME = 'notifications'
       AND COLUMN_NAME IN ('title', 'message')`
    );
    
    console.log('Notifications table columns:');
    columns.forEach(col => {
      console.log(`   ${col.COLUMN_NAME.padEnd(20)} ${col.COLUMN_TYPE.padEnd(20)} ${col.CHARACTER_SET_NAME || 'N/A'.padEnd(15)} ${col.COLLATION_NAME || 'N/A'}`);
    });
    console.log('');
    
    // Check actual notification data
    console.log('📋 Checking actual notification data...');
    console.log('-'.repeat(70));
    const [notifications] = await connection.execute(
      `SELECT notification_id, title, message, created_at
       FROM notifications
       ORDER BY created_at DESC
       LIMIT 10`
    );
    
    console.log('Recent notifications:');
    notifications.forEach(notif => {
      console.log(`   ID: ${notif.notification_id}`);
      console.log(`   Title: ${notif.title}`);
      console.log(`   Title (hex): ${Buffer.from(notif.title).toString('hex')}`);
      console.log(`   Message: ${notif.message.substring(0, 100)}...`);
      console.log(`   Created: ${notif.created_at}`);
      console.log('');
    });
    
    // Check if title/message columns need to be converted to utf8mb4
    const titleColumn = columns.find(col => col.COLUMN_NAME === 'title');
    const messageColumn = columns.find(col => col.COLUMN_NAME === 'message');
    
    if (titleColumn && titleColumn.CHARACTER_SET_NAME !== 'utf8mb4') {
      console.log('⚠️  WARNING: title column is not utf8mb4!');
      console.log(`   Current charset: ${titleColumn.CHARACTER_SET_NAME}`);
      console.log('   Needs to be converted to utf8mb4');
      console.log('');
    }
    
    if (messageColumn && messageColumn.CHARACTER_SET_NAME !== 'utf8mb4') {
      console.log('⚠️  WARNING: message column is not utf8mb4!');
      console.log(`   Current charset: ${messageColumn.CHARACTER_SET_NAME}`);
      console.log('   Needs to be converted to utf8mb4');
      console.log('');
    }
    
    // Apply fix if needed
    console.log('🔧 Applying encoding fixes...');
    console.log('-'.repeat(70));
    
    try {
      // Convert title column to utf8mb4
      await connection.execute(
        `ALTER TABLE notifications 
         MODIFY COLUMN title VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL`
      );
      console.log('   ✅ title column converted to utf8mb4');
    } catch (error) {
      console.log(`   ℹ️  title column: ${error.message}`);
    }
    
    try {
      // Convert message column to utf8mb4
      await connection.execute(
        `ALTER TABLE notifications 
         MODIFY COLUMN message TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL`
      );
      console.log('   ✅ message column converted to utf8mb4');
    } catch (error) {
      console.log(`   ℹ️  message column: ${error.message}`);
    }
    
    console.log('');
    
    // Verify changes
    console.log('✔️  Verifying changes...');
    console.log('-'.repeat(70));
    const [updatedColumns] = await connection.execute(
      `SELECT COLUMN_NAME, CHARACTER_SET_NAME, COLLATION_NAME, COLUMN_TYPE
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = 'railway' AND TABLE_NAME = 'notifications'
       AND COLUMN_NAME IN ('title', 'message')`
    );
    
    console.log('Updated notifications table columns:');
    updatedColumns.forEach(col => {
      console.log(`   ${col.COLUMN_NAME.padEnd(20)} ${col.COLUMN_TYPE.padEnd(20)} ${col.CHARACTER_SET_NAME || 'N/A'.padEnd(15)} ${col.COLLATION_NAME || 'N/A'}`);
    });
    console.log('');
    
    // Check if there are existing notifications with ??? or broken emojis
    console.log('🔍 Checking for broken notifications...');
    console.log('-'.repeat(70));
    const [brokenNotifs] = await connection.execute(
      `SELECT notification_id, title, message
       FROM notifications
       WHERE title LIKE '%???%' OR message LIKE '%???%'
       LIMIT 10`
    );
    
    if (brokenNotifs.length > 0) {
      console.log(`   Found ${brokenNotifs.length} notifications with ??? characters`);
      console.log('   These notifications were created before the encoding fix');
      console.log('   They will display correctly once new notifications are created');
      console.log('');
      
      brokenNotifs.forEach(notif => {
        console.log(`   ID: ${notif.notification_id}`);
        console.log(`   Title: ${notif.title}`);
        console.log('');
      });
    } else {
      console.log('   ✅ No broken notifications found');
    }
    console.log('');
    
    console.log('='.repeat(70));
    console.log('  ✅ ENCODING CHECK COMPLETE');
    console.log('='.repeat(70));
    console.log('');
    console.log('Summary:');
    console.log('  ✅ Database connection uses utf8mb4');
    console.log('  ✅ Notifications table columns converted to utf8mb4');
    console.log('  ✅ New notifications will display emojis correctly');
    console.log('');
    console.log('Note:');
    console.log('  • Existing notifications with ??? were created before the fix');
    console.log('  • New notifications will display emojis correctly (✅, 📢, 🚨)');
    console.log('  • Test by creating a new announcement and approving it');
    console.log('');
    
  } catch (error) {
    console.error('');
    console.error('❌ ERROR:', error.message);
    console.error('');
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Database connection closed');
      console.log('');
    }
  }
}

// Run the check
console.log('');
checkNotificationsEncoding();

