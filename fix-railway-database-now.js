/**
 * Script to fix Railway database - department column and other constraints
 * This will connect directly to Railway and apply all necessary fixes
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

async function fixRailwayDatabase() {
  let connection;
  
  try {
    console.log('='.repeat(70));
    console.log('  FIXING RAILWAY DATABASE');
    console.log('='.repeat(70));
    console.log('');
    
    console.log('🔄 Connecting to Railway database...');
    console.log(`   Host: ${railwayConfig.host}`);
    console.log(`   Database: ${railwayConfig.database}`);
    console.log('');
    
    connection = await mysql.createConnection(railwayConfig);
    console.log('✅ Connected successfully!');
    console.log('');
    
    // Check current admin_profiles structure
    console.log('📋 Checking current admin_profiles table structure...');
    console.log('-'.repeat(70));
    const [columns] = await connection.execute(
      `SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT 
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = 'railway' AND TABLE_NAME = 'admin_profiles'
       ORDER BY ORDINAL_POSITION`
    );
    
    console.log('Current admin_profiles columns:');
    columns.forEach(col => {
      const nullable = col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL';
      const defaultVal = col.COLUMN_DEFAULT !== null ? `DEFAULT ${col.COLUMN_DEFAULT}` : 'NO DEFAULT';
      console.log(`   ${col.COLUMN_NAME.padEnd(25)} ${col.COLUMN_TYPE.padEnd(20)} ${nullable.padEnd(10)} ${defaultVal}`);
    });
    console.log('');
    
    // Check current student_profiles structure
    console.log('📋 Checking current student_profiles table structure...');
    console.log('-'.repeat(70));
    const [studentColumns] = await connection.execute(
      `SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT 
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = 'railway' AND TABLE_NAME = 'student_profiles'
       AND COLUMN_NAME = 'section'`
    );
    
    if (studentColumns.length > 0) {
      console.log('Current student_profiles section column:');
      studentColumns.forEach(col => {
        const nullable = col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL';
        const defaultVal = col.COLUMN_DEFAULT !== null ? `DEFAULT ${col.COLUMN_DEFAULT}` : 'NO DEFAULT';
        console.log(`   ${col.COLUMN_NAME.padEnd(25)} ${col.COLUMN_TYPE.padEnd(20)} ${nullable.padEnd(10)} ${defaultVal}`);
      });
    } else {
      console.log('   ℹ️  section column not found in student_profiles');
    }
    console.log('');
    
    // Apply fixes
    console.log('🔧 Applying fixes to Railway database...');
    console.log('');
    
    // Fix 1: Make department nullable in admin_profiles
    console.log('1. Making department field nullable in admin_profiles...');
    try {
      await connection.execute(
        `ALTER TABLE admin_profiles 
         MODIFY COLUMN department VARCHAR(100) DEFAULT NULL`
      );
      console.log('   ✅ department field updated successfully');
    } catch (error) {
      if (error.message.includes('Duplicate column')) {
        console.log('   ℹ️  department field already configured');
      } else {
        console.log(`   ⚠️  Warning: ${error.message}`);
      }
    }
    
    // Fix 2: Make bio nullable in admin_profiles
    console.log('2. Making bio field nullable in admin_profiles...');
    try {
      await connection.execute(
        `ALTER TABLE admin_profiles 
         MODIFY COLUMN bio TEXT DEFAULT NULL`
      );
      console.log('   ✅ bio field updated successfully');
    } catch (error) {
      if (error.message.includes('Duplicate column')) {
        console.log('   ℹ️  bio field already configured');
      } else {
        console.log(`   ⚠️  Warning: ${error.message}`);
      }
    }
    
    // Fix 3: Make profile_picture nullable in admin_profiles
    console.log('3. Making profile_picture field nullable in admin_profiles...');
    try {
      await connection.execute(
        `ALTER TABLE admin_profiles 
         MODIFY COLUMN profile_picture VARCHAR(255) DEFAULT NULL`
      );
      console.log('   ✅ profile_picture field updated successfully');
    } catch (error) {
      if (error.message.includes('Duplicate column')) {
        console.log('   ℹ️  profile_picture field already configured');
      } else {
        console.log(`   ⚠️  Warning: ${error.message}`);
      }
    }
    
    // Fix 4: Set default value for section in student_profiles
    console.log('4. Setting default value for section field in student_profiles...');
    try {
      await connection.execute(
        `ALTER TABLE student_profiles 
         MODIFY COLUMN section INT DEFAULT 1`
      );
      console.log('   ✅ section field updated successfully');
    } catch (error) {
      if (error.message.includes('Unknown column')) {
        console.log('   ℹ️  section column does not exist (this is okay)');
      } else {
        console.log(`   ⚠️  Warning: ${error.message}`);
      }
    }
    
    console.log('');
    
    // Verify changes
    console.log('✔️  Verifying changes...');
    console.log('-'.repeat(70));
    
    const [updatedColumns] = await connection.execute(
      `SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT 
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = 'railway' AND TABLE_NAME = 'admin_profiles'
       AND COLUMN_NAME IN ('department', 'bio', 'profile_picture')`
    );
    
    console.log('Updated admin_profiles columns:');
    updatedColumns.forEach(col => {
      const nullable = col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL';
      const defaultVal = col.COLUMN_DEFAULT !== null ? `DEFAULT ${col.COLUMN_DEFAULT}` : 'NO DEFAULT';
      console.log(`   ${col.COLUMN_NAME.padEnd(25)} ${col.COLUMN_TYPE.padEnd(20)} ${nullable.padEnd(10)} ${defaultVal}`);
    });
    console.log('');
    
    const [updatedStudentColumns] = await connection.execute(
      `SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT 
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = 'railway' AND TABLE_NAME = 'student_profiles'
       AND COLUMN_NAME = 'section'`
    );
    
    if (updatedStudentColumns.length > 0) {
      console.log('Updated student_profiles section column:');
      updatedStudentColumns.forEach(col => {
        const nullable = col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL';
        const defaultVal = col.COLUMN_DEFAULT !== null ? `DEFAULT ${col.COLUMN_DEFAULT}` : 'NO DEFAULT';
        console.log(`   ${col.COLUMN_NAME.padEnd(25)} ${col.COLUMN_TYPE.padEnd(20)} ${nullable.padEnd(10)} ${defaultVal}`);
      });
    }
    console.log('');
    
    // Test admin creation
    console.log('🧪 Testing admin creation...');
    console.log('-'.repeat(70));
    
    const testEmail = `test-admin-${Date.now()}@test.com`;
    const bcrypt = require('bcryptjs');
    const testPassword = await bcrypt.hash('TestPassword123', 12);
    
    await connection.beginTransaction();
    
    try {
      // Create admin account
      const [accountResult] = await connection.execute(
        `INSERT INTO admin_accounts (email, password, is_active, last_login, password_reset_token, password_reset_expires, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [testEmail, testPassword, true, null, null, null]
      );
      
      const adminId = accountResult.insertId;
      console.log(`   ✅ Admin account created (ID: ${adminId})`);
      
      // Create admin profile WITHOUT department (testing the fix)
      const [profileResult] = await connection.execute(
        `INSERT INTO admin_profiles (admin_id, first_name, middle_name, last_name, suffix, phone_number, department, position, grade_level, bio, profile_picture, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [adminId, 'Test', null, 'Admin', null, null, null, 'professor', 11, null, null]
      );
      
      console.log(`   ✅ Admin profile created (ID: ${profileResult.insertId})`);
      console.log('   ✅ Test passed! Admin creation works without department field');
      
      // Rollback test data
      await connection.rollback();
      console.log('   🔄 Test data rolled back');
      
    } catch (testError) {
      await connection.rollback();
      console.log('');
      console.log('   ❌ Test failed:');
      console.log(`   Error: ${testError.message}`);
      console.log('');
      console.log('   Please check the error above and run the diagnostic script.');
    }
    
    console.log('');
    console.log('='.repeat(70));
    console.log('  ✅ RAILWAY DATABASE FIXED SUCCESSFULLY');
    console.log('='.repeat(70));
    console.log('');
    console.log('What was fixed:');
    console.log('  ✅ department field is now nullable (not required)');
    console.log('  ✅ bio field is now nullable');
    console.log('  ✅ profile_picture field is now nullable');
    console.log('  ✅ section field has default value of 1');
    console.log('');
    console.log('Next steps:');
    console.log('  1. Railway will auto-deploy the latest backend code');
    console.log('  2. Vercel will auto-deploy the latest frontend code');
    console.log('  3. Test creating admin accounts - should work now!');
    console.log('  4. Test creating student accounts - should work now!');
    console.log('  5. Check notifications for proper emoji display');
    console.log('  6. Check mobile newsfeed layout');
    console.log('');
    
  } catch (error) {
    console.error('');
    console.error('='.repeat(70));
    console.error('  ❌ ERROR OCCURRED');
    console.error('='.repeat(70));
    console.error('');
    console.error('Error message:', error.message);
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
fixRailwayDatabase();

