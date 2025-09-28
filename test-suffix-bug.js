const db = require('./src/config/database');

async function testSuffixBug() {
  console.log('🔍 Testing Suffix Field Bug...\n');

  try {
    console.log('✅ Using existing database connection');

    // Test 1: Check current student data with suffix values
    console.log('\n📝 Step 1: Checking existing student suffix data...');
    const students = await db.query(`
      SELECT
        s.student_id,
        s.student_number,
        p.first_name,
        p.last_name,
        p.suffix,
        CASE
          WHEN p.suffix IS NULL THEN 'NULL'
          WHEN p.suffix = '' THEN 'EMPTY_STRING'
          ELSE CONCAT('VALUE: "', p.suffix, '"')
        END as suffix_status
      FROM student_accounts s
      LEFT JOIN student_profiles p ON s.student_id = p.student_id
      ORDER BY s.student_id
      LIMIT 10
    `);

    console.log('Current student suffix data:');
    students.forEach(student => {
      console.log(`  ID: ${student.student_id}, Name: ${student.first_name} ${student.last_name}, Suffix: ${student.suffix_status}`);
    });

    // Test 2: Check database schema for suffix column
    console.log('\n📝 Step 2: Checking suffix column schema...');
    const schema = await db.query(`
      SELECT
        COLUMN_NAME,
        DATA_TYPE,
        IS_NULLABLE,
        COLUMN_DEFAULT,
        CHARACTER_MAXIMUM_LENGTH
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'db_ebulletin_system' AND TABLE_NAME = 'student_profiles' AND COLUMN_NAME = 'suffix'
    `);

    if (schema.length > 0) {
      const col = schema[0];
      console.log(`Suffix column schema:`);
      console.log(`  Type: ${col.DATA_TYPE}`);
      console.log(`  Nullable: ${col.IS_NULLABLE}`);
      console.log(`  Default: ${col.COLUMN_DEFAULT || 'NULL'}`);
      console.log(`  Max Length: ${col.CHARACTER_MAXIMUM_LENGTH}`);
    }

    // Test 3: Test inserting empty suffix
    console.log('\n📝 Step 3: Testing empty suffix insertion...');

    // Create a test student account first
    const testEmail = `test.suffix.${Date.now()}@test.com`;
    const testStudentNumber = `TEST-${Date.now()}`;

    const accountResult = await db.execute(`
      INSERT INTO student_accounts (email, password, student_number, is_active, created_at, updated_at)
      VALUES (?, 'test123', ?, 1, NOW(), NOW())
    `, [testEmail, testStudentNumber]);

    const testStudentId = accountResult.insertId;
    console.log(`✅ Created test student account ID: ${testStudentId}`);

    // Test inserting profile with empty suffix (simulating "None" selection)
    await db.execute(`
      INSERT INTO student_profiles (student_id, first_name, last_name, suffix, phone_number, grade_level, created_at, updated_at)
      VALUES (?, 'Test', 'Student', ?, '1234567890', 11, NOW(), NOW())
    `, [testStudentId, '']); // Empty string for suffix

    console.log('✅ Inserted profile with empty suffix');

    // Check what was actually stored
    const testResult = await db.query(`
      SELECT
        first_name,
        last_name,
        suffix,
        CASE
          WHEN suffix IS NULL THEN 'NULL'
          WHEN suffix = '' THEN 'EMPTY_STRING'
          ELSE CONCAT('VALUE: "', suffix, '"')
        END as suffix_status
      FROM student_profiles
      WHERE student_id = ?
    `, [testStudentId]);

    if (testResult.length > 0) {
      const result = testResult[0];
      console.log(`Stored suffix result: ${result.suffix_status}`);

      if (result.suffix_status === 'EMPTY_STRING') {
        console.log('✅ CORRECT: Empty string stored as empty string');
      } else if (result.suffix_status === 'NULL') {
        console.log('✅ CORRECT: Empty string converted to NULL');
      } else {
        console.log('❌ ERROR: Unexpected suffix value stored!');
      }
    }

    // Test 4: Test updating suffix to empty
    console.log('\n📝 Step 4: Testing suffix update to empty...');

    // First set a suffix value
    await db.execute(`
      UPDATE student_profiles
      SET suffix = 'Jr.'
      WHERE student_id = ?
    `, [testStudentId]);

    console.log('✅ Set suffix to "Jr."');

    // Now update to empty (simulating "None" selection)
    await db.execute(`
      UPDATE student_profiles
      SET suffix = ?
      WHERE student_id = ?
    `, ['', testStudentId]); // Empty string

    console.log('✅ Updated suffix to empty string');

    // Check result
    const updateResult = await db.query(`
      SELECT
        suffix,
        CASE
          WHEN suffix IS NULL THEN 'NULL'
          WHEN suffix = '' THEN 'EMPTY_STRING'
          ELSE CONCAT('VALUE: "', suffix, '"')
        END as suffix_status
      FROM student_profiles
      WHERE student_id = ?
    `, [testStudentId]);

    if (updateResult.length > 0) {
      const result = updateResult[0];
      console.log(`Updated suffix result: ${result.suffix_status}`);
      
      if (result.suffix_status === 'EMPTY_STRING' || result.suffix_status === 'NULL') {
        console.log('✅ CORRECT: Suffix properly cleared');
      } else {
        console.log('❌ ERROR: Suffix not properly cleared!');
        console.log('❌ This could be the source of the bug!');
      }
    }

    // Test 5: Check if there are any triggers or stored procedures affecting suffix
    console.log('\n📝 Step 5: Checking for triggers on student_profiles...');
    const triggers = await db.query(`
      SELECT
        TRIGGER_NAME,
        EVENT_MANIPULATION,
        ACTION_TIMING,
        ACTION_STATEMENT
      FROM INFORMATION_SCHEMA.TRIGGERS
      WHERE EVENT_OBJECT_SCHEMA = 'db_ebulletin_system' AND EVENT_OBJECT_TABLE = 'student_profiles'
    `);

    if (triggers.length > 0) {
      console.log('Found triggers on student_profiles:');
      triggers.forEach(trigger => {
        console.log(`  - ${trigger.TRIGGER_NAME} (${trigger.ACTION_TIMING} ${trigger.EVENT_MANIPULATION})`);
        if (trigger.ACTION_STATEMENT.includes('suffix')) {
          console.log('    ⚠️ This trigger affects the suffix field!');
          console.log(`    Statement: ${trigger.ACTION_STATEMENT}`);
        }
      });
    } else {
      console.log('✅ No triggers found on student_profiles table');
    }

    // Cleanup test data
    console.log('\n🧹 Cleaning up test data...');
    await db.execute('DELETE FROM student_profiles WHERE student_id = ?', [testStudentId]);
    await db.execute('DELETE FROM student_accounts WHERE student_id = ?', [testStudentId]);
    console.log('✅ Test data cleaned up');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    process.exit(0);
  }
}

testSuffixBug();
