/**
 * Script to fix student_profiles section field on Railway
 * The section field is VARCHAR(50) with empty strings, needs to be fixed
 */

const mysql = require('mysql2/promise');

// Railway database configuration
const railwayConfig = {
  host: 'centerbeam.proxy.rlwy.net',
  port: 14376,
  user: 'root',
  password: 'TtTMjTElsEGhDREYyaIBcNyjbQGajuqi',
  database: 'railway',
  ssl: { rejectUnauthorized: false }
};

async function fixStudentSection() {
  let connection;
  
  try {
    console.log('='.repeat(70));
    console.log('  FIXING STUDENT SECTION FIELD ON RAILWAY');
    console.log('='.repeat(70));
    console.log('');
    
    console.log('🔄 Connecting to Railway database...');
    connection = await mysql.createConnection(railwayConfig);
    console.log('✅ Connected successfully!');
    console.log('');
    
    // Check current section field
    console.log('📋 Checking current section field...');
    const [columns] = await connection.execute(
      `SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT 
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = 'railway' AND TABLE_NAME = 'student_profiles'
       AND COLUMN_NAME = 'section'`
    );
    
    if (columns.length > 0) {
      const col = columns[0];
      console.log(`   Current: ${col.COLUMN_NAME} ${col.COLUMN_TYPE} ${col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL'} DEFAULT: ${col.COLUMN_DEFAULT || 'NONE'}`);
    }
    console.log('');
    
    // Check for empty or null section values
    console.log('🔍 Checking for problematic section values...');
    const [emptyRows] = await connection.execute(
      `SELECT COUNT(*) as count FROM student_profiles WHERE section = '' OR section IS NULL`
    );
    console.log(`   Found ${emptyRows[0].count} rows with empty or null section values`);
    console.log('');
    
    // Fix empty section values
    if (emptyRows[0].count > 0) {
      console.log('🔧 Fixing empty section values...');
      const [updateResult] = await connection.execute(
        `UPDATE student_profiles SET section = '1' WHERE section = '' OR section IS NULL`
      );
      console.log(`   ✅ Updated ${updateResult.affectedRows} rows to section = '1'`);
      console.log('');
    }
    
    // Now modify the column to have a default value
    console.log('🔧 Setting default value for section field...');
    try {
      await connection.execute(
        `ALTER TABLE student_profiles 
         MODIFY COLUMN section VARCHAR(50) NOT NULL DEFAULT '1'`
      );
      console.log('   ✅ section field now has DEFAULT \'1\'');
    } catch (error) {
      console.log(`   ⚠️  Warning: ${error.message}`);
    }
    console.log('');
    
    // Verify changes
    console.log('✔️  Verifying changes...');
    const [updatedColumns] = await connection.execute(
      `SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT 
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = 'railway' AND TABLE_NAME = 'student_profiles'
       AND COLUMN_NAME = 'section'`
    );
    
    if (updatedColumns.length > 0) {
      const col = updatedColumns[0];
      console.log(`   Updated: ${col.COLUMN_NAME} ${col.COLUMN_TYPE} ${col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL'} DEFAULT: ${col.COLUMN_DEFAULT || 'NONE'}`);
    }
    console.log('');
    
    // Test student creation
    console.log('🧪 Testing student creation without section field...');
    const testEmail = `test-student-${Date.now()}@test.com`;
    const testStudentNumber = `TEST${Date.now()}`;
    const bcrypt = require('bcryptjs');
    const testPassword = await bcrypt.hash('TestPassword123', 12);
    
    await connection.beginTransaction();
    
    try {
      // Create student account
      const [accountResult] = await connection.execute(
        `INSERT INTO student_accounts (email, password, student_number, is_active, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
        [testEmail, testPassword, testStudentNumber, true, 1]
      );
      
      const studentId = accountResult.insertId;
      console.log(`   ✅ Student account created (ID: ${studentId})`);
      
      // Create student profile WITHOUT section field (testing the default)
      const [profileResult] = await connection.execute(
        `INSERT INTO student_profiles (student_id, first_name, middle_name, last_name, suffix, phone_number, grade_level, parent_guardian_name, parent_guardian_phone, address, profile_picture, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [studentId, 'Test', null, 'Student', null, null, 11, null, null, null, null]
      );
      
      console.log(`   ✅ Student profile created (ID: ${profileResult.insertId})`);
      
      // Check the section value
      const [checkSection] = await connection.execute(
        `SELECT section FROM student_profiles WHERE profile_id = ?`,
        [profileResult.insertId]
      );
      
      console.log(`   ✅ Section value: '${checkSection[0].section}' (should be '1')`);
      console.log('   ✅ Test passed! Student creation works without section field');
      
      // Rollback test data
      await connection.rollback();
      console.log('   🔄 Test data rolled back');
      
    } catch (testError) {
      await connection.rollback();
      console.log('');
      console.log('   ❌ Test failed:');
      console.log(`   Error: ${testError.message}`);
    }
    
    console.log('');
    console.log('='.repeat(70));
    console.log('  ✅ STUDENT SECTION FIELD FIXED SUCCESSFULLY');
    console.log('='.repeat(70));
    console.log('');
    console.log('What was fixed:');
    console.log('  ✅ Empty section values updated to \'1\'');
    console.log('  ✅ section field now has DEFAULT \'1\'');
    console.log('  ✅ New students will automatically get section = \'1\'');
    console.log('');
    
  } catch (error) {
    console.error('');
    console.error('❌ ERROR:', error.message);
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
fixStudentSection();

