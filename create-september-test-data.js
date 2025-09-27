const mysql = require('mysql2/promise');

async function createSeptemberTestData() {
  let connection;
  
  try {
    // Create database connection
    connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'db_ebulletin_system'
    });

    console.log('🔧 Creating September 2024 Test Data for Reports\n');

    // Get admin ID for test data
    const [adminResult] = await connection.execute(
      'SELECT admin_id FROM admin_accounts LIMIT 1'
    );
    const adminId = adminResult[0]?.admin_id || 1;

    // Get category ID for test data
    const [categoryResult] = await connection.execute(
      'SELECT category_id FROM categories WHERE is_active = 1 LIMIT 1'
    );
    const categoryId = categoryResult[0]?.category_id || 1;

    console.log(`Using admin_id: ${adminId}, category_id: ${categoryId}`);

    // Create test announcements for September 2024
    console.log('📢 Creating test announcements for September 2024...');

    // Regular announcement
    const [regularAnnResult] = await connection.execute(`
      INSERT INTO announcements (
        title, content, category_id, posted_by, status, is_alert,
        created_at, updated_at, published_at
      ) VALUES (?, ?, ?, ?, 'published', 0, ?, ?, ?)
    `, [
      'September Regular Announcement',
      'This is a regular announcement created for September 2024 testing.',
      categoryId,
      adminId,
      '2024-09-15 10:00:00',
      '2024-09-15 10:00:00',
      '2024-09-15 10:00:00'
    ]);

    console.log(`✅ Created regular announcement with ID: ${regularAnnResult.insertId}`);

    // Alert announcement
    const [alertAnnResult] = await connection.execute(`
      INSERT INTO announcements (
        title, content, category_id, posted_by, status, is_alert,
        created_at, updated_at, published_at
      ) VALUES (?, ?, ?, ?, 'published', 1, ?, ?, ?)
    `, [
      'September Alert Announcement',
      'This is an ALERT announcement created for September 2024 testing.',
      categoryId,
      adminId,
      '2024-09-20 14:30:00',
      '2024-09-20 14:30:00',
      '2024-09-20 14:30:00'
    ]);

    console.log(`✅ Created alert announcement with ID: ${alertAnnResult.insertId}`);

    // Create test calendar events for September 2024
    console.log('📅 Creating test calendar events for September 2024...');

    // Regular calendar event
    const [regularEventResult] = await connection.execute(`
      INSERT INTO school_calendar (
        title, description, event_date, category_id, created_by, 
        is_active, is_published, is_alert, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 1, 1, 0, ?, ?)
    `, [
      'September Regular Event',
      'This is a regular calendar event created for September 2024 testing.',
      '2024-09-25',
      categoryId,
      adminId,
      '2024-09-10 09:00:00',
      '2024-09-10 09:00:00'
    ]);

    console.log(`✅ Created regular calendar event with ID: ${regularEventResult.insertId}`);

    // Alert calendar event
    const [alertEventResult] = await connection.execute(`
      INSERT INTO school_calendar (
        title, description, event_date, category_id, created_by, 
        is_active, is_published, is_alert, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 1, 1, 1, ?, ?)
    `, [
      'September Alert Event',
      'This is an ALERT calendar event created for September 2024 testing.',
      '2024-09-30',
      categoryId,
      adminId,
      '2024-09-12 16:45:00',
      '2024-09-12 16:45:00'
    ]);

    console.log(`✅ Created alert calendar event with ID: ${alertEventResult.insertId}`);

    // Verify the data was created
    console.log('\n🔍 Verifying created data...');

    const [announcements] = await connection.execute(`
      SELECT announcement_id, title, is_alert, created_at 
      FROM announcements 
      WHERE YEAR(created_at) = 2024 AND MONTH(created_at) = 9
      ORDER BY created_at DESC
    `);

    console.log(`Found ${announcements.length} announcements for September 2024:`);
    announcements.forEach(ann => {
      console.log(`  - ${ann.title} (Alert: ${ann.is_alert ? 'YES' : 'NO'})`);
    });

    const [events] = await connection.execute(`
      SELECT calendar_id, title, is_alert, created_at 
      FROM school_calendar 
      WHERE YEAR(created_at) = 2024 AND MONTH(created_at) = 9
      ORDER BY created_at DESC
    `);

    console.log(`Found ${events.length} calendar events for September 2024:`);
    events.forEach(event => {
      console.log(`  - ${event.title} (Alert: ${event.is_alert ? 'YES' : 'NO'})`);
    });

    console.log('\n✅ September 2024 test data created successfully!');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run the script
createSeptemberTestData();
