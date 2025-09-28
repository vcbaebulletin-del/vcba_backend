const mysql = require('mysql2/promise');
require('dotenv').config();

async function simpleTest() {
  let connection;
  
  try {
    console.log('🧪 Simple SMS Test Setup...\n');

    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });

    console.log('✅ Connected to database');

    // Check students
    const [students] = await connection.execute(`
      SELECT sa.student_id, sp.first_name, sp.last_name, sp.grade_level, sp.phone_number
      FROM student_accounts sa
      LEFT JOIN student_profiles sp ON sa.student_id = sp.student_id
      WHERE sa.is_active = 1 AND sp.phone_number IS NOT NULL AND sp.phone_number != ''
      LIMIT 3
    `);

    console.log(`✅ Found ${students.length} students with phone numbers`);

    // Check categories
    const [categories] = await connection.execute(`
      SELECT category_id, name FROM categories WHERE is_active = 1 LIMIT 3
    `);

    console.log(`✅ Found ${categories.length} active categories`);

    if (categories.length > 0) {
      // Get a valid admin ID
      const [admins] = await connection.execute(`
        SELECT admin_id FROM admin_accounts WHERE is_active = 1 LIMIT 1
      `);

      if (admins.length === 0) {
        console.log('❌ No active admin accounts found');
        return;
      }

      const adminId = admins[0].admin_id;
      console.log(`✅ Using admin ID: ${adminId}`);

      // Create test announcement
      const [result] = await connection.execute(`
        INSERT INTO announcements (
          title, content, category_id, status, is_alert, grade_level,
          posted_by, created_at, updated_at
        ) VALUES (
          'SMS Test Announcement',
          'This is a test announcement for SMS functionality.',
          ?, 'pending', 1, 7,
          ?, NOW(), NOW()
        )
      `, [categories[0].category_id, adminId]);

      const announcementId = result.insertId;
      console.log(`✅ Created test announcement with ID: ${announcementId}`);
      console.log(`   - Title: SMS Test Announcement`);
      console.log(`   - Status: pending`);
      console.log(`   - Is Alert: YES`);
      console.log(`   - Grade Level: 7`);

      console.log('\n📋 To test SMS functionality:');
      console.log('1. Start the backend server');
      console.log('2. Login as super_admin');
      console.log(`3. Approve announcement: PUT /api/announcements/${announcementId}/approve`);
      console.log('4. Check SMS notifications table and server logs');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

simpleTest();
