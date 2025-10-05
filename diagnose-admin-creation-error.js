/**
 * Diagnostic Script for Admin Account Creation Error on Railway
 * 
 * This script helps diagnose why admin account creation works on localhost
 * but fails with 500 error on Railway production.
 * 
 * Run this script on Railway to identify the issue:
 * node diagnose-admin-creation-error.js
 */

require('dotenv').config();
const mysql = require('mysql2/promise');

async function diagnoseAdminCreationError() {
  let connection;
  
  try {
    console.log('🔍 Starting Admin Creation Error Diagnosis...\n');
    
    // Connect to database
    console.log('📡 Connecting to database...');
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      charset: 'utf8mb4'
    });
    console.log('✅ Connected to database\n');

    // Check admin_accounts table structure
    console.log('📋 Checking admin_accounts table structure:');
    const [accountColumns] = await connection.execute('DESCRIBE admin_accounts');
    console.log('Columns:');
    accountColumns.forEach(col => {
      const nullable = col.Null === 'YES' ? 'NULL' : 'NOT NULL';
      const defaultVal = col.Default !== null ? `DEFAULT ${col.Default}` : 'NO DEFAULT';
      console.log(`  - ${col.Field}: ${col.Type} ${nullable} ${defaultVal}`);
    });
    console.log('');

    // Check admin_profiles table structure
    console.log('📋 Checking admin_profiles table structure:');
    const [profileColumns] = await connection.execute('DESCRIBE admin_profiles');
    console.log('Columns:');
    profileColumns.forEach(col => {
      const nullable = col.Null === 'YES' ? 'NULL' : 'NOT NULL';
      const defaultVal = col.Default !== null ? `DEFAULT ${col.Default}` : 'NO DEFAULT';
      console.log(`  - ${col.Field}: ${col.Type} ${nullable} ${defaultVal}`);
    });
    console.log('');

    // Identify fields without defaults that are NOT NULL
    console.log('⚠️  Potential Problem Fields (NOT NULL without DEFAULT):');
    const problemFields = profileColumns.filter(col => 
      col.Null === 'NO' && 
      col.Default === null && 
      col.Extra !== 'auto_increment'
    );
    
    if (problemFields.length > 0) {
      console.log('admin_profiles table:');
      problemFields.forEach(col => {
        console.log(`  ❌ ${col.Field}: ${col.Type} - REQUIRES VALUE`);
      });
    } else {
      console.log('  ✅ No problem fields found in admin_profiles');
    }
    console.log('');

    // Check constraints
    console.log('🔒 Checking table constraints:');
    const [constraints] = await connection.execute(`
      SELECT 
        CONSTRAINT_NAME,
        CONSTRAINT_TYPE,
        TABLE_NAME
      FROM information_schema.TABLE_CONSTRAINTS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN ('admin_accounts', 'admin_profiles')
    `, [process.env.DB_NAME]);
    
    console.log('Constraints:');
    constraints.forEach(constraint => {
      console.log(`  - ${constraint.TABLE_NAME}.${constraint.CONSTRAINT_NAME}: ${constraint.CONSTRAINT_TYPE}`);
    });
    console.log('');

    // Check foreign keys
    console.log('🔗 Checking foreign key constraints:');
    const [foreignKeys] = await connection.execute(`
      SELECT 
        CONSTRAINT_NAME,
        TABLE_NAME,
        COLUMN_NAME,
        REFERENCED_TABLE_NAME,
        REFERENCED_COLUMN_NAME
      FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = ? 
        AND TABLE_NAME IN ('admin_accounts', 'admin_profiles')
        AND REFERENCED_TABLE_NAME IS NOT NULL
    `, [process.env.DB_NAME]);
    
    if (foreignKeys.length > 0) {
      foreignKeys.forEach(fk => {
        console.log(`  - ${fk.TABLE_NAME}.${fk.COLUMN_NAME} -> ${fk.REFERENCED_TABLE_NAME}.${fk.REFERENCED_COLUMN_NAME}`);
      });
    } else {
      console.log('  ✅ No foreign key constraints found');
    }
    console.log('');

    // Test admin creation with minimal data
    console.log('🧪 Testing admin creation with minimal data...');
    const testEmail = `test_${Date.now()}@test.com`;
    
    try {
      // Start transaction
      await connection.beginTransaction();
      
      // Insert admin account
      const [accountResult] = await connection.execute(
        `INSERT INTO admin_accounts (email, password, is_active, created_at, updated_at)
         VALUES (?, ?, ?, NOW(), NOW())`,
        [testEmail, '$2a$12$test.hash.password', true]
      );
      
      const adminId = accountResult.insertId;
      console.log(`  ✅ Admin account created with ID: ${adminId}`);
      
      // Try to insert admin profile with minimal data
      try {
        await connection.execute(
          `INSERT INTO admin_profiles (admin_id, first_name, last_name, created_at, updated_at)
           VALUES (?, ?, ?, NOW(), NOW())`,
          [adminId, 'Test', 'Admin']
        );
        console.log('  ✅ Admin profile created successfully with minimal data');
        console.log('  ℹ️  This means the issue is likely with optional fields being sent as undefined/null');
      } catch (profileError) {
        console.log('  ❌ Admin profile creation failed:');
        console.log(`     Error: ${profileError.message}`);
        console.log(`     Code: ${profileError.code}`);
        
        if (profileError.code === 'ER_NO_DEFAULT_FOR_FIELD') {
          const fieldMatch = profileError.message.match(/Field '([^']+)'/);
          if (fieldMatch) {
            console.log(`\n  🎯 FOUND THE PROBLEM!`);
            console.log(`     Field '${fieldMatch[1]}' doesn't have a default value`);
            console.log(`     This field must be provided or given a default value in the database`);
          }
        }
      }
      
      // Rollback test transaction
      await connection.rollback();
      console.log('  🔄 Test transaction rolled back\n');
      
    } catch (testError) {
      await connection.rollback();
      console.log(`  ❌ Test failed: ${testError.message}\n`);
    }

    // Provide recommendations
    console.log('💡 RECOMMENDATIONS:');
    console.log('');
    
    if (problemFields.length > 0) {
      console.log('1. Add default values to the following fields in admin_profiles table:');
      problemFields.forEach(col => {
        let suggestedDefault = 'NULL';
        if (col.Field === 'department') suggestedDefault = "'General'";
        if (col.Field === 'position') suggestedDefault = "'professor'";
        
        console.log(`   ALTER TABLE admin_profiles MODIFY ${col.Field} ${col.Type} DEFAULT ${suggestedDefault};`);
      });
      console.log('');
    }
    
    console.log('2. Ensure the backend code provides default values for all required fields');
    console.log('3. Check that the frontend is sending all required fields in the request');
    console.log('4. Compare the database schema between localhost and Railway');
    console.log('');
    
    console.log('✅ Diagnosis complete!');
    
  } catch (error) {
    console.error('❌ Diagnosis failed:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n📡 Database connection closed');
    }
  }
}

// Run diagnosis
if (require.main === module) {
  diagnoseAdminCreationError()
    .then(() => {
      console.log('\n🎉 Diagnosis script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Diagnosis script failed:', error);
      process.exit(1);
    });
}

module.exports = diagnoseAdminCreationError;

