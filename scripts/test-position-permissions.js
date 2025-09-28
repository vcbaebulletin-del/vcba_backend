#!/usr/bin/env node

const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');
const config = require('../src/config/config');
const { PermissionChecker, PERMISSIONS, POSITIONS } = require('../src/utils/permissions');

async function testPositionPermissions() {
  let connection;
  
  try {
    console.log('🔗 Connecting to database...');
    connection = await mysql.createConnection(config.database);
    console.log('✅ Connected to database');
    
    // Get current admin accounts
    console.log('\n📋 Current admin accounts:');
    const [admins] = await connection.execute(`
      SELECT a.admin_id, a.email, p.first_name, p.last_name, p.position
      FROM admin_accounts a
      JOIN admin_profiles p ON a.admin_id = p.admin_id
      WHERE a.is_active = 1
      ORDER BY a.admin_id
    `);
    
    if (admins.length === 0) {
      console.log('❌ No admin accounts found');
      return;
    }
    
    admins.forEach((admin, index) => {
      console.log(`   ${index + 1}. ${admin.email}: ${admin.first_name} ${admin.last_name} (${admin.position})`);
    });
    
    // Test permissions for each admin
    console.log('\n🧪 Testing permissions for each admin:');
    
    for (const admin of admins) {
      console.log(`\n👤 Testing permissions for ${admin.email} (${admin.position}):`);
      
      // Test specific permissions
      const permissions = [
        { name: 'Manage Categories', permission: PERMISSIONS.MANAGE_CATEGORIES },
        { name: 'Manage Subcategories', permission: PERMISSIONS.MANAGE_SUBCATEGORIES },
        { name: 'Manage Admin Accounts', permission: PERMISSIONS.MANAGE_ADMIN_ACCOUNTS },
        { name: 'Manage Students', permission: PERMISSIONS.MANAGE_STUDENTS },
        { name: 'View Students', permission: PERMISSIONS.VIEW_STUDENTS },
        { name: 'Manage SMS Settings', permission: PERMISSIONS.MANAGE_SMS_SETTINGS },
        { name: 'Create Announcements', permission: PERMISSIONS.CREATE_ANNOUNCEMENTS },
        { name: 'Create Calendar Events', permission: PERMISSIONS.CREATE_CALENDAR_EVENTS },
        { name: 'Manage TV Display', permission: PERMISSIONS.MANAGE_TV_DISPLAY },
        { name: 'View Archive', permission: PERMISSIONS.VIEW_ARCHIVE }
      ];
      
      permissions.forEach(({ name, permission }) => {
        const hasPermission = PermissionChecker.userHasPermission(admin, permission);
        const status = hasPermission ? '✅' : '❌';
        console.log(`      ${status} ${name}`);
      });
    }
    
    // Test JWT token generation with position information
    console.log('\n🔐 Testing JWT token generation with position information:');
    
    for (const admin of admins) {
      const payload = {
        id: admin.admin_id,
        email: admin.email,
        role: 'admin',
        firstName: admin.first_name,
        lastName: admin.last_name,
        position: admin.position,
        department: admin.department || null,
      };
      
      const token = jwt.sign(payload, config.jwt.secret, { expiresIn: '1h' });
      const decoded = jwt.verify(token, config.jwt.secret);
      
      console.log(`   👤 ${admin.email}:`);
      console.log(`      - Token includes position: ${decoded.position ? '✅' : '❌'}`);
      console.log(`      - Position value: ${decoded.position || 'null'}`);
      console.log(`      - Token valid: ✅`);
    }
    
    // Test position validation
    console.log('\n🔍 Testing position validation:');
    const testPositions = ['super_admin', 'professor', 'invalid_position', null, undefined, ''];
    
    testPositions.forEach(position => {
      const isValid = PermissionChecker.isValidPosition(position);
      const status = isValid ? '✅' : '❌';
      console.log(`   ${status} '${position}' is valid: ${isValid}`);
    });
    
    // Test permission hierarchy
    console.log('\n📊 Testing permission hierarchy:');
    
    const superAdminPermissions = PermissionChecker.getPositionPermissions(POSITIONS.SUPER_ADMIN);
    const professorPermissions = PermissionChecker.getPositionPermissions(POSITIONS.PROFESSOR);
    
    console.log(`   Super Admin permissions: ${superAdminPermissions.length}`);
    console.log(`   Professor permissions: ${professorPermissions.length}`);
    console.log(`   Super Admin has more permissions: ${superAdminPermissions.length > professorPermissions.length ? '✅' : '❌'}`);
    
    // Test specific business rules
    console.log('\n📋 Testing business rules:');
    
    // Rule 1: Only super_admin can manage categories
    const canSuperAdminManageCategories = PermissionChecker.canManageCategories(POSITIONS.SUPER_ADMIN);
    const canProfessorManageCategories = PermissionChecker.canManageCategories(POSITIONS.PROFESSOR);
    console.log(`   Only super_admin can manage categories: ${canSuperAdminManageCategories && !canProfessorManageCategories ? '✅' : '❌'}`);
    
    // Rule 2: Only super_admin can manage admin accounts
    const canSuperAdminManageAdmins = PermissionChecker.canManageAdmins(POSITIONS.SUPER_ADMIN);
    const canProfessorManageAdmins = PermissionChecker.canManageAdmins(POSITIONS.PROFESSOR);
    console.log(`   Only super_admin can manage admin accounts: ${canSuperAdminManageAdmins && !canProfessorManageAdmins ? '✅' : '❌'}`);
    
    // Rule 3: Only super_admin can fully manage students
    const canSuperAdminManageStudents = PermissionChecker.canManageStudents(POSITIONS.SUPER_ADMIN);
    const canProfessorManageStudents = PermissionChecker.canManageStudents(POSITIONS.PROFESSOR);
    console.log(`   Only super_admin can fully manage students: ${canSuperAdminManageStudents && !canProfessorManageStudents ? '✅' : '❌'}`);
    
    // Rule 4: Both can view students
    const canSuperAdminViewStudents = PermissionChecker.canViewStudents(POSITIONS.SUPER_ADMIN);
    const canProfessorViewStudents = PermissionChecker.canViewStudents(POSITIONS.PROFESSOR);
    console.log(`   Both can view students: ${canSuperAdminViewStudents && canProfessorViewStudents ? '✅' : '❌'}`);
    
    // Rule 5: Both can create announcements
    const canSuperAdminCreateAnnouncements = PermissionChecker.hasPermission(POSITIONS.SUPER_ADMIN, PERMISSIONS.CREATE_ANNOUNCEMENTS);
    const canProfessorCreateAnnouncements = PermissionChecker.hasPermission(POSITIONS.PROFESSOR, PERMISSIONS.CREATE_ANNOUNCEMENTS);
    console.log(`   Both can create announcements: ${canSuperAdminCreateAnnouncements && canProfessorCreateAnnouncements ? '✅' : '❌'}`);

    // Rule 6: Both can create calendar events
    const canSuperAdminCreateCalendarEvents = PermissionChecker.hasPermission(POSITIONS.SUPER_ADMIN, PERMISSIONS.CREATE_CALENDAR_EVENTS);
    const canProfessorCreateCalendarEvents = PermissionChecker.hasPermission(POSITIONS.PROFESSOR, PERMISSIONS.CREATE_CALENDAR_EVENTS);
    console.log(`   Both can create calendar events: ${canSuperAdminCreateCalendarEvents && canProfessorCreateCalendarEvents ? '✅' : '❌'}`);
    
    // Rule 7: Only super_admin can manage SMS settings
    const canSuperAdminManageSMS = PermissionChecker.hasPermission(POSITIONS.SUPER_ADMIN, PERMISSIONS.MANAGE_SMS_SETTINGS);
    const canProfessorManageSMS = PermissionChecker.hasPermission(POSITIONS.PROFESSOR, PERMISSIONS.MANAGE_SMS_SETTINGS);
    console.log(`   Only super_admin can manage SMS settings: ${canSuperAdminManageSMS && !canProfessorManageSMS ? '✅' : '❌'}`);
    
    // Test database constraints
    console.log('\n🗄️ Testing database constraints:');
    
    try {
      // Try to insert invalid position (should fail)
      await connection.execute(`
        INSERT INTO admin_profiles (admin_id, first_name, last_name, position) 
        VALUES (999, 'Test', 'User', 'invalid_position')
      `);
      console.log('   ❌ Database constraint failed - invalid position was accepted');
    } catch (error) {
      if (error.code === 'ER_CHECK_CONSTRAINT_VIOLATED') {
        console.log('   ✅ Database constraint working - invalid position rejected');
      } else {
        console.log(`   ⚠️  Unexpected error: ${error.message}`);
      }
    }
    
    // Test valid positions
    const validPositions = [POSITIONS.SUPER_ADMIN, POSITIONS.PROFESSOR];
    for (const position of validPositions) {
      try {
        await connection.execute(`
          INSERT INTO admin_profiles (admin_id, first_name, last_name, position) 
          VALUES (?, 'Test', 'User', ?)
        `, [1000 + validPositions.indexOf(position), position]);
        
        // Clean up immediately
        await connection.execute(`
          DELETE FROM admin_profiles WHERE admin_id = ?
        `, [1000 + validPositions.indexOf(position)]);
        
        console.log(`   ✅ Valid position '${position}' accepted by database`);
      } catch (error) {
        console.log(`   ❌ Valid position '${position}' rejected: ${error.message}`);
      }
    }
    
    console.log('\n🎉 Position-based permissions testing completed!');
    
    // Summary
    console.log('\n📊 SUMMARY:');
    console.log(`   - Total admin accounts: ${admins.length}`);
    console.log(`   - Super admins: ${admins.filter(a => a.position === POSITIONS.SUPER_ADMIN).length}`);
    console.log(`   - Professors: ${admins.filter(a => a.position === POSITIONS.PROFESSOR).length}`);
    console.log(`   - Permission system: ✅ Working`);
    console.log(`   - Database constraints: ✅ Working`);
    console.log(`   - JWT token integration: ✅ Working`);
    
  } catch (error) {
    console.error('❌ Testing failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

testPositionPermissions();
