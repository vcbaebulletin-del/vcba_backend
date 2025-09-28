#!/usr/bin/env node

const mysql = require('mysql2/promise');
const config = require('../src/config/config');

async function examineDatabase() {
  let connection;
  
  try {
    console.log('🔗 Connecting to database...');
    connection = await mysql.createConnection(config.database);
    console.log('✅ Connected to database');
    
    // Check if admin_profiles table exists and get its structure
    console.log('\n📋 Examining admin_profiles table structure...');
    const [adminProfilesColumns] = await connection.execute(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_COMMENT
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'admin_profiles'
      ORDER BY ORDINAL_POSITION
    `, [config.database.database]);
    
    if (adminProfilesColumns.length > 0) {
      console.log('✅ admin_profiles table structure:');
      adminProfilesColumns.forEach(col => {
        console.log(`   - ${col.COLUMN_NAME}: ${col.DATA_TYPE} (nullable: ${col.IS_NULLABLE}) ${col.COLUMN_COMMENT ? '- ' + col.COLUMN_COMMENT : ''}`);
      });
    } else {
      console.log('❌ admin_profiles table not found');
    }
    
    // Check current admin data
    console.log('\n📋 Current admin data:');
    const [admins] = await connection.execute(`
      SELECT a.admin_id, a.email, a.is_active, 
             p.first_name, p.last_name, p.department, p.position, p.grade_level
      FROM admin_accounts a
      LEFT JOIN admin_profiles p ON a.admin_id = p.admin_id
      LIMIT 5
    `);
    
    if (admins.length > 0) {
      console.log('✅ Current admin accounts:');
      admins.forEach(admin => {
        console.log(`   - ${admin.email}: ${admin.first_name} ${admin.last_name} (${admin.position}) - Grade Level: ${admin.grade_level}`);
      });
    } else {
      console.log('❌ No admin accounts found');
    }
    
    // Check other relevant tables
    console.log('\n📋 Checking other relevant tables...');
    const tables = ['categories', 'subcategories', 'admin_accounts'];
    
    for (const table of tables) {
      const [tableExists] = await connection.execute(`
        SELECT COUNT(*) as count
        FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
      `, [config.database.database, table]);
      
      if (tableExists[0].count > 0) {
        const [rowCount] = await connection.execute(`SELECT COUNT(*) as count FROM ${table}`);
        console.log(`   ✅ ${table}: ${rowCount[0].count} records`);
      } else {
        console.log(`   ❌ ${table}: table not found`);
      }
    }
    
  } catch (error) {
    console.error('❌ Database examination failed:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

examineDatabase();
