#!/usr/bin/env node

const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');
const config = require('../src/config/config');

async function runPositionMigration() {
  let connection;
  
  try {
    console.log('🔗 Connecting to database...');
    connection = await mysql.createConnection(config.database);
    console.log('✅ Connected to database');
    
    // Check current admin positions before migration
    console.log('\n📋 Current admin positions BEFORE migration:');
    const [beforeAdmins] = await connection.execute(`
      SELECT a.email, p.first_name, p.last_name, p.position, p.grade_level
      FROM admin_accounts a
      JOIN admin_profiles p ON a.admin_id = p.admin_id
      ORDER BY a.admin_id
    `);
    
    beforeAdmins.forEach(admin => {
      console.log(`   - ${admin.email}: ${admin.first_name} ${admin.last_name} (${admin.position || 'NULL'})`);
    });
    
    // Step 1: Update existing admin positions FIRST (before adding constraint)
    console.log('\n🔧 Step 1: Updating admin positions...');

    // Set the first admin as super_admin
    const [superAdminResult] = await connection.execute(`
      UPDATE admin_profiles
      SET position = 'super_admin'
      WHERE admin_id = (
          SELECT admin_id
          FROM admin_accounts
          ORDER BY admin_id ASC
          LIMIT 1
      )
    `);
    console.log(`✅ Set ${superAdminResult.affectedRows} admin as super_admin`);

    // Set remaining admins as professor
    const [professorResult] = await connection.execute(`
      UPDATE admin_profiles
      SET position = 'professor'
      WHERE position IS NULL OR position NOT IN ('super_admin', 'professor')
    `);
    console.log(`✅ Set ${professorResult.affectedRows} admins as professor`);

    // Step 1b: Add constraint to position column (after data is updated)
    console.log('\n🔧 Step 1b: Adding position constraint...');
    try {
      await connection.execute(`
        ALTER TABLE admin_profiles
        ADD CONSTRAINT chk_admin_position
        CHECK (position IS NULL OR position IN ('super_admin', 'professor'))
      `);
      console.log('✅ Position constraint added successfully');
    } catch (error) {
      if (error.code === 'ER_CHECK_CONSTRAINT_DUP_NAME') {
        console.log('⚠️  Position constraint already exists, skipping...');
      } else {
        throw error;
      }
    }
    
    // Step 2: Add index for position-based queries
    console.log('\n🔧 Step 2: Adding position index...');
    try {
      await connection.execute(`
        CREATE INDEX idx_admin_profiles_position ON admin_profiles(position)
      `);
      console.log('✅ Position index added successfully');
    } catch (error) {
      if (error.code === 'ER_DUP_KEYNAME') {
        console.log('⚠️  Position index already exists, skipping...');
      } else {
        throw error;
      }
    }
    
    // Step 3: Position updates already done in Step 1
    console.log('\n🔧 Step 3: Position updates already completed in Step 1');
    
    // Step 4: Add audit log entry
    console.log('\n🔧 Step 4: Adding audit log entry...');
    try {
      await connection.execute(`
        INSERT INTO audit_logs (
            user_type, 
            user_id, 
            action_type, 
            target_table, 
            description, 
            performed_at
        ) VALUES (
            'system', 
            NULL, 
            'ALTER', 
            'admin_profiles', 
            'Migration: Added position-based permissions system with super_admin and professor roles', 
            NOW()
        )
      `);
      console.log('✅ Audit log entry added');
    } catch (error) {
      if (error.code === 'ER_NO_SUCH_TABLE') {
        console.log('⚠️  audit_logs table not found, skipping audit entry...');
      } else {
        console.log('⚠️  Could not add audit log entry:', error.message);
      }
    }
    
    // Step 5: Update table comment
    console.log('\n🔧 Step 5: Updating table comment...');
    await connection.execute(`
      ALTER TABLE admin_profiles 
      COMMENT = 'Admin profile information with position-based access control (super_admin, professor)'
    `);
    console.log('✅ Table comment updated');
    
    // Step 6: Verify migration results
    console.log('\n📋 Admin positions AFTER migration:');
    const [afterAdmins] = await connection.execute(`
      SELECT a.email, p.first_name, p.last_name, p.position, p.grade_level
      FROM admin_accounts a
      JOIN admin_profiles p ON a.admin_id = p.admin_id
      ORDER BY a.admin_id
    `);
    
    afterAdmins.forEach(admin => {
      console.log(`   - ${admin.email}: ${admin.first_name} ${admin.last_name} (${admin.position})`);
    });
    
    // Final verification
    const [verification] = await connection.execute(`
      SELECT 
          COUNT(*) as total_admins,
          SUM(CASE WHEN position = 'super_admin' THEN 1 ELSE 0 END) as super_admins,
          SUM(CASE WHEN position = 'professor' THEN 1 ELSE 0 END) as professors,
          SUM(CASE WHEN position IS NULL THEN 1 ELSE 0 END) as null_positions
      FROM admin_profiles
    `);
    
    const stats = verification[0];
    console.log('\n📊 Migration Summary:');
    console.log(`   - Total admins: ${stats.total_admins}`);
    console.log(`   - Super admins: ${stats.super_admins}`);
    console.log(`   - Professors: ${stats.professors}`);
    console.log(`   - Null positions: ${stats.null_positions}`);
    
    console.log('\n🎉 Position-based permissions migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

runPositionMigration();
