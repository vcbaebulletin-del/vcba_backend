const mysql = require('mysql2/promise');
const config = require('../src/config/config');
const timezoneUtils = require('../src/utils/timezone');

/**
 * Test script to create sample expired and archived content
 * to verify TV content filtering functionality
 */
class TVContentFilteringTest {
  constructor() {
    this.connection = null;
  }

  async connect() {
    try {
      this.connection = await mysql.createConnection({
        host: config.database.host,
        user: config.database.user,
        password: config.database.password,
        database: config.database.database,
        port: config.database.port,
        timezone: '+08:00' // Asia/Manila timezone
      });
      console.log('✅ Connected to database successfully');
    } catch (error) {
      console.error('❌ Database connection failed:', error.message);
      throw error;
    }
  }

  async disconnect() {
    if (this.connection) {
      await this.connection.end();
      console.log('🔌 Database connection closed');
    }
  }

  async createTestData() {
    console.log('\n🧪 Creating test data for TV content filtering...\n');

    try {
      // Get current Manila time
      const currentTime = timezoneUtils.now();
      const yesterday = timezoneUtils.now().subtract(1, 'day');
      const lastWeek = timezoneUtils.now().subtract(7, 'days');
      const tomorrow = timezoneUtils.now().add(1, 'day');

      // Get admin ID for test data
      const [adminResult] = await this.connection.query(
        'SELECT admin_id FROM admin_accounts LIMIT 1'
      );
      const adminId = adminResult[0]?.admin_id || 1;

      // Get category ID for test data
      const [categoryResult] = await this.connection.query(
        'SELECT category_id FROM categories LIMIT 1'
      );
      const categoryId = categoryResult[0]?.category_id || 1;

      console.log('📢 Creating test announcements...');

      // 1. Create expired announcement (visibility_end_at in the past)
      await this.connection.query(`
        INSERT INTO announcements (
          title, content, category_id, posted_by, status, 
          visibility_start_at, visibility_end_at, published_at
        ) VALUES (?, ?, ?, ?, 'published', ?, ?, ?)
      `, [
        'EXPIRED: Test Announcement - Should Not Appear on TV',
        'This announcement has expired and should not appear in TV content selection.',
        categoryId,
        adminId,
        lastWeek.format('YYYY-MM-DD HH:mm:ss'),
        yesterday.format('YYYY-MM-DD HH:mm:ss'),
        lastWeek.format('YYYY-MM-DD HH:mm:ss')
      ]);

      // 2. Create archived announcement
      await this.connection.query(`
        INSERT INTO announcements (
          title, content, category_id, posted_by, status, 
          visibility_start_at, visibility_end_at, published_at, archived_at
        ) VALUES (?, ?, ?, ?, 'archived', ?, ?, ?, ?)
      `, [
        'ARCHIVED: Test Announcement - Should Not Appear on TV',
        'This announcement is archived and should not appear in TV content selection.',
        categoryId,
        adminId,
        lastWeek.format('YYYY-MM-DD HH:mm:ss'),
        tomorrow.format('YYYY-MM-DD HH:mm:ss'),
        lastWeek.format('YYYY-MM-DD HH:mm:ss'),
        currentTime.format('YYYY-MM-DD HH:mm:ss')
      ]);

      // 3. Create soft-deleted announcement
      await this.connection.query(`
        INSERT INTO announcements (
          title, content, category_id, posted_by, status, 
          visibility_start_at, visibility_end_at, published_at, deleted_at
        ) VALUES (?, ?, ?, ?, 'published', ?, ?, ?, ?)
      `, [
        'SOFT DELETED: Test Announcement - Should Not Appear on TV',
        'This announcement is soft deleted and should not appear in TV content selection.',
        categoryId,
        adminId,
        lastWeek.format('YYYY-MM-DD HH:mm:ss'),
        tomorrow.format('YYYY-MM-DD HH:mm:ss'),
        lastWeek.format('YYYY-MM-DD HH:mm:ss'),
        currentTime.format('YYYY-MM-DD HH:mm:ss')
      ]);

      // 4. Create active announcement (should appear)
      await this.connection.query(`
        INSERT INTO announcements (
          title, content, category_id, posted_by, status, 
          visibility_start_at, visibility_end_at, published_at
        ) VALUES (?, ?, ?, ?, 'published', ?, ?, ?)
      `, [
        'ACTIVE: Test Announcement - Should Appear on TV',
        'This announcement is active and should appear in TV content selection.',
        categoryId,
        adminId,
        currentTime.format('YYYY-MM-DD HH:mm:ss'),
        tomorrow.format('YYYY-MM-DD HH:mm:ss'),
        currentTime.format('YYYY-MM-DD HH:mm:ss')
      ]);

      console.log('📅 Creating test calendar events...');

      // 5. Create expired calendar event (end_date in the past)
      await this.connection.query(`
        INSERT INTO school_calendar (
          title, description, event_date, end_date, created_by, is_published, is_active
        ) VALUES (?, ?, ?, ?, ?, 1, 1)
      `, [
        'EXPIRED: Test Event - Should Not Appear on TV',
        'This event has expired and should not appear in TV content selection.',
        lastWeek.format('YYYY-MM-DD'),
        yesterday.format('YYYY-MM-DD'),
        adminId
      ]);

      // 6. Create soft-deleted calendar event
      await this.connection.query(`
        INSERT INTO school_calendar (
          title, description, event_date, end_date, created_by, is_published, is_active, deleted_at
        ) VALUES (?, ?, ?, ?, ?, 1, 1, ?)
      `, [
        'SOFT DELETED: Test Event - Should Not Appear on TV',
        'This event is soft deleted and should not appear in TV content selection.',
        currentTime.format('YYYY-MM-DD'),
        tomorrow.format('YYYY-MM-DD'),
        adminId,
        currentTime.format('YYYY-MM-DD HH:mm:ss')
      ]);

      // 7. Create active calendar event (should appear)
      await this.connection.query(`
        INSERT INTO school_calendar (
          title, description, event_date, end_date, created_by, is_published, is_active
        ) VALUES (?, ?, ?, ?, ?, 1, 1)
      `, [
        'ACTIVE: Test Event - Should Appear on TV',
        'This event is active and should appear in TV content selection.',
        currentTime.format('YYYY-MM-DD'),
        tomorrow.format('YYYY-MM-DD'),
        adminId
      ]);

      // 8. Create expired single-day event (event_date in the past, no end_date)
      await this.connection.query(`
        INSERT INTO school_calendar (
          title, description, event_date, created_by, is_published, is_active
        ) VALUES (?, ?, ?, ?, 1, 1)
      `, [
        'EXPIRED SINGLE-DAY: Test Event - Should Not Appear on TV',
        'This single-day event has expired and should not appear in TV content selection.',
        yesterday.format('YYYY-MM-DD'),
        adminId
      ]);

      console.log('✅ Test data created successfully!\n');

      // Display summary
      console.log('📊 Test Data Summary:');
      console.log('Announcements:');
      console.log('  - 1 expired (visibility_end_at in past) → should be filtered out');
      console.log('  - 1 archived (status = archived) → should be filtered out');
      console.log('  - 1 soft deleted (deleted_at not null) → should be filtered out');
      console.log('  - 1 active (should appear in TV content selection)');
      console.log('\nCalendar Events:');
      console.log('  - 1 expired multi-day (end_date in past) → should be filtered out');
      console.log('  - 1 expired single-day (event_date in past) → should be filtered out');
      console.log('  - 1 soft deleted (deleted_at not null) → should be filtered out');
      console.log('  - 1 active (should appear in TV content selection)');
      console.log('\n🎯 Expected Result: Only 2 items should appear in TV content selection (1 announcement + 1 event)');

    } catch (error) {
      console.error('❌ Error creating test data:', error.message);
      throw error;
    }
  }

  async run() {
    try {
      await this.connect();
      await this.createTestData();
    } catch (error) {
      console.error('❌ Test failed:', error.message);
      process.exit(1);
    } finally {
      await this.disconnect();
    }
  }
}

// Run the test
const test = new TVContentFilteringTest();
test.run().then(() => {
  console.log('\n🎉 TV content filtering test data creation completed!');
  console.log('💡 Now check the TV Content Manager to verify filtering is working correctly.');
}).catch(error => {
  console.error('💥 Test failed:', error);
  process.exit(1);
});
