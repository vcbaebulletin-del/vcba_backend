#!/usr/bin/env node

/**
 * Simple Calendar Routes Test
 */

console.log('🔍 Testing Calendar Routes Loading');
console.log('==================================');

try {
  console.log('📝 Loading CalendarController...');
  const CalendarController = require('./src/controllers/CalendarController');
  console.log('✅ CalendarController loaded');
  
  // Check which methods exist (CalendarController is exported as instance)
  const controller = CalendarController;
  const methods = Object.getOwnPropertyNames(controller)
    .filter(name => typeof controller[name] === 'function');

  console.log('📊 Available CalendarController methods:');
  methods.forEach(method => {
    console.log(`   - ${method}`);
  });

  // Check for the problematic methods
  const problematicMethods = ['updateEventAttachment', 'updateAttachmentOrder'];
  console.log('\n🔍 Checking for problematic methods:');
  problematicMethods.forEach(method => {
    if (controller[method]) {
      console.log(`   ✅ ${method} exists`);
    } else {
      console.log(`   ❌ ${method} is undefined`);
    }
  });
  
  console.log('\n📝 Loading calendar routes...');
  const calendarRoutes = require('./src/routes/calendarRoutes');
  console.log('✅ Calendar routes loaded successfully!');
  
} catch (error) {
  console.log('❌ Error loading calendar routes:');
  console.log('📝 Error message:', error.message);
  console.log('📍 Stack trace:');
  console.log(error.stack);
}
