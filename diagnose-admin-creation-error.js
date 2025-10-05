/**
 * Diagnostic script to identify admin creation issues on Railway
 * This script checks the database schema and attempts to create a test admin
 * to identify the exact field causing the 500 error
 */

require('dotenv').config();
const mysql = require('mysql2/promise');

async function diagnoseAdminCreationError() {
  let connection;
  
  try {
    console.log('='.repeat(70));
    console.log('  ADMIN CREATION ERROR DIAGNOSTIC');
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
    
    // Step 1: Check admin_accounts table structure
    console.log('Step 1: Checking admin_accounts table structure...');
    console.log('-'.repeat(70));
    const [accountColumns] = await connection.execute(
      `SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_KEY
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'admin_accounts'
       ORDER BY ORDINAL_POSITION`,
      [process.env.DB_NAME]
    );
    
    console.log('admin_accounts columns:');
    accountColumns.forEach(col => {
      const nullable = col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL';
      const defaultVal = col.COLUMN_DEFAULT !== null ? `DEFAULT ${col.COLUMN_DEFAULT}` : 'NO DEFAULT';
      const key = col.COLUMN_KEY ? `[${col.COLUMN_KEY}]` : '';
      console.log(`   ${col.COLUMN_NAME.padEnd(30)} ${col.COLUMN_TYPE.padEnd(20)} ${nullable.padEnd(10)} ${defaultVal.padEnd(20)} ${key}`);
    });
    console.log('');
    
    // Step 2: Check admin_profiles table structure
    console.log('Step 2: Checking admin_profiles table structure...');
    console.log('-'.repeat(70));
    const [profileColumns] = await connection.execute(
      `SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_KEY
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'admin_profiles'
       ORDER BY ORDINAL_POSITION`,
      [process.env.DB_NAME]
    );
    
    console.log('admin_profiles columns:');
    profileColumns.forEach(col => {
      const nullable = col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL';
      const defaultVal = col.COLUMN_DEFAULT !== null ? `DEFAULT ${col.COLUMN_DEFAULT}` : 'NO DEFAULT';
      const key = col.COLUMN_KEY ? `[${col.COLUMN_KEY}]` : '';
      console.log(`   ${col.COLUMN_NAME.padEnd(30)} ${col.COLUMN_TYPE.padEnd(20)} ${nullable.padEnd(10)} ${defaultVal.padEnd(20)} ${key}`);
    });
    console.log('');
    
    // Step 3: Check for constraints
    console.log('Step 3: Checking table constraints...');
    console.log('-'.repeat(70));
    const [constraints] = await connection.execute(
      `SELECT CONSTRAINT_NAME, CONSTRAINT_TYPE, TABLE_NAME
       FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN ('admin_accounts', 'admin_profiles')`,
      [process.env.DB_NAME]
    );
    
    console.log('Table constraints:');
    constraints.forEach(constraint => {
      console.log(`   ${constraint.TABLE_NAME.padEnd(20)} ${constraint.CONSTRAINT_NAME.padEnd(40)} ${constraint.CONSTRAINT_TYPE}`);
    });
    console.log('');
    
    // Step 4: Identify NOT NULL fields without defaults
    console.log('Step 4: Identifying potential problem fields...');
    console.log('-'.repeat(70));
    
    const problemFields = {
      admin_accounts: accountColumns.filter(col => 
        col.IS_NULLABLE === 'NO' && 
        col.COLUMN_DEFAULT === null && 
        col.COLUMN_KEY !== 'PRI' &&
        !col.COLUMN_NAME.includes('_at')
      ),
      admin_profiles: profileColumns.filter(col => 
        col.IS_NULLABLE === 'NO' && 
        col.COLUMN_DEFAULT === null && 
        col.COLUMN_KEY !== 'PRI' &&
        col.COLUMN_KEY !== 'MUL' &&
        !col.COLUMN_NAME.includes('_at')
      )
    };
    
    console.log('⚠️  Fields that are NOT NULL without defaults:');
    console.log('');
    console.log('admin_accounts:');
    if (problemFields.admin_accounts.length === 0) {
      console.log('   ✅ No problem fields found');
    } else {
      problemFields.admin_accounts.forEach(col => {
        console.log(`   ❌ ${col.COLUMN_NAME} (${col.COLUMN_TYPE}) - MUST be provided`);
      });
    }
    console.log('');
    
    console.log('admin_profiles:');
    if (problemFields.admin_profiles.length === 0) {
      console.log('   ✅ No problem fields found');
    } else {
      problemFields.admin_profiles.forEach(col => {
        console.log(`   ❌ ${col.COLUMN_NAME} (${col.COLUMN_TYPE}) - MUST be provided`);
      });
    }
    console.log('');
    
    // Step 5: Test admin creation with minimal data
    console.log('Step 5: Testing admin creation with minimal data...');
    console.log('-'.repeat(70));
    
    const testEmail = `test-admin-${Date.now()}@test.com`;
    const testPassword = 'hashed_password_test';
    
    await connection.beginTransaction();
    
    try {
      // Try to create admin account
      console.log('   Attempting to create admin account...');
      const [accountResult] = await connection.execute(
        `INSERT INTO admin_accounts (email, password, is_active, last_login, password_reset_token, password_reset_expires, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [testEmail, testPassword, true, null, null, null]
      );
      
      const adminId = accountResult.insertId;
      console.log(`   ✅ Admin account created (ID: ${adminId})`);
      
      // Try to create admin profile with minimal data
      console.log('   Attempting to create admin profile...');
      const [profileResult] = await connection.execute(
        `INSERT INTO admin_profiles (admin_id, first_name, middle_name, last_name, suffix, phone_number, department, position, grade_level, bio, profile_picture, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [adminId, 'Test', null, 'Admin', null, null, null, 'professor', 11, null, null]
      );
      
      console.log(`   ✅ Admin profile created (ID: ${profileResult.insertId})`);
      console.log('');
      console.log('✅ Test successful! Admin creation works with this data.');
      
      // Rollback test data
      await connection.rollback();
      console.log('   🔄 Test data rolled back');
      
    } catch (testError) {
      await connection.rollback();
      console.log('');
      console.log('❌ Test failed with error:');
      console.log(`   Error Code: ${testError.code}`);
      console.log(`   Error Message: ${testError.message}`);
      console.log(`   SQL State: ${testError.sqlState}`);
      console.log('');
      
      // Analyze the error
      if (testError.message.includes("doesn't have a default value")) {
        const match = testError.message.match(/Field '(\w+)'/);
        if (match) {
          console.log(`🔍 DIAGNOSIS: The field '${match[1]}' requires a value but none was provided.`);
          console.log(`   This field must be included in the admin creation request.`);
        }
      } else if (testError.message.includes('cannot be null')) {
        console.log('🔍 DIAGNOSIS: A required field is being set to NULL.');
        console.log('   Check which fields are marked as NOT NULL in the schema above.');
      } else if (testError.code === 'ER_NO_DEFAULT_FOR_FIELD') {
        console.log('🔍 DIAGNOSIS: A field without a default value is missing.');
      }
    }
    
    console.log('');
    console.log('='.repeat(70));
    console.log('  DIAGNOSTIC COMPLETE');
    console.log('='.repeat(70));
    console.log('');
    console.log('Recommendations:');
    console.log('1. Check the problem fields identified above');
    console.log('2. Ensure all NOT NULL fields are provided in the admin creation request');
    console.log('3. Add default values in the backend code for optional fields');
    console.log('4. Consider running a migration to add default values to the database');
    console.log('');
    
  } catch (error) {
    console.error('');
    console.error('='.repeat(70));
    console.error('  ❌ DIAGNOSTIC ERROR');
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

// Run the diagnostic
console.log('');
diagnoseAdminCreationError();

