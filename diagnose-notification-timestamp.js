/**
 * DIAGNOSTIC SCRIPT: Notification Timestamp Investigation
 * 
 * This script will:
 * 1. Check database timezone configuration
 * 2. Create a test notification
 * 3. Retrieve it immediately
 * 4. Compare timestamps at each step
 * 5. Identify where the 8-hour offset is introduced
 */

require('dotenv').config();
const database = require('./src/config/database');

async function diagnoseTimestampIssue() {
  console.log('\n=== NOTIFICATION TIMESTAMP DIAGNOSTIC ===\n');

  try {
    // Step 1: Check database timezone
    console.log('Step 1: Checking database timezone configuration...');
    const timezoneResult = await database.query('SELECT @@session.time_zone as session_tz, @@global.time_zone as global_tz');
    console.log('Database timezone:', timezoneResult[0]);

    // Step 2: Check current database time
    console.log('\nStep 2: Checking current database time...');
    const dbTimeResult = await database.query('SELECT NOW() as db_now, UTC_TIMESTAMP() as db_utc');
    console.log('Database time:', dbTimeResult[0]);

    // Step 3: Check JavaScript time
    console.log('\nStep 3: Checking JavaScript time...');
    const jsDate = new Date();
    const jsISOString = new Date().toISOString();
    console.log('JavaScript new Date():', jsDate);
    console.log('JavaScript toISOString():', jsISOString);
    console.log('JavaScript getTime():', jsDate.getTime());

    // Step 4: Create a test notification with current timestamp
    console.log('\nStep 4: Creating test notification...');
    const testTimestamp = new Date().toISOString();
    console.log('Timestamp to insert:', testTimestamp);

    const insertResult = await database.query(
      `INSERT INTO notifications 
       (recipient_type, recipient_id, notification_type_id, title, message, is_read, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ['admin', 1, 1, 'TEST NOTIFICATION', 'Testing timestamp', 0, testTimestamp]
    );
    
    const testNotificationId = insertResult.insertId;
    console.log('Test notification created with ID:', testNotificationId);

    // Step 5: Retrieve the notification immediately
    console.log('\nStep 5: Retrieving test notification...');
    const retrievedNotification = await database.query(
      'SELECT notification_id, created_at FROM notifications WHERE notification_id = ?',
      [testNotificationId]
    );
    console.log('Retrieved notification:', retrievedNotification[0]);

    // Step 6: Compare timestamps
    console.log('\nStep 6: Timestamp comparison...');
    const insertedTimestamp = testTimestamp;
    const retrievedTimestamp = retrievedNotification[0].created_at;
    console.log('Inserted timestamp:', insertedTimestamp);
    console.log('Retrieved timestamp:', retrievedTimestamp);
    console.log('Are they equal?', insertedTimestamp === retrievedTimestamp);

    // Step 7: Calculate time difference
    console.log('\nStep 7: Calculating time difference...');
    const insertedDate = new Date(insertedTimestamp);
    const retrievedDate = new Date(retrievedTimestamp);
    const nowDate = new Date();
    
    console.log('Inserted as Date object:', insertedDate);
    console.log('Retrieved as Date object:', retrievedDate);
    console.log('Current time:', nowDate);
    
    const diffInsertedToNow = Math.floor((nowDate.getTime() - insertedDate.getTime()) / 1000);
    const diffRetrievedToNow = Math.floor((nowDate.getTime() - retrievedDate.getTime()) / 1000);
    
    console.log('Seconds from inserted to now:', diffInsertedToNow);
    console.log('Seconds from retrieved to now:', diffRetrievedToNow);
    console.log('Difference:', diffRetrievedToNow - diffInsertedToNow, 'seconds');

    // Step 8: Check how frontend would display it
    console.log('\nStep 8: Frontend display simulation...');
    const getTimeAgo = (dateString) => {
      const date = new Date(dateString);
      const now = new Date();
      const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
      
      if (diffInSeconds < 60) return 'Just now';
      if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
      if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
      return `${Math.floor(diffInSeconds / 86400)}d ago`;
    };
    
    console.log('Frontend would display:', getTimeAgo(retrievedTimestamp));

    // Step 9: Check database column type
    console.log('\nStep 9: Checking notifications table schema...');
    const schemaResult = await database.query(
      `SHOW COLUMNS FROM notifications WHERE Field = 'created_at'`
    );
    console.log('created_at column schema:', schemaResult[0]);

    // Step 10: Test with raw Date object (old way)
    console.log('\nStep 10: Testing with raw Date object (old way)...');
    const rawDate = new Date();
    console.log('Raw Date object:', rawDate);
    
    const insertResult2 = await database.query(
      `INSERT INTO notifications 
       (recipient_type, recipient_id, notification_type_id, title, message, is_read, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ['admin', 1, 1, 'TEST NOTIFICATION 2', 'Testing with raw Date', 0, rawDate]
    );
    
    const testNotificationId2 = insertResult2.insertId;
    const retrievedNotification2 = await database.query(
      'SELECT notification_id, created_at FROM notifications WHERE notification_id = ?',
      [testNotificationId2]
    );
    
    console.log('Inserted raw Date:', rawDate);
    console.log('Retrieved timestamp:', retrievedNotification2[0].created_at);
    console.log('Frontend would display:', getTimeAgo(retrievedNotification2[0].created_at));

    // Step 11: Clean up test notifications
    console.log('\nStep 11: Cleaning up test notifications...');
    await database.query(
      'DELETE FROM notifications WHERE notification_id IN (?, ?)',
      [testNotificationId, testNotificationId2]
    );
    console.log('Test notifications deleted');

    // Step 12: Check actual recent notifications
    console.log('\nStep 12: Checking actual recent notifications...');
    const recentNotifications = await database.query(
      `SELECT notification_id, title, created_at, 
       TIMESTAMPDIFF(SECOND, created_at, UTC_TIMESTAMP()) as seconds_ago
       FROM notifications 
       ORDER BY created_at DESC 
       LIMIT 5`
    );
    
    console.log('\nRecent notifications:');
    recentNotifications.forEach(notif => {
      console.log(`ID: ${notif.notification_id}`);
      console.log(`  Title: ${notif.title}`);
      console.log(`  Created at: ${notif.created_at}`);
      console.log(`  Seconds ago (DB calc): ${notif.seconds_ago}`);
      console.log(`  Frontend display: ${getTimeAgo(notif.created_at)}`);
      console.log('');
    });

    console.log('\n=== DIAGNOSTIC COMPLETE ===\n');

  } catch (error) {
    console.error('Error during diagnostic:', error);
  } finally {
    await database.close();
  }
}

// Run diagnostic
diagnoseTimestampIssue();

