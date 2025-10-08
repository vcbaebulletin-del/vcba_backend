const calendarModel = require('./src/models/CalendarModel');

async function testCalendarImages() {
  console.log('🧪 Testing Calendar Event Images API\n');
  
  try {
    // Test 1: Get all calendar events and check for images
    console.log('📅 Test 1: Checking calendar events for images/attachments');
    const result = await calendarModel.getEvents(
      { is_active: 1 },
      { page: 1, limit: 10, sort_by: 'created_at', sort_order: 'DESC' }
    );
    
    console.log(`Found ${result.events.length} calendar events\n`);
    
    result.events.forEach((event, index) => {
      console.log(`${index + 1}. ${event.title}`);
      console.log(`   Calendar ID: ${event.calendar_id}`);
      console.log(`   Event Date: ${event.event_date}`);
      console.log(`   Has 'images' property: ${event.hasOwnProperty('images')}`);
      console.log(`   Has 'attachments' property: ${event.hasOwnProperty('attachments')}`);
      
      if (event.images) {
        console.log(`   Images count: ${event.images.length}`);
        if (event.images.length > 0) {
          console.log(`   Image details:`);
          event.images.forEach((img, imgIndex) => {
            console.log(`     ${imgIndex + 1}. ${img.file_name}`);
            console.log(`        Path: ${img.file_path}`);
            console.log(`        Type: ${img.file_type}`);
          });
        }
      } else {
        console.log(`   Images: undefined`);
      }
      
      if (event.attachments) {
        console.log(`   Attachments count: ${event.attachments.length}`);
      } else {
        console.log(`   Attachments: undefined`);
      }
      console.log('');
    });
    
    // Test 2: Check database for calendar attachments
    console.log('\n📅 Test 2: Checking database for calendar_attachments');
    const mysql = require('mysql2/promise');
    const config = require('./src/config/config');
    const conn = await mysql.createConnection(config.database);
    
    const [attachments] = await conn.execute(`
      SELECT 
        ca.*,
        sc.title as event_title
      FROM calendar_attachments ca
      JOIN school_calendar sc ON ca.calendar_id = sc.calendar_id
      WHERE ca.deleted_at IS NULL
      ORDER BY ca.uploaded_at DESC
      LIMIT 10
    `);
    
    console.log(`Found ${attachments.length} calendar attachments in database\n`);
    
    attachments.forEach((att, index) => {
      console.log(`${index + 1}. Event: ${att.event_title}`);
      console.log(`   Calendar ID: ${att.calendar_id}`);
      console.log(`   File: ${att.file_name}`);
      console.log(`   Path: ${att.file_path}`);
      console.log(`   Type: ${att.file_type}`);
      console.log('');
    });
    
    // Test 3: Get a specific event by ID and check images
    if (attachments.length > 0) {
      const testCalendarId = attachments[0].calendar_id;
      console.log(`\n📅 Test 3: Getting event ${testCalendarId} by ID`);
      
      const event = await calendarModel.getEventById(testCalendarId);
      console.log(`Event: ${event.title}`);
      console.log(`Has 'images' property: ${event.hasOwnProperty('images')}`);
      console.log(`Has 'attachments' property: ${event.hasOwnProperty('attachments')}`);
      
      if (event.images) {
        console.log(`Images count: ${event.images.length}`);
        event.images.forEach((img, index) => {
          console.log(`  ${index + 1}. ${img.file_name} - ${img.file_path}`);
        });
      }
      
      if (event.attachments) {
        console.log(`Attachments count: ${event.attachments.length}`);
        event.attachments.forEach((att, index) => {
          console.log(`  ${index + 1}. ${att.file_name} - ${att.file_path}`);
        });
      }
    }
    
    await conn.end();
    
    console.log('\n✅ Calendar images API test complete');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    process.exit(0);
  }
}

testCalendarImages().catch(console.error);

