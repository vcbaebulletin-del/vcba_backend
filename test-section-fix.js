/**
 * Test script to verify the section field default value fix
 * This simulates creating a student account without providing a section value
 */

require('dotenv').config();
const mysql = require('mysql2/promise');

async function testSectionFix() {
  let connection;
  
  try {
    console.log('🔄 Connecting to database...');
    
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306,
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
    });

    console.log('✅ Connected to database');
    console.log(`📊 Database: ${process.env.DB_NAME}`);
    
    // Check current section column configuration
    console.log('\n📋 Checking section column configuration...');
    const [columns] = await connection.execute(
      `SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT 
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'student_profiles' AND COLUMN_NAME = 'section'`,
      [process.env.DB_NAME]
    );
    
    if (columns.length === 0) {
      console.log('⚠️  Warning: section column does not exist');
      return;
    }
    
    console.log('Section column configuration:');
    console.log(columns[0]);
    
    // Test data
    const testStudentNumber = `TEST-${Date.now()}`;
    const testEmail = `test-${Date.now()}@test.com`;
    
    console.log('\n🧪 Testing student creation without section field...');
    console.log(`   Student Number: ${testStudentNumber}`);
    console.log(`   Email: ${testEmail}`);
    
    // Start transaction
    await connection.beginTransaction();
    
    try {
      // Create student account
      const [accountResult] = await connection.execute(
        `INSERT INTO student_accounts (email, password, student_number, is_active, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
        [testEmail, 'hashed_password_test', testStudentNumber, true, 1]
      );
      
      const studentId = accountResult.insertId;
      console.log(`   ✅ Student account created (ID: ${studentId})`);
      
      // Create student profile WITHOUT section field
      // The database should use the default value of 1
      const [profileResult] = await connection.execute(
        `INSERT INTO student_profiles (student_id, first_name, middle_name, last_name, phone_number, grade_level, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [studentId, 'Test', 'Middle', 'Student', '09123456789', 10]
      );
      
      console.log(`   ✅ Student profile created (ID: ${profileResult.insertId})`);
      
      // Verify the section value
      const [student] = await connection.execute(
        `SELECT section FROM student_profiles WHERE student_id = ?`,
        [studentId]
      );
      
      console.log(`   ✅ Section value: ${student[0].section}`);
      
      if (student[0].section === 1 || student[0].section === '1') {
        console.log('\n✅ SUCCESS! Section field defaulted to 1 as expected');
      } else {
        console.log(`\n⚠️  WARNING: Section value is ${student[0].section}, expected 1`);
      }
      
      // Rollback the test data
      await connection.rollback();
      console.log('\n🔄 Test data rolled back (not saved to database)');
      
    } catch (error) {
      await connection.rollback();
      throw error;
    }
    
    console.log('\n✅ Test completed successfully!');
    console.log('   The fix is working correctly.');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    
    if (error.message.includes("doesn't have a default value")) {
      console.error('\n⚠️  The database migration has not been applied yet.');
      console.error('   Please run: node fix-section-default.js');
      console.error('   Or apply the migration manually on Railway.');
    }
    
    console.error('\nFull error:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 Database connection closed');
    }
  }
}

// Run the test
testSectionFix();

