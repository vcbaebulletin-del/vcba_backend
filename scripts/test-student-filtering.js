#!/usr/bin/env node

const mysql = require('mysql2/promise');
const config = require('../src/config/config');

async function testStudentFiltering() {
  let connection;
  
  try {
    console.log('🔗 Connecting to database...');
    connection = await mysql.createConnection(config.database);
    console.log('✅ Connected to database');
    
    // Get current admin accounts
    console.log('\n📋 Current admin accounts:');
    const [admins] = await connection.execute(`
      SELECT a.admin_id, a.email, p.first_name, p.last_name, p.position, p.grade_level
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
      console.log(`   ${index + 1}. ${admin.email}: ${admin.first_name} ${admin.last_name} (${admin.position}) - Grade: ${admin.grade_level || 'All'}`);
    });
    
    // Get student distribution by grade
    console.log('\n📊 Student distribution by grade:');
    const [gradeStats] = await connection.execute(`
      SELECT 
        sp.grade_level,
        COUNT(*) as student_count,
        COUNT(CASE WHEN sa.is_active = 1 THEN 1 END) as active_count,
        COUNT(CASE WHEN sa.is_active = 0 THEN 1 END) as inactive_count
      FROM student_accounts sa
      JOIN student_profiles sp ON sa.student_id = sp.student_id
      GROUP BY sp.grade_level
      ORDER BY sp.grade_level
    `);
    
    gradeStats.forEach(stat => {
      console.log(`   Grade ${stat.grade_level}: ${stat.student_count} total (${stat.active_count} active, ${stat.inactive_count} inactive)`);
    });
    
    // Test filtering logic for each admin
    console.log('\n🧪 Testing student filtering logic:');
    
    for (const admin of admins) {
      console.log(`\n👤 Testing for ${admin.email} (${admin.position}):`);
      
      let query = `
        SELECT COUNT(*) as total_visible
        FROM student_accounts sa
        JOIN student_profiles sp ON sa.student_id = sp.student_id
        WHERE sa.is_active = 1
      `;
      
      let params = [];
      
      // Apply filtering logic based on position
      if (admin.position === 'super_admin') {
        // Super admin sees ALL students
        console.log('   📋 Filter: ALL students (super_admin privilege)');
      } else if (admin.position === 'professor' && admin.grade_level) {
        // Professor sees only their assigned grade
        query += ' AND sp.grade_level = ?';
        params.push(admin.grade_level);
        console.log(`   📋 Filter: Grade ${admin.grade_level} only (professor restriction)`);
      } else {
        // Fallback: see all students
        console.log('   📋 Filter: ALL students (no grade restriction)');
      }
      
      const [result] = await connection.execute(query, params);
      console.log(`   ✅ Visible students: ${result[0].total_visible}`);
      
      // Show breakdown by grade for this admin's view
      let detailQuery = `
        SELECT 
          sp.grade_level,
          COUNT(*) as visible_count
        FROM student_accounts sa
        JOIN student_profiles sp ON sa.student_id = sp.student_id
        WHERE sa.is_active = 1
      `;
      
      if (admin.position === 'professor' && admin.grade_level) {
        detailQuery += ' AND sp.grade_level = ?';
      }
      
      detailQuery += ' GROUP BY sp.grade_level ORDER BY sp.grade_level';
      
      const [breakdown] = await connection.execute(detailQuery, params);
      console.log('   📊 Grade breakdown:');
      breakdown.forEach(grade => {
        console.log(`      Grade ${grade.grade_level}: ${grade.visible_count} students`);
      });
    }
    
    // Test expected behavior
    console.log('\n✅ Expected behavior verification:');
    
    const superAdmin = admins.find(a => a.position === 'super_admin');
    const professor = admins.find(a => a.position === 'professor');
    
    if (superAdmin) {
      const [superAdminCount] = await connection.execute(`
        SELECT COUNT(*) as total
        FROM student_accounts sa
        WHERE sa.is_active = 1
      `);
      console.log(`   Super Admin (${superAdmin.email}) should see: ${superAdminCount[0].total} students (ALL)`);
    }
    
    if (professor && professor.grade_level) {
      const [professorCount] = await connection.execute(`
        SELECT COUNT(*) as total
        FROM student_accounts sa
        JOIN student_profiles sp ON sa.student_id = sp.student_id
        WHERE sa.is_active = 1 AND sp.grade_level = ?
      `, [professor.grade_level]);
      console.log(`   Professor (${professor.email}) should see: ${professorCount[0].total} students (Grade ${professor.grade_level} only)`);
    }
    
    console.log('\n🎉 Student filtering test completed!');
    
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

testStudentFiltering();
