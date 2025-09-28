const smsService = require('./src/services/smsService');

async function testSMSService() {
  console.log('🧪 Testing SMS Service...\n');

  // Test 1: Service Status
  console.log('1. Testing service status...');
  try {
    const status = smsService.getServiceStatus();
    console.log('✅ Service Status:', status);
  } catch (error) {
    console.error('❌ Service Status Error:', error.message);
  }

  // Test 2: Phone Number Validation
  console.log('\n2. Testing phone number validation...');
  const testNumbers = [
    '09123456789',
    '+639123456789',
    '639123456789',
    '123456789',
    'invalid',
    ''
  ];

  testNumbers.forEach(number => {
    const isValid = smsService.validatePhoneNumber(number);
    const formatted = smsService.formatPhoneNumber(number);
    console.log(`${isValid ? '✅' : '❌'} ${number} -> ${formatted} (${isValid ? 'valid' : 'invalid'})`);
  });

  // Test 3: SMS Templates
  console.log('\n3. Testing SMS templates...');
  try {
    const templates = smsService.templates;
    console.log('✅ Available templates:');
    Object.keys(templates).forEach(key => {
      console.log(`  - ${key}: ${templates[key].title}`);
    });
  } catch (error) {
    console.error('❌ Templates Error:', error.message);
  }

  // Test 4: Test Service Connection (without sending actual SMS)
  console.log('\n4. Testing service connection...');
  try {
    const testResult = await smsService.testService();
    console.log('✅ Service Connection Test:', testResult);
  } catch (error) {
    console.error('❌ Service Connection Error:', error.message);
  }

  // Test 5: Rate Limiting Check
  console.log('\n5. Testing rate limiting...');
  try {
    const canSend1 = smsService.checkRateLimit();
    const canSend2 = smsService.checkRateLimit();
    console.log('✅ Rate Limit Check 1:', canSend1);
    console.log('✅ Rate Limit Check 2:', canSend2);
  } catch (error) {
    console.error('❌ Rate Limit Error:', error.message);
  }

  console.log('\n🏁 SMS Service test completed!');
}

// Run the test
testSMSService().catch(console.error);
