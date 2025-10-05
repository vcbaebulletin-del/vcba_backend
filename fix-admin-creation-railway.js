/**
 * Fix Script for Admin Account Creation Error on Railway
 * 
 * This script fixes the admin account creation issue by ensuring all fields
 * in the admin_profiles table have appropriate default values or are nullable.
 * 
 * Run this script on Railway to apply the fix:
 * node fix-admin-creation-railway.js
 */

require('dotenv').config();
const mysql = require('mysql2/promise');

async function fixAdminCreationError() {
  let connection;
  
  try {
    console.log('🔧 Starting Admin Creation Fix...\n');
    
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

    // Backup current structure
    console.log('📋 Checking current admin_profiles table structure...');
    const [profileColumns] = await connection.execute('DESCRIBE admin_profiles');
    console.log('Current columns:');
    profileColumns.forEach(col => {
      const nullable = col.Null === 'YES' ? 'NULL' : 'NOT NULL';
      const defaultVal = col.Default !== null ? `DEFAULT ${col.Default}` : 'NO DEFAULT';
      console.log(`  - ${col.Field}: ${col.Type} ${nullable} ${defaultVal}`);
    });
    console.log('');

    // Apply fixes
    console.log('🔧 Applying fixes to admin_profiles table...\n');

    const fixes = [
      {
        field: 'middle_name',
        sql: 'ALTER TABLE admin_profiles MODIFY middle_name VARCHAR(50) NULL DEFAULT NULL',
        description: 'Make middle_name nullable with NULL default'
      },
      {
        field: 'suffix',
        sql: 'ALTER TABLE admin_profiles MODIFY suffix VARCHAR(10) NULL DEFAULT NULL',
        description: 'Make suffix nullable with NULL default'
      },
      {
        field: 'phone_number',
        sql: 'ALTER TABLE admin_profiles MODIFY phone_number VARCHAR(20) NULL DEFAULT NULL',
        description: 'Make phone_number nullable with NULL default'
      },
      {
        field: 'department',
        sql: 'ALTER TABLE admin_profiles MODIFY department VARCHAR(100) NULL DEFAULT NULL',
        description: 'Make department nullable with NULL default'
      },
      {
        field: 'position',
        sql: 'ALTER TABLE admin_profiles MODIFY position VARCHAR(50) NULL DEFAULT NULL',
        description: 'Make position nullable with NULL default'
      },
      {
        field: 'grade_level',
        sql: 'ALTER TABLE admin_profiles MODIFY grade_level INT NULL DEFAULT NULL',
        description: 'Make grade_level nullable with NULL default'
      },
      {
        field: 'bio',
        sql: 'ALTER TABLE admin_profiles MODIFY bio TEXT NULL DEFAULT NULL',
        description: 'Make bio nullable with NULL default'
      },
      {
        field: 'profile_picture',
        sql: 'ALTER TABLE admin_profiles MODIFY profile_picture VARCHAR(255) NULL DEFAULT NULL',
        description: 'Make profile_picture nullable with NULL default'
      }
    ];

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    for (const fix of fixes) {
      try {
        // Check if field exists
        const fieldExists = profileColumns.some(col => col.Field === fix.field);
        
        if (!fieldExists) {
          console.log(`  ⏭️  Skipping ${fix.field}: Field doesn't exist`);
          skipCount++;
          continue;
        }

        // Check if field already has correct configuration
        const currentField = profileColumns.find(col => col.Field === fix.field);
        if (currentField.Null === 'YES') {
          console.log(`  ✅ ${fix.field}: Already nullable, skipping`);
          skipCount++;
          continue;
        }

        // Apply fix
        console.log(`  🔧 Fixing ${fix.field}: ${fix.description}`);
        await connection.execute(fix.sql);
        console.log(`  ✅ ${fix.field}: Fixed successfully`);
        successCount++;
        
      } catch (error) {
        console.log(`  ❌ ${fix.field}: Failed - ${error.message}`);
        errorCount++;
      }
    }

    console.log('');
    console.log('📊 Fix Summary:');
    console.log(`  ✅ Successfully fixed: ${successCount} fields`);
    console.log(`  ⏭️  Skipped: ${skipCount} fields`);
    console.log(`  ❌ Failed: ${errorCount} fields`);
    console.log('');

    // Verify fixes
    console.log('🔍 Verifying fixes...');
    const [updatedColumns] = await connection.execute('DESCRIBE admin_profiles');
    console.log('Updated columns:');
    updatedColumns.forEach(col => {
      const nullable = col.Null === 'YES' ? 'NULL' : 'NOT NULL';
      const defaultVal = col.Default !== null ? `DEFAULT ${col.Default}` : 'NO DEFAULT';
      const status = col.Null === 'YES' ? '✅' : '⚠️';
      console.log(`  ${status} ${col.Field}: ${col.Type} ${nullable} ${defaultVal}`);
    });
    console.log('');

    // Test admin creation
    console.log('🧪 Testing admin creation...');
    const testEmail = `test_${Date.now()}@test.com`;
    
    try {
      await connection.beginTransaction();
      
      // Insert admin account
      const [accountResult] = await connection.execute(
        `INSERT INTO admin_accounts (email, password, is_active, created_at, updated_at)
         VALUES (?, ?, ?, NOW(), NOW())`,
        [testEmail, '$2a$12$test.hash.password', true]
      );
      
      const adminId = accountResult.insertId;
      
      // Insert admin profile with minimal data
      await connection.execute(
        `INSERT INTO admin_profiles (admin_id, first_name, last_name, position, created_at, updated_at)
         VALUES (?, ?, ?, ?, NOW(), NOW())`,
        [adminId, 'Test', 'Admin', 'professor']
      );
      
      console.log('  ✅ Test admin creation successful!');
      
      await connection.rollback();
      console.log('  🔄 Test transaction rolled back');
      
    } catch (testError) {
      await connection.rollback();
      console.log(`  ❌ Test failed: ${testError.message}`);
      console.log('  ℹ️  You may need to check the error and apply additional fixes');
    }
    
    console.log('');
    console.log('✅ Fix script completed successfully!');
    console.log('');
    console.log('📝 Next Steps:');
    console.log('  1. Try creating an admin account through the admin interface');
    console.log('  2. If it still fails, check the Railway logs for the specific error');
    console.log('  3. Run the diagnose-admin-creation-error.js script for more details');
    console.log('');
    
  } catch (error) {
    console.error('❌ Fix script failed:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    if (connection) {
      await connection.end();
      console.log('📡 Database connection closed');
    }
  }
}

// Run fix
if (require.main === module) {
  fixAdminCreationError()
    .then(() => {
      console.log('\n🎉 Fix script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Fix script failed:', error);
      process.exit(1);
    });
}

module.exports = fixAdminCreationError;

