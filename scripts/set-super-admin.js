#!/usr/bin/env node

const mysql = require('mysql2/promise');
const config = require('../src/config/config');

async function setSuperAdmin() {
  let connection;
  
  try {
    console.log('🔗 Connecting to database...');
    connection = await mysql.createConnection(config.database);
    console.log('✅ Connected to database');
    
    // Show current admin positions
    console.log('\n📋 Current admin positions:');
    const [admins] = await connection.execute(`
      SELECT a.admin_id, a.email, p.first_name, p.last_name, p.position
      FROM admin_accounts a
      JOIN admin_profiles p ON a.admin_id = p.admin_id
      ORDER BY a.admin_id
    `);
    
    admins.forEach((admin, index) => {
      console.log(`   ${index + 1}. ${admin.email}: ${admin.first_name} ${admin.last_name} (${admin.position})`);
    });
    
    // Set the first admin as super_admin
    if (admins.length > 0) {
      const firstAdmin = admins[0];
      console.log(`\n🔧 Setting ${firstAdmin.email} as super_admin...`);
      
      const [result] = await connection.execute(`
        UPDATE admin_profiles 
        SET position = 'super_admin' 
        WHERE admin_id = ?
      `, [firstAdmin.admin_id]);
      
      console.log(`✅ Updated ${result.affectedRows} admin to super_admin`);
      
      // Verify the change
      console.log('\n📋 Updated admin positions:');
      const [updatedAdmins] = await connection.execute(`
        SELECT a.email, p.first_name, p.last_name, p.position
        FROM admin_accounts a
        JOIN admin_profiles p ON a.admin_id = p.admin_id
        ORDER BY a.admin_id
      `);
      
      updatedAdmins.forEach(admin => {
        console.log(`   - ${admin.email}: ${admin.first_name} ${admin.last_name} (${admin.position})`);
      });
      
      console.log('\n🎉 Super admin assignment completed!');
    } else {
      console.log('❌ No admin accounts found');
    }
    
  } catch (error) {
    console.error('❌ Failed to set super admin:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

setSuperAdmin();
