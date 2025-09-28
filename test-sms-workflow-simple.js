/**
 * Simple SMS workflow test
 */

const smsService = require('./src/services/smsService');
const StudentModel = require('./src/models/StudentModel');

async function testSMSWorkflow() {
  try {
    console.log('🧪 SIMPLE SMS WORKFLOW TEST');
    console.log('============================\n');

    // Test 1: SMS Service Status
    console.log('1️⃣ Testing SMS Service Status...');
    
    // Wait for service to initialize
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const serviceStatus = smsService.getServiceStatus();
    console.log('SMS Service Status:', JSON.stringify(serviceStatus, null, 2));
    
    const isEnabled = smsService.isServiceEnabled();
    console.log(`SMS Service Enabled: ${isEnabled}`);
    
    if (!isEnabled) {
      console.log('❌ SMS service is not enabled!');
      return;
    }
    console.log('✅ SMS service is enabled\n');

    // Test 2: Student Data
    console.log('2️⃣ Testing Student Data...');
    const allStudents = await StudentModel.getActiveStudentsForSMS();
    console.log(`Found ${allStudents.length} students with phone numbers`);
    
    if (allStudents.length > 0) {
      console.log('Sample students:');
      allStudents.slice(0, 3).forEach(student => {
        console.log(`  - ${student.full_name} (Grade ${student.grade_level}): ${student.phone_number}`);
      });
    }
    console.log('✅ Student data retrieval working\n');

    // Test 3: Phone Number Validation
    console.log('3️⃣ Testing Phone Number Validation...');
    if (allStudents.length > 0) {
      const testStudent = allStudents[0];
      const isValid = smsService.validatePhoneNumber(testStudent.phone_number);
      const formatted = smsService.formatPhoneNumber(testStudent.phone_number);
      console.log(`Test phone: ${testStudent.phone_number} → Valid: ${isValid} → Formatted: ${formatted}`);
    }
    console.log('✅ Phone validation working\n');

    // Test 4: SMS Sending Test
    console.log('4️⃣ Testing SMS Sending...');
    if (allStudents.length > 0) {
      const testStudents = allStudents.slice(0, 1); // Test with just 1 student
      const phoneNumbers = testStudents.map(s => s.phone_number);
      
      console.log(`Testing SMS to: ${phoneNumbers[0]}`);
      
      // Test announcement SMS
      const testAnnouncement = {
        title: 'Test SMS Alert',
        content: 'This is a test SMS to verify the system is working.',
        created_at: new Date(),
        grade_level: testStudents[0].grade_level
      };
      
      console.log('Sending test announcement SMS...');
      const result = await smsService.sendAnnouncementAlert(testAnnouncement, phoneNumbers);
      console.log('SMS Result:', JSON.stringify(result, null, 2));
      
      if (result.success && result.sent > 0) {
        console.log('✅ SMS sent successfully!');
      } else {
        console.log('❌ SMS sending failed:', result.error);
      }
    } else {
      console.log('❌ No students available for testing');
    }

    console.log('\n🎉 SMS WORKFLOW TEST COMPLETED!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run the test
testSMSWorkflow();
