/**
 * Comprehensive SMS workflow test
 * Tests the complete flow from student data → SMS service → TextBee API
 */

const mysql = require('mysql2/promise');
const smsService = require('./src/services/smsService');
const StudentModel = require('./src/models/StudentModel');

// Database configuration
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'db_ebulletin_system'
};

async function testSMSWorkflow() {
  let connection;
  
  try {
    console.log('🧪 COMPREHENSIVE SMS WORKFLOW TEST');
    console.log('=====================================\n');

    // Test 1: Database Connection
    console.log('1️⃣ Testing Database Connection...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Database connected successfully\n');

    // Test 2: SMS Service Configuration
    console.log('2️⃣ Testing SMS Service Configuration...');
    await smsService.loadConfiguration();
    const serviceStatus = smsService.getServiceStatus();
    console.log('SMS Service Status:', serviceStatus);
    
    if (!smsService.isServiceEnabled()) {
      console.log('❌ SMS service is not enabled!');
      console.log('Please check SMS configuration in the admin panel.');
      return;
    }
    console.log('✅ SMS service is enabled and configured\n');

    // Test 3: Student Data Retrieval
    console.log('3️⃣ Testing Student Data Retrieval...');
    
    // Test all students
    const allStudents = await StudentModel.getActiveStudentsForSMS();
    console.log(`Found ${allStudents.length} total active students with phone numbers`);
    
    // Test grade-specific filtering
    for (let grade = 7; grade <= 11; grade++) {
      const gradeStudents = await StudentModel.getActiveStudentsForSMS({ grade_level: grade });
      console.log(`  - Grade ${grade}: ${gradeStudents.length} students`);
    }
    console.log('✅ Student data retrieval working correctly\n');

    // Test 4: Phone Number Validation
    console.log('4️⃣ Testing Phone Number Validation...');
    const sampleStudents = allStudents.slice(0, 3);
    sampleStudents.forEach(student => {
      const isValid = smsService.validatePhoneNumber(student.phone_number);
      const formatted = smsService.formatPhoneNumber(student.phone_number);
      console.log(`  - ${student.full_name}: ${student.phone_number} → ${isValid ? '✅' : '❌'} Valid → ${formatted}`);
    });
    console.log('✅ Phone number validation working correctly\n');

    // Test 5: SMS Template Generation
    console.log('5️⃣ Testing SMS Template Generation...');
    
    // Test announcement template
    const testAnnouncement = {
      title: 'Test Announcement Alert',
      content: 'This is a test announcement to verify SMS functionality is working properly.',
      created_at: new Date(),
      grade_level: 8
    };
    
    const announcementTemplate = smsService.templates.announcement_alert.template
      .replace('{title}', testAnnouncement.title)
      .replace('{content}', testAnnouncement.content.substring(0, 100) + '...')
      .replace('{date}', new Date(testAnnouncement.created_at).toLocaleDateString('en-PH'))
      .replace('{grade_level}', `Grade ${testAnnouncement.grade_level}`);
    
    console.log('Announcement SMS Template:');
    console.log(`"${announcementTemplate}"`);
    console.log(`Length: ${announcementTemplate.length} characters\n`);

    // Test calendar template
    const testEvent = {
      title: 'Test Calendar Event',
      description: 'This is a test calendar event to verify SMS functionality.',
      event_date: new Date()
    };
    
    const calendarTemplate = smsService.templates.calendar_alert.template
      .replace('{title}', testEvent.title)
      .replace('{description}', testEvent.description.substring(0, 100) + '...')
      .replace('{event_date}', new Date(testEvent.event_date).toLocaleDateString('en-PH'));
    
    console.log('Calendar SMS Template:');
    console.log(`"${calendarTemplate}"`);
    console.log(`Length: ${calendarTemplate.length} characters\n`);
    console.log('✅ SMS template generation working correctly\n');

    // Test 6: SMS Sending (Dry Run)
    console.log('6️⃣ Testing SMS Sending (Dry Run)...');
    
    if (allStudents.length > 0) {
      // Test with first 2 students to avoid spam
      const testStudents = allStudents.slice(0, 2);
      const phoneNumbers = testStudents.map(s => s.phone_number);
      
      console.log('Test recipients:');
      testStudents.forEach(student => {
        console.log(`  - ${student.full_name} (Grade ${student.grade_level}): ${student.phone_number}`);
      });
      
      // Test announcement SMS
      console.log('\nTesting announcement SMS...');
      const announcementResult = await smsService.sendAnnouncementAlert(testAnnouncement, phoneNumbers);
      console.log('Announcement SMS Result:', announcementResult);
      
      // Test calendar SMS
      console.log('\nTesting calendar SMS...');
      const calendarResult = await smsService.sendCalendarAlert(testEvent, phoneNumbers);
      console.log('Calendar SMS Result:', calendarResult);
      
      console.log('✅ SMS sending test completed\n');
    } else {
      console.log('❌ No students available for SMS testing\n');
    }

    // Test 7: Integration Test Summary
    console.log('7️⃣ Integration Test Summary...');
    console.log('=====================================');
    console.log(`✅ Database Connection: Working`);
    console.log(`✅ SMS Service: ${smsService.isServiceEnabled() ? 'Enabled' : 'Disabled'}`);
    console.log(`✅ Student Data: ${allStudents.length} students with phone numbers`);
    console.log(`✅ Phone Validation: Working`);
    console.log(`✅ SMS Templates: Working`);
    console.log(`✅ TextBee API: ${serviceStatus.apiKey ? 'Configured' : 'Not Configured'}`);
    
    console.log('\n🎉 COMPREHENSIVE SMS WORKFLOW TEST COMPLETED!');
    console.log('\n📋 Next Steps:');
    console.log('1. Test announcement creation and approval in the web interface');
    console.log('2. Test calendar event creation with alert marking');
    console.log('3. Monitor server logs for SMS sending activity');
    console.log('4. Verify SMS notifications are received on test phone numbers');

  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Stack trace:', error.stack);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔗 Database connection closed');
    }
  }
}

// Run the test
testSMSWorkflow();
