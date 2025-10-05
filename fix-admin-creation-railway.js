/**
 * Script to fix admin creation issues on Railway
 * This ensures all optional fields in admin_profiles are properly nullable
 */

require('dotenv').config();
const mysql = require('mysql2/promise');

async function fixAdminCreation() {
  let connection;
  
  try {
    console.log('='.repeat(70));
    console.log('  FIX ADMIN CREATION ON RAILWAY');
    console.log('='.repeat(70));
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
    
    // Check current table structure
    console.log('📋 Checking current admin_profiles table structure...');
    const [columns] = await connection.execute(
      `SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT 
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'admin_profiles'
       AND COLUMN_NAME IN ('department', 'bio', 'profile_picture')`,
      [process.env.DB_NAME]
    );
    
    console.log('Current configuration:');
    columns.forEach(col => {
      console.log(`   ${col.COLUMN_NAME.padEnd(20)} ${col.COLUMN_TYPE.padEnd(20)} ${col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL'.padEnd(10)} DEFAULT: ${col.COLUMN_DEFAULT || 'NULL'}`);
    });
    console.log('');
    
    // Apply fixes
    console.log('🔧 Applying fixes...');
    console.log('');
    
    // Fix 1: Make department nullable
    console.log('1. Making department field nullable...');
    try {
      await connection.execute(
        `ALTER TABLE admin_profiles 
         MODIFY COLUMN department VARCHAR(100) DEFAULT NULL`
      );
      console.log('   ✅ department field updated');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME' || error.message.includes('Duplicate column')) {
        console.log('   ℹ️  department field already configured');
      } else {
        throw error;
      }
    }
    
    // Fix 2: Make bio nullable
    console.log('2. Making bio field nullable...');
    try {
      await connection.execute(
        `ALTER TABLE admin_profiles 
         MODIFY COLUMN bio TEXT DEFAULT NULL`
      );
      console.log('   ✅ bio field updated');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME' || error.message.includes('Duplicate column')) {
        console.log('   ℹ️  bio field already configured');
      } else {
        throw error;
      }
    }
    
    // Fix 3: Make profile_picture nullable
    console.log('3. Making profile_picture field nullable...');
    try {
      await connection.execute(
        `ALTER TABLE admin_profiles 
         MODIFY COLUMN profile_picture VARCHAR(255) DEFAULT NULL`
      );
      console.log('   ✅ profile_picture field updated');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME' || error.message.includes('Duplicate column')) {
        console.log('   ℹ️  profile_picture field already configured');
      } else {
        throw error;
      }
    }
    
    console.log('');
    
    // Verify changes
    console.log('✔️  Verifying changes...');
    const [updatedColumns] = await connection.execute(
      `SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT 
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'admin_profiles'
       AND COLUMN_NAME IN ('department', 'bio', 'profile_picture')`,
      [process.env.DB_NAME]
    );
    
    console.log('Updated configuration:');
    updatedColumns.forEach(col => {
      console.log(`   ${col.COLUMN_NAME.padEnd(20)} ${col.COLUMN_TYPE.padEnd(20)} ${col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL'.padEnd(10)} DEFAULT: ${col.COLUMN_DEFAULT || 'NULL'}`);
    });
    console.log('');
    
    // Test admin creation
    console.log('🧪 Testing admin creation...');
    const testEmail = `test-admin-${Date.now()}@test.com`;
    const testPassword = 'hashed_password_test';
    
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
      
      // Create admin profile WITHOUT optional fields
      const [profileResult] = await connection.execute(
        `INSERT INTO admin_profiles (admin_id, first_name, middle_name, last_name, suffix, phone_number, department, position, grade_level, bio, profile_picture, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [adminId, 'Test', null, 'Admin', null, null, null, 'professor', 11, null, null]
      );
      
      console.log(`   ✅ Admin profile created (ID: ${profileResult.insertId})`);
      console.log('');
      console.log('✅ Test passed! Admin creation works correctly.');
      
      // Rollback test data
      await connection.rollback();
      console.log('   🔄 Test data rolled back');
      
    } catch (testError) {
      await connection.rollback();
      console.log('');
      console.log('❌ Test failed:');
      console.log(`   ${testError.message}`);
      console.log('');
      console.log('   The issue may require additional investigation.');
    }
    
    console.log('');
    console.log('='.repeat(70));
    console.log('  ✅ FIX COMPLETED');
    console.log('='.repeat(70));
    console.log('');
    console.log('What was fixed:');
    console.log('  • department field is now nullable');
    console.log('  • bio field is now nullable');
    console.log('  • profile_picture field is now nullable');
    console.log('');
    console.log('Next steps:');
    console.log('  1. Test creating an admin account through the admin interface');
    console.log('  2. Verify that no 500 error occurs');
    console.log('  3. Check that the admin is created successfully');
    console.log('');
    
  } catch (error) {
    console.error('');
    console.error('='.repeat(70));
    console.error('  ❌ ERROR OCCURRED');
    console.error('='.repeat(70));
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
fixAdminCreation();

