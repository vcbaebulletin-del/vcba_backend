const calendarModel = require('./src/models/CalendarModel');
const mysql = require('mysql2/promise');
const config = require('./src/config/config');

async function testDateFix() {
  console.log('🧪 Testing Calendar Date Fix\n');

  const conn = await mysql.createConnection(config.database);

  try {
    // Get a valid admin ID
    const [admins] = await conn.execute('SELECT admin_id FROM admin_accounts LIMIT 1');
    if (admins.length === 0) {
      console.log('❌ No admin users found');
      return;
    }
    const adminId = admins[0].admin_id;

    // Get a valid category ID
    const [categories] = await conn.execute('SELECT category_id FROM categories WHERE deleted_at IS NULL LIMIT 1');
    if (categories.length === 0) {
      console.log('❌ No categories found');
      return;
    }
    const categoryId = categories[0].category_id;

    // Test 1: Create a test event for October 6, 2025
    console.log('📅 Test 1: Creating calendar event for October 6, 2025');

    const eventData = {
      title: 'TEST: October 6 Event',
      description: 'Testing date handling fix',
      event_date: '2025-10-06',
      end_date: '2025-10-10',
      category_id: categoryId,
      created_by: adminId
    };
    
    console.log('Input data:', eventData);
    
    const createdEvent = await calendarModel.createEvent(eventData);
    console.log('\n✅ Event created successfully!');
    console.log('Returned event_date:', createdEvent.event_date);
    console.log('Returned end_date:', createdEvent.end_date);
    
    // Test 2: Retrieve the event by ID
    console.log('\n📅 Test 2: Retrieving event by ID');
    const retrievedEvent = await calendarModel.getEventById(createdEvent.calendar_id);
    console.log('Retrieved event_date:', retrievedEvent.event_date);
    console.log('Retrieved end_date:', retrievedEvent.end_date);
    
    // Test 3: Get events with filters
    console.log('\n📅 Test 3: Getting events with date range filter');
    const result = await calendarModel.getEvents(
      { start_date: '2025-10-01', end_date: '2025-10-31' },
      { page: 1, limit: 10, sort_by: 'event_date', sort_order: 'ASC' }
    );
    
    const testEvent = result.events.find(e => e.calendar_id === createdEvent.calendar_id);
    if (testEvent) {
      console.log('Found in getEvents():');
      console.log('  event_date:', testEvent.event_date);
      console.log('  end_date:', testEvent.end_date);
    }
    
    // Test 4: Get events by date
    console.log('\n📅 Test 4: Getting events by specific date');
    const eventsByDate = await calendarModel.getEventsByDate('2025-10-06');
    const testEventByDate = eventsByDate.find(e => e.calendar_id === createdEvent.calendar_id);
    if (testEventByDate) {
      console.log('Found test event in getEventsByDate():');
      console.log('  event_date:', testEventByDate.event_date);
      console.log('  end_date:', testEventByDate.end_date);
    }

    // Test 5: Get events by date range
    console.log('\n📅 Test 5: Getting events by date range');
    const eventsByRange = await calendarModel.getEventsByDateRange('2025-10-01', '2025-10-31');
    const testEventByRange = eventsByRange.find(e => e.calendar_id === createdEvent.calendar_id);
    if (testEventByRange) {
      console.log('Found test event in getEventsByDateRange():');
      console.log('  event_date:', testEventByRange.event_date);
      console.log('  end_date:', testEventByRange.end_date);
    }
    
    // Verification
    console.log('\n🔍 VERIFICATION:');
    console.log('Expected event_date: 2025-10-06');
    console.log('Actual event_date:  ', retrievedEvent.event_date);
    console.log('Match:', retrievedEvent.event_date === '2025-10-06' ? '✅ PASS' : '❌ FAIL');
    
    console.log('\nExpected end_date: 2025-10-10');
    console.log('Actual end_date:  ', retrievedEvent.end_date);
    console.log('Match:', retrievedEvent.end_date === '2025-10-10' ? '✅ PASS' : '❌ FAIL');
    
    // Clean up
    console.log('\n🧹 Cleaning up test event...');
    await calendarModel.deleteEvent(createdEvent.calendar_id);
    console.log('✅ Test event deleted');
    
    console.log('\n✅ All tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await conn.end();
    process.exit(0);
  }
}

testDateFix().catch(console.error);

