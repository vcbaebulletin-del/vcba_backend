/**
 * Test Calendar Date Submission Flow
 *
 * This script tests the complete flow of calendar event creation
 * to verify that dates are preserved correctly from frontend to backend to database.
 * TESTING AGAINST RAILWAY DATABASE
 */

const mysql = require('mysql2/promise');

async function testCalendarDateSubmission() {
  let connection;
  
  try {
    console.log('🧪 TESTING CALENDAR DATE SUBMISSION FLOW');
    console.log('🌐 TESTING AGAINST RAILWAY DATABASE\n');
    console.log('=' .repeat(60));
    
    // Connect to database
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'centerbeam.proxy.rlwy.net',
      port: process.env.DB_PORT || 14376,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || 'TtTMjTElsEGhDREYyaIBcNyjbQGajuqi',
      database: process.env.DB_NAME || 'railway',
      timezone: '+08:00' // Philippine Time
    });
    
    console.log('✅ Connected to database\n');

    // Get a valid admin ID
    const [admins] = await connection.execute('SELECT admin_id FROM admin_accounts LIMIT 1');
    if (admins.length === 0) {
      throw new Error('No admin accounts found in database');
    }
    const validAdminId = admins[0].admin_id;
    console.log(`Using admin ID: ${validAdminId}\n`);

    // Test Case 1: Simulate frontend sending date string "2025-10-05"
    console.log('📅 TEST CASE 1: Frontend sends "2025-10-05"');
    console.log('-'.repeat(60));

    const testDate1 = '2025-10-05';
    const testEndDate1 = '2025-10-10';

    console.log(`Input from frontend: event_date="${testDate1}", end_date="${testEndDate1}"`);

    // Insert test event
    const [insertResult1] = await connection.execute(
      `INSERT INTO school_calendar
       (title, description, event_date, end_date, category_id, is_active, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      ['TEST: Date Submission Test 1', 'Testing date preservation', testDate1, testEndDate1, 1, 1, validAdminId]
    );
    
    const testEventId1 = insertResult1.insertId;
    console.log(`✅ Event created with ID: ${testEventId1}`);
    
    // Retrieve the event
    const [retrievedEvents1] = await connection.execute(
      'SELECT calendar_id, title, event_date, end_date FROM school_calendar WHERE calendar_id = ?',
      [testEventId1]
    );
    
    const retrievedEvent1 = retrievedEvents1[0];
    console.log('\n📊 Retrieved from database:');
    console.log(`   event_date: ${retrievedEvent1.event_date}`);
    console.log(`   end_date: ${retrievedEvent1.end_date}`);
    
    // Check if dates match
    const eventDateStr1 = retrievedEvent1.event_date instanceof Date 
      ? retrievedEvent1.event_date.toISOString().split('T')[0]
      : retrievedEvent1.event_date;
    const endDateStr1 = retrievedEvent1.end_date instanceof Date
      ? retrievedEvent1.end_date.toISOString().split('T')[0]
      : retrievedEvent1.end_date;
    
    console.log('\n🔍 Verification:');
    console.log(`   Expected event_date: ${testDate1}`);
    console.log(`   Actual event_date:   ${eventDateStr1}`);
    console.log(`   Match: ${eventDateStr1 === testDate1 ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   Expected end_date: ${testEndDate1}`);
    console.log(`   Actual end_date:   ${endDateStr1}`);
    console.log(`   Match: ${endDateStr1 === testEndDate1 ? '✅ PASS' : '❌ FAIL'}`);
    
    // Test the formatEventDates function behavior
    console.log('\n📝 Testing formatEventDates function behavior:');
    const dateObj = retrievedEvent1.event_date;
    console.log(`   Date object type: ${dateObj instanceof Date ? 'Date' : typeof dateObj}`);
    
    if (dateObj instanceof Date) {
      console.log(`   Date object value: ${dateObj}`);
      console.log(`   toISOString(): ${dateObj.toISOString()}`);
      console.log(`   toISOString().split('T')[0]: ${dateObj.toISOString().split('T')[0]}`);
      console.log(`   getFullYear(): ${dateObj.getFullYear()}`);
      console.log(`   getMonth() + 1: ${dateObj.getMonth() + 1}`);
      console.log(`   getDate(): ${dateObj.getDate()}`);
      
      // Simulate formatEventDates function
      const year = dateObj.getFullYear();
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const day = String(dateObj.getDate()).padStart(2, '0');
      const formattedDate = `${year}-${month}-${day}`;
      console.log(`   formatEventDates result: ${formattedDate}`);
      console.log(`   Matches input: ${formattedDate === testDate1 ? '✅ YES' : '❌ NO'}`);
    }
    
    // Clean up test event
    await connection.execute('DELETE FROM school_calendar WHERE calendar_id = ?', [testEventId1]);
    console.log(`\n🧹 Cleaned up test event ${testEventId1}`);
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ TEST COMPLETED SUCCESSFULLY');
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 Database connection closed');
    }
  }
}

// Run the test
if (require.main === module) {
  testCalendarDateSubmission();
}

module.exports = testCalendarDateSubmission;

