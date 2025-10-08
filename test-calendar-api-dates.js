/**
 * Test Calendar API Date Responses
 *
 * This script tests the actual API responses to verify dates are formatted correctly
 * TESTING AGAINST RAILWAY DATABASE
 */

// Override environment to use Railway database
process.env.NODE_ENV = 'production';
process.env.DB_HOST = 'centerbeam.proxy.rlwy.net';
process.env.DB_PORT = '14376';
process.env.DB_USER = 'root';
process.env.DB_PASSWORD = 'TtTMjTElsEGhDREYyaIBcNyjbQGajuqi';
process.env.DB_NAME = 'railway';

const CalendarModel = require('./src/models/CalendarModel');

async function testCalendarAPIDates() {
  try {
    console.log('🧪 TESTING CALENDAR API DATE RESPONSES');
    console.log('🌐 TESTING AGAINST RAILWAY DATABASE\n');
    console.log('='.repeat(60));
    
    // Test 1: getEvents() method
    console.log('\n📅 TEST 1: getEvents() method');
    console.log('-'.repeat(60));
    
    const result1 = await CalendarModel.getEvents(
      { is_active: 1 },
      { page: 1, limit: 5, sort_by: 'event_date', sort_order: 'DESC' }
    );
    
    console.log(`Found ${result1.events.length} events`);
    
    if (result1.events.length > 0) {
      const event = result1.events[0];
      console.log('\nSample event:');
      console.log(`  ID: ${event.calendar_id}`);
      console.log(`  Title: ${event.title}`);
      console.log(`  event_date: ${event.event_date}`);
      console.log(`  event_date type: ${typeof event.event_date}`);
      console.log(`  end_date: ${event.end_date}`);
      console.log(`  end_date type: ${typeof event.end_date}`);
      console.log(`  Has images: ${event.images ? event.images.length : 0}`);
      
      // Verify date format
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      const eventDateValid = dateRegex.test(event.event_date);
      const endDateValid = !event.end_date || dateRegex.test(event.end_date);
      
      console.log(`\n✅ event_date format: ${eventDateValid ? 'VALID (YYYY-MM-DD)' : 'INVALID'}`);
      console.log(`✅ end_date format: ${endDateValid ? 'VALID (YYYY-MM-DD)' : 'INVALID'}`);
    }
    
    // Test 2: getEventById() method
    console.log('\n\n📅 TEST 2: getEventById() method');
    console.log('-'.repeat(60));
    
    if (result1.events.length > 0) {
      const eventId = result1.events[0].calendar_id;
      const event = await CalendarModel.getEventById(eventId);
      
      console.log(`Event ID: ${event.calendar_id}`);
      console.log(`Title: ${event.title}`);
      console.log(`event_date: ${event.event_date}`);
      console.log(`event_date type: ${typeof event.event_date}`);
      console.log(`end_date: ${event.end_date}`);
      console.log(`end_date type: ${typeof event.end_date}`);
      console.log(`Has images: ${event.images ? event.images.length : 0}`);
      
      // Verify date format
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      const eventDateValid = dateRegex.test(event.event_date);
      const endDateValid = !event.end_date || dateRegex.test(event.end_date);
      
      console.log(`\n✅ event_date format: ${eventDateValid ? 'VALID (YYYY-MM-DD)' : 'INVALID'}`);
      console.log(`✅ end_date format: ${endDateValid ? 'VALID (YYYY-MM-DD)' : 'INVALID'}`);
    }
    
    // Test 3: getCalendarEvents() method (used by TV Display)
    console.log('\n\n📅 TEST 3: getCalendarEvents() method (TV Display)');
    console.log('-'.repeat(60));
    
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    
    const calendarEvents = await CalendarModel.getCalendarEvents(currentYear, currentMonth);
    
    console.log(`Year: ${currentYear}, Month: ${currentMonth}`);
    console.log(`Grouped events keys: ${Object.keys(calendarEvents).length}`);
    
    // Get first event from grouped events
    const firstDateKey = Object.keys(calendarEvents)[0];
    if (firstDateKey && calendarEvents[firstDateKey].length > 0) {
      const event = calendarEvents[firstDateKey][0];
      console.log(`\nSample event from date ${firstDateKey}:`);
      console.log(`  ID: ${event.calendar_id}`);
      console.log(`  Title: ${event.title}`);
      console.log(`  event_date: ${event.event_date}`);
      console.log(`  event_date type: ${typeof event.event_date}`);
      console.log(`  end_date: ${event.end_date}`);
      console.log(`  end_date type: ${typeof event.end_date}`);
      console.log(`  Has images: ${event.images ? event.images.length : 0}`);
      
      if (event.images && event.images.length > 0) {
        console.log(`\n  Image details:`);
        event.images.forEach((img, index) => {
          console.log(`    ${index + 1}. ${img.file_name}`);
          console.log(`       Path: ${img.file_path}`);
          console.log(`       Primary: ${img.is_primary ? 'Yes' : 'No'}`);
        });
      }
      
      // Verify date format
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      const eventDateValid = dateRegex.test(event.event_date);
      const endDateValid = !event.end_date || dateRegex.test(event.end_date);
      
      console.log(`\n✅ event_date format: ${eventDateValid ? 'VALID (YYYY-MM-DD)' : 'INVALID'}`);
      console.log(`✅ end_date format: ${endDateValid ? 'VALID (YYYY-MM-DD)' : 'INVALID'}`);
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ ALL TESTS COMPLETED');
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    process.exit(0);
  }
}

// Run the test
if (require.main === module) {
  testCalendarAPIDates();
}

module.exports = testCalendarAPIDates;

