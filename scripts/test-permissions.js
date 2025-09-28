#!/usr/bin/env node

const mysql = require('mysql2/promise');
const config = require('../src/config/config');
const { PermissionChecker, PERMISSIONS, POSITIONS } = require('../src/utils/permissions');

async function testPermissions() {
  let connection;
  
  try {
    console.log('🔗 Connecting to database...');
    connection = await mysql.createConnection(config.database);
    console.log('✅ Connected to database');
    
    // Test permission system
    console.log('\n🧪 Testing Permission System...');
    
    // Test super_admin permissions
    console.log('\n📋 Super Admin Permissions:');
    const superAdminPermissions = PermissionChecker.getPositionPermissions(POSITIONS.SUPER_ADMIN);
    console.log(`   - Total permissions: ${superAdminPermissions.length}`);
    console.log(`   - Can manage categories: ${PermissionChecker.canManageCategories(POSITIONS.SUPER_ADMIN)}`);
    console.log(`   - Can manage admins: ${PermissionChecker.canManageAdmins(POSITIONS.SUPER_ADMIN)}`);
    console.log(`   - Can manage students: ${PermissionChecker.canManageStudents(POSITIONS.SUPER_ADMIN)}`);
    console.log(`   - Can manage SMS settings: ${PermissionChecker.canManageSMSSettings(POSITIONS.SUPER_ADMIN)}`);
    
    // Test professor permissions
    console.log('\n📋 Professor Permissions:');
    const professorPermissions = PermissionChecker.getPositionPermissions(POSITIONS.PROFESSOR);
    console.log(`   - Total permissions: ${professorPermissions.length}`);
    console.log(`   - Can manage categories: ${PermissionChecker.canManageCategories(POSITIONS.PROFESSOR)}`);
    console.log(`   - Can manage admins: ${PermissionChecker.canManageAdmins(POSITIONS.PROFESSOR)}`);
    console.log(`   - Can view students: ${PermissionChecker.canViewStudents(POSITIONS.PROFESSOR)}`);
    console.log(`   - Can manage students: ${PermissionChecker.canManageStudents(POSITIONS.PROFESSOR)}`);
    console.log(`   - Can manage SMS settings: ${PermissionChecker.canManageSMSSettings(POSITIONS.PROFESSOR)}`);
    
    // Test with actual admin data
    console.log('\n📋 Testing with actual admin data:');
    const [admins] = await connection.execute(`
      SELECT a.admin_id, a.email, p.first_name, p.last_name, p.position
      FROM admin_accounts a
      JOIN admin_profiles p ON a.admin_id = p.admin_id
      WHERE a.is_active = 1
      ORDER BY a.admin_id
    `);
    
    admins.forEach(admin => {
      console.log(`\n   👤 ${admin.email} (${admin.position}):`);
      console.log(`      - Can manage categories: ${PermissionChecker.userHasPermission(admin, PERMISSIONS.MANAGE_CATEGORIES)}`);
      console.log(`      - Can create announcements: ${PermissionChecker.userHasPermission(admin, PERMISSIONS.CREATE_ANNOUNCEMENTS)}`);
      console.log(`      - Can manage students: ${PermissionChecker.userHasPermission(admin, PERMISSIONS.MANAGE_STUDENTS)}`);
      console.log(`      - Can view students: ${PermissionChecker.userHasPermission(admin, PERMISSIONS.VIEW_STUDENTS)}`);
    });
    
    // Test position validation
    console.log('\n🔍 Testing position validation:');
    console.log(`   - 'super_admin' is valid: ${PermissionChecker.isValidPosition('super_admin')}`);
    console.log(`   - 'professor' is valid: ${PermissionChecker.isValidPosition('professor')}`);
    console.log(`   - 'invalid_position' is valid: ${PermissionChecker.isValidPosition('invalid_position')}`);
    
    console.log('\n🎉 Permission system test completed successfully!');
    
  } catch (error) {
    console.error('❌ Permission test failed:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

testPermissions();
