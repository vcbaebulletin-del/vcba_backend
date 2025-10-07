const mysql = require('mysql2/promise');
const config = require('./src/config/config');

async function testDateHandling() {
  console.log('🧪 Testing Calendar Date Handling\n');
  
  const conn = await mysql.createConnection(config.database);
  
  try {
    // Test 1: Check existing calendar events
    console.log('📅 Test 1: Checking existing calendar events');
    const [events] = await conn.execute(`
      SELECT 
        calendar_id,
        title,
        event_date,
        end_date,
        created_at
      FROM school_calendar
      WHERE deleted_at IS NULL
      ORDER BY created_at DESC
      LIMIT 5
    `);
    
    console.log('\nRecent calendar events:');
    events.forEach(event => {
      console.log(`  - ${event.title}`);
      console.log(`    Event Date: ${event.event_date} (Type: ${typeof event.event_date})`);
      if (event.end_date) {
        console.log(`    End Date: ${event.end_date} (Type: ${typeof event.end_date})`);
      }
      console.log(`    Created At: ${event.created_at}`);
      
      // Check if date is a Date object
      if (event.event_date instanceof Date) {
        console.log(`    Date Object Details:`);
        console.log(`      - getFullYear(): ${event.event_date.getFullYear()}`);
        console.log(`      - getMonth(): ${event.event_date.getMonth()} (0-indexed)`);
        console.log(`      - getDate(): ${event.event_date.getDate()}`);
        console.log(`      - getTimezoneOffset(): ${event.event_date.getTimezoneOffset()} minutes`);
        console.log(`      - toISOString(): ${event.event_date.toISOString()}`);
        console.log(`      - toLocaleDateString(): ${event.event_date.toLocaleDateString()}`);
      }
      console.log('');
    });
    
    // Test 2: Insert a test event with a specific date
    console.log('\n📅 Test 2: Creating test event for October 6, 2025');
    
    // Get a valid admin user
    const [admins] = await conn.execute('SELECT admin_id FROM admin_profiles LIMIT 1');
    if (admins.length === 0) {
      console.log('❌ No admin users found, skipping insert test');
      return;
    }
    const adminId = admins[0].admin_id;
    
    // Get a valid category
    const [categories] = await conn.execute('SELECT category_id FROM categories WHERE deleted_at IS NULL LIMIT 1');
    if (categories.length === 0) {
      console.log('❌ No categories found, skipping insert test');
      return;
    }
    const categoryId = categories[0].category_id;
    
    // Test different date formats
    const testCases = [
      { name: 'YYYY-MM-DD string', value: '2025-10-06' },
      { name: 'YYYY-MM-DD with end date', value: '2025-10-06', endDate: '2025-10-10' }
    ];
    
    for (const testCase of testCases) {
      console.log(`\n  Testing: ${testCase.name}`);
      console.log(`  Input value: ${testCase.value}`);
      
      const [result] = await conn.execute(`
        INSERT INTO school_calendar 
        (title, description, event_date, end_date, category_id, is_active, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 1, ?, NOW(), NOW())
      `, [
        `TEST: ${testCase.name}`,
        'Testing date handling',
        testCase.value,
        testCase.endDate || null,
        categoryId,
        adminId
      ]);
      
      const insertedId = result.insertId;
      console.log(`  ✅ Inserted with ID: ${insertedId}`);
      
      // Retrieve the inserted event
      const [inserted] = await conn.execute(`
        SELECT event_date, end_date FROM school_calendar WHERE calendar_id = ?
      `, [insertedId]);
      
      if (inserted.length > 0) {
        const event = inserted[0];
        console.log(`  Retrieved event_date: ${event.event_date}`);
        if (event.end_date) {
          console.log(`  Retrieved end_date: ${event.end_date}`);
        }
        
        if (event.event_date instanceof Date) {
          console.log(`  Date object details:`);
          console.log(`    - Year: ${event.event_date.getFullYear()}`);
          console.log(`    - Month: ${event.event_date.getMonth() + 1}`);
          console.log(`    - Day: ${event.event_date.getDate()}`);
          console.log(`    - ISO String: ${event.event_date.toISOString()}`);
          console.log(`    - Split [0]: ${event.event_date.toISOString().split('T')[0]}`);
        }
      }
      
      // Clean up
      await conn.execute('DELETE FROM school_calendar WHERE calendar_id = ?', [insertedId]);
      console.log(`  🧹 Cleaned up test event`);
    }
    
    console.log('\n✅ Date handling test complete');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await conn.end();
  }
}

testDateHandling().catch(console.error);

