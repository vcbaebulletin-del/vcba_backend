/**
 * Apply section field default value fix to Railway database
 * 
 * This script can be run directly on Railway using:
 * railway run node apply-section-fix-railway.js
 * 
 * Or you can run it locally after updating .env with Railway credentials
 */

require('dotenv').config();
const mysql = require('mysql2/promise');

async function applySectionFix() {
  let connection;
  
  try {
    console.log('='.repeat(60));
    console.log('  SECTION FIELD DEFAULT VALUE FIX');
    console.log('='.repeat(60));
    console.log('');
    
    console.log('🔄 Connecting to database...');
    console.log(`   Host: ${process.env.DB_HOST}`);
    console.log(`   Database: ${process.env.DB_NAME}`);
    console.log('');
    
    // Create connection
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306,
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
    });

    console.log('✅ Connected successfully!');
    console.log('');
    
    // Step 1: Check if section column exists
    console.log('Step 1: Checking if section column exists...');
    const [columns] = await connection.execute(
      `SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT 
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'student_profiles' AND COLUMN_NAME = 'section'`,
      [process.env.DB_NAME]
    );
    
    if (columns.length === 0) {
      console.log('⚠️  Section column does not exist in student_profiles table');
      console.log('   This might be expected if the column was removed.');
      console.log('   No action needed.');
      return;
    }
    
    console.log('✅ Section column found');
    console.log('');
    
    // Step 2: Show current configuration
    console.log('Step 2: Current section column configuration:');
    console.log('-'.repeat(60));
    console.log(`   Column Name:    ${columns[0].COLUMN_NAME}`);
    console.log(`   Column Type:    ${columns[0].COLUMN_TYPE}`);
    console.log(`   Nullable:       ${columns[0].IS_NULLABLE}`);
    console.log(`   Default Value:  ${columns[0].COLUMN_DEFAULT || 'NULL'}`);
    console.log('-'.repeat(60));
    console.log('');
    
    // Step 3: Check if fix is already applied
    if (columns[0].COLUMN_DEFAULT === '1' && columns[0].COLUMN_TYPE.includes('int')) {
      console.log('✅ Fix is already applied!');
      console.log('   Section column already has default value of 1');
      console.log('   No action needed.');
      return;
    }
    
    // Step 4: Apply the fix
    console.log('Step 3: Applying fix...');
    console.log('   Running: ALTER TABLE student_profiles MODIFY COLUMN section INT DEFAULT 1');
    console.log('');
    
    await connection.execute(
      `ALTER TABLE student_profiles 
       MODIFY COLUMN section INT DEFAULT 1`
    );
    
    console.log('✅ Fix applied successfully!');
    console.log('');
    
    // Step 5: Verify the change
    console.log('Step 4: Verifying the change...');
    const [updatedColumns] = await connection.execute(
      `SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT 
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'student_profiles' AND COLUMN_NAME = 'section'`,
      [process.env.DB_NAME]
    );
    
    console.log('-'.repeat(60));
    console.log(`   Column Name:    ${updatedColumns[0].COLUMN_NAME}`);
    console.log(`   Column Type:    ${updatedColumns[0].COLUMN_TYPE}`);
    console.log(`   Nullable:       ${updatedColumns[0].IS_NULLABLE}`);
    console.log(`   Default Value:  ${updatedColumns[0].COLUMN_DEFAULT || 'NULL'}`);
    console.log('-'.repeat(60));
    console.log('');
    
    // Step 6: Test the fix
    console.log('Step 5: Testing the fix...');
    const testStudentNumber = `TEST-${Date.now()}`;
    const testEmail = `test-${Date.now()}@test.com`;
    
    await connection.beginTransaction();
    
    try {
      // Create test student account
      const [accountResult] = await connection.execute(
        `INSERT INTO student_accounts (email, password, student_number, is_active, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
        [testEmail, 'test_password', testStudentNumber, true, 1]
      );
      
      const studentId = accountResult.insertId;
      
      // Create test student profile WITHOUT section field
      const [profileResult] = await connection.execute(
        `INSERT INTO student_profiles (student_id, first_name, last_name, phone_number, grade_level, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
        [studentId, 'Test', 'Student', '09123456789', 10]
      );
      
      // Check the section value
      const [student] = await connection.execute(
        `SELECT section FROM student_profiles WHERE student_id = ?`,
        [studentId]
      );
      
      // Rollback test data
      await connection.rollback();
      
      if (student[0].section === 1 || student[0].section === '1') {
        console.log('✅ Test passed! Section defaulted to 1');
      } else {
        console.log(`⚠️  Test warning: Section value is ${student[0].section}, expected 1`);
      }
      
    } catch (testError) {
      await connection.rollback();
      console.log('⚠️  Test failed:', testError.message);
    }
    
    console.log('');
    console.log('='.repeat(60));
    console.log('  ✅ FIX COMPLETED SUCCESSFULLY!');
    console.log('='.repeat(60));
    console.log('');
    console.log('What was fixed:');
    console.log('  • Section column now has default value of 1');
    console.log('  • Student accounts can be created without providing section');
    console.log('  • Section will automatically default to 1');
    console.log('');
    console.log('Next steps:');
    console.log('  1. Test creating a student account through the admin interface');
    console.log('  2. Verify that no error occurs');
    console.log('  3. Check that the student has section = 1');
    console.log('');
    
  } catch (error) {
    console.error('');
    console.error('='.repeat(60));
    console.error('  ❌ ERROR OCCURRED');
    console.error('='.repeat(60));
    console.error('');
    console.error('Error message:', error.message);
    console.error('');
    
    if (error.code === 'ECONNREFUSED') {
      console.error('Connection refused. Please check:');
      console.error('  • Database host is correct');
      console.error('  • Database port is correct');
      console.error('  • Database is running');
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('Access denied. Please check:');
      console.error('  • Database username is correct');
      console.error('  • Database password is correct');
    } else if (error.code === 'ER_BAD_DB_ERROR') {
      console.error('Database not found. Please check:');
      console.error('  • Database name is correct');
    }
    
    console.error('');
    console.error('Full error details:');
    console.error(error);
    console.error('');
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Database connection closed');
      console.log('');
    }
  }
}

// Run the fix
console.log('');
applySectionFix();

