#!/usr/bin/env node

/**
 * Test DateTime Formatting for Announcement Updates
 * 
 * This script tests the datetime formatting fix for the visibility_end_at field
 * to ensure MySQL datetime errors are resolved.
 */

// Standalone datetime formatting function for testing
function formatDateTimeForMySQL(dateValue) {
  if (!dateValue || dateValue === '' || dateValue === null) {
    return null;
  }

  try {
    // Handle different input formats
    let date;

    if (typeof dateValue === 'string') {
      // Handle datetime-local format (YYYY-MM-DDTHH:MM)
      if (dateValue.includes('T') && !dateValue.includes('Z') && !dateValue.includes('+')) {
        // This is likely a datetime-local input, treat as Philippines timezone
        date = new Date(dateValue + ':00+08:00'); // Add seconds and Philippines timezone
      } else {
        // Handle ISO strings or other formats
        date = new Date(dateValue);
      }
    } else if (dateValue instanceof Date) {
      date = dateValue;
    } else {
      return null;
    }

    // Check if date is valid
    if (isNaN(date.getTime())) {
      console.warn('Invalid date value:', dateValue);
      return null;
    }

    // Format as MySQL DATETIME (YYYY-MM-DD HH:MM:SS)
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  } catch (error) {
    console.warn('Error formatting datetime for MySQL:', dateValue, error.message);
    return null;
  }
}

// Test the formatDateTimeForMySQL method
function testDateTimeFormatting() {
  console.log('🧪 Testing DateTime Formatting for MySQL');
  console.log('========================================');
  
  // Test cases that might cause the MySQL error
  const testCases = [
    {
      name: 'datetime-local format',
      input: '2025-09-29T00:30',
      expected: '2025-09-29 00:30:00'
    },
    {
      name: 'ISO string with Z',
      input: '2025-09-29T00:30:00.000Z',
      expected: '2025-09-29 08:30:00' // +8 hours for Philippines timezone
    },
    {
      name: 'ISO string with timezone',
      input: '2025-09-29T00:30:00+08:00',
      expected: '2025-09-29 00:30:00'
    },
    {
      name: 'Empty string',
      input: '',
      expected: null
    },
    {
      name: 'Null value',
      input: null,
      expected: null
    },
    {
      name: 'Undefined value',
      input: undefined,
      expected: null
    },
    {
      name: 'Date object',
      input: new Date('2025-09-29T00:30:00+08:00'),
      expected: '2025-09-29 00:30:00'
    },
    {
      name: 'Invalid date string',
      input: 'invalid-date',
      expected: null
    }
  ];
  
  let passedTests = 0;
  let totalTests = testCases.length;
  
  testCases.forEach((testCase, index) => {
    console.log(`\n🔍 Test ${index + 1}: ${testCase.name}`);
    console.log(`   Input: ${JSON.stringify(testCase.input)}`);
    
    try {
      const result = formatDateTimeForMySQL(testCase.input);
      console.log(`   Output: ${JSON.stringify(result)}`);
      console.log(`   Expected: ${JSON.stringify(testCase.expected)}`);
      
      if (result === testCase.expected) {
        console.log('   ✅ PASS');
        passedTests++;
      } else {
        console.log('   ❌ FAIL');
      }
    } catch (error) {
      console.log(`   ❌ ERROR: ${error.message}`);
    }
  });
  
  console.log('\n📊 Test Results:');
  console.log(`   Passed: ${passedTests}/${totalTests}`);
  console.log(`   Success Rate: ${Math.round((passedTests / totalTests) * 100)}%`);
  
  if (passedTests === totalTests) {
    console.log('   🎉 All tests passed!');
  } else {
    console.log('   ⚠️  Some tests failed. Please review the implementation.');
  }
}

// Test MySQL datetime format validation
function testMySQLCompatibility() {
  console.log('\n🔍 Testing MySQL DATETIME Compatibility');
  console.log('======================================');

  // Test the problematic value from the error message
  const problematicValue = '2025-09-29T00:30:00.000Z';
  console.log(`\n🚨 Testing problematic value: ${problematicValue}`);

  const formatted = formatDateTimeForMySQL(problematicValue);
  console.log(`   Formatted result: ${formatted}`);
  
  // Validate MySQL DATETIME format (YYYY-MM-DD HH:MM:SS)
  const mysqlDateTimeRegex = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
  
  if (formatted === null) {
    console.log('   ✅ Correctly handled as NULL');
  } else if (mysqlDateTimeRegex.test(formatted)) {
    console.log('   ✅ Valid MySQL DATETIME format');
  } else {
    console.log('   ❌ Invalid MySQL DATETIME format');
  }
}

// Run tests
if (require.main === module) {
  try {
    testDateTimeFormatting();
    testMySQLCompatibility();
    
    console.log('\n🏁 DateTime formatting tests completed!');
    console.log('\n💡 Next steps:');
    console.log('   1. Deploy the updated AnnouncementModel.js');
    console.log('   2. Test announcement editing in the frontend');
    console.log('   3. Verify no more MySQL datetime errors occur');
    
  } catch (error) {
    console.error('❌ Test execution failed:', error.message);
    process.exit(1);
  }
}
