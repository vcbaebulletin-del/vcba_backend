const mysql = require('mysql2/promise');
require('dotenv').config();

async function testAnnouncementSMS() {
  let connection;
  
  try {
    console.log('🧪 Testing Announcement SMS Functionality...\n');

    // Connect to database
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });

    console.log('✅ Connected to database');

    // Test 1: Check if we have active students with phone numbers
    console.log('\n1. Checking active students with phone numbers...');
    const [students] = await connection.execute(`
      SELECT sa.student_id, sp.first_name, sp.last_name, sp.grade_level, sp.phone_number, sa.is_active
      FROM student_accounts sa
      LEFT JOIN student_profiles sp ON sa.student_id = sp.student_id
      WHERE sa.is_active = 1 AND sp.phone_number IS NOT NULL AND sp.phone_number != ''
      LIMIT 5
    `);

    console.log(`✅ Found ${students.length} active students with phone numbers:`);
    students.forEach(student => {
      console.log(`  - ${student.first_name} ${student.last_name} (Grade ${student.grade_level}): ${student.phone_number}`);
    });

    if (students.length === 0) {
      console.log('⚠️  No active students with phone numbers found. Creating test student...');
      
      // Create a test student
      await connection.execute(`
        INSERT INTO student_accounts (student_id, username, password, is_active, created_at, updated_at)
        VALUES ('TEST001', 'test001', 'password', 1, NOW(), NOW())
        ON DUPLICATE KEY UPDATE is_active = 1, updated_at = NOW()
      `);

      await connection.execute(`
        INSERT INTO student_profiles (
          student_id, first_name, last_name, grade_level, phone_number,
          created_at, updated_at
        ) VALUES (
          'TEST001', 'Test', 'Student', 'Grade 7', '+639123456789',
          NOW(), NOW()
        )
        ON DUPLICATE KEY UPDATE
        phone_number = '+639123456789',
        updated_at = NOW()
      `);
      
      console.log('✅ Test student created/updated');
    }

    // Test 2: Check if we have announcement categories
    console.log('\n2. Checking announcement categories...');
    const [categories] = await connection.execute(`
      SELECT category_id, name as category_name, is_active
      FROM categories
      WHERE is_active = 1
      LIMIT 3
    `);

    console.log(`✅ Found ${categories.length} active announcement categories:`);
    categories.forEach(cat => {
      console.log(`  - ${cat.category_name} (ID: ${cat.category_id})`);
    });

    if (categories.length === 0) {
      console.log('⚠️  No active categories found. Creating test category...');
      
      await connection.execute(`
        INSERT INTO categories (name, is_active, created_at, updated_at)
        VALUES ('Test Category', 1, NOW(), NOW())
      `);
      
      console.log('✅ Test category created');
    }

    // Test 3: Create a test announcement with alert flag
    console.log('\n3. Creating test announcement with alert flag...');
    
    const [categoryResult] = await connection.execute(`
      SELECT category_id FROM categories WHERE is_active = 1 LIMIT 1
    `);
    
    if (categoryResult.length === 0) {
      throw new Error('No active categories available');
    }

    const categoryId = categoryResult[0].category_id;
    
    const [insertResult] = await connection.execute(`
      INSERT INTO announcements (
        title, content, category_id, status, is_alert, grade_level,
        created_by, created_at, updated_at
      ) VALUES (
        'Test Alert Announcement', 
        'This is a test announcement with alert flag for SMS testing.',
        ?, 'pending', 1, 'Grade 7',
        1, NOW(), NOW()
      )
    `, [categoryId]);

    const announcementId = insertResult.insertId;
    console.log(`✅ Test announcement created with ID: ${announcementId}`);

    // Test 4: Check SMS notification table before approval
    console.log('\n4. Checking SMS notifications before approval...');
    const [smsBefore] = await connection.execute(`
      SELECT COUNT(*) as count FROM sms_notifications
    `);
    console.log(`✅ SMS notifications before approval: ${smsBefore[0].count}`);

    // Test 5: Simulate announcement approval (this would trigger SMS)
    console.log('\n5. Simulating announcement approval...');
    console.log('⚠️  Note: This test only checks the database setup.');
    console.log('   To test actual SMS sending, use the API endpoint:');
    console.log(`   PUT /api/announcements/${announcementId}/approve`);
    console.log('   with super_admin authentication');

    // Test 6: Verify the announcement is ready for approval
    const [announcement] = await connection.execute(`
      SELECT announcement_id, title, status, is_alert, grade_level
      FROM announcements 
      WHERE announcement_id = ?
    `, [announcementId]);

    if (announcement.length > 0) {
      const ann = announcement[0];
      console.log(`✅ Announcement ready for approval:`);
      console.log(`   - ID: ${ann.announcement_id}`);
      console.log(`   - Title: ${ann.title}`);
      console.log(`   - Status: ${ann.status}`);
      console.log(`   - Is Alert: ${ann.is_alert ? 'YES' : 'NO'}`);
      console.log(`   - Grade Level: ${ann.grade_level}`);
    }

    console.log('\n🏁 Announcement SMS test setup completed!');
    console.log('\n📋 Next steps to test SMS functionality:');
    console.log('1. Start the backend server: npm start');
    console.log('2. Login as super_admin via the API');
    console.log(`3. Approve the announcement: PUT /api/announcements/${announcementId}/approve`);
    console.log('4. Check SMS notifications table for new entries');
    console.log('5. Check server logs for SMS sending activity');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run the test
testAnnouncementSMS().catch(console.error);
