/**
 * Script to set default value for section column in student_profiles table
 * This fixes the error: "Field 'section' doesn't have a default value"
 * 
 * Run this script to apply the fix to your Railway database:
 * node fix-section-default.js
 */

require('dotenv').config();
const mysql = require('mysql2/promise');

async function fixSectionDefault() {
  let connection;
  
  try {
    console.log('🔄 Connecting to database...');
    
    // Create connection to Railway database
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
    console.log(`🖥️  Host: ${process.env.DB_HOST}`);
    
    // Check current table structure
    console.log('\n📋 Checking current table structure...');
    const [columns] = await connection.execute(
      `SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT 
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'student_profiles' AND COLUMN_NAME = 'section'`,
      [process.env.DB_NAME]
    );
    
    if (columns.length === 0) {
      console.log('⚠️  Warning: section column does not exist in student_profiles table');
      console.log('   This might be expected if the column was removed.');
      return;
    }
    
    console.log('Current section column configuration:');
    console.log(columns[0]);
    
    // Apply the fix
    console.log('\n🔧 Applying fix: Setting default value to 1 for section column...');
    await connection.execute(
      `ALTER TABLE student_profiles 
       MODIFY COLUMN section INT DEFAULT 1`
    );
    
    console.log('✅ Successfully set default value for section column');
    
    // Verify the change
    console.log('\n✔️  Verifying the change...');
    const [updatedColumns] = await connection.execute(
      `SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT 
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'student_profiles' AND COLUMN_NAME = 'section'`,
      [process.env.DB_NAME]
    );
    
    console.log('Updated section column configuration:');
    console.log(updatedColumns[0]);
    
    console.log('\n✅ Fix applied successfully!');
    console.log('   You can now create student accounts without providing the section field.');
    console.log('   The section will automatically default to 1.');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 Database connection closed');
    }
  }
}

// Run the fix
fixSectionDefault();

