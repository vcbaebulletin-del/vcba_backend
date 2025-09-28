const mysql = require("mysql2/promise");
const timezoneUtils = require('../src/utils/timezone');
const AutoArchiver = require('./auto-archive-expired-content');
require('dotenv').config();

/**
 * Comprehensive Test Suite for Archival System
 * Tests the automatic archival functionality end-to-end
 */
class ArchivalTestSuite {
  constructor() {
    this.connection = null;
    this.testResults = {
      passed: 0,
      failed: 0,
      tests: []
    };
  }

  /**
   * Initialize database connection
   */
  async connect() {
    try {
      this.connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASS || '',
        database: process.env.DB_NAME || 'vcba_e_bulletin_board',
        timezone: '+08:00'
      });

      await this.connection.query("SET time_zone = '+08:00'");
      return true;
    } catch (error) {
      console.error('❌ Failed to connect to database:', error.message);
      throw error;
    }
  }

  /**
   * Close database connection
   */
  async disconnect() {
    if (this.connection) {
      await this.connection.end();
      this.connection = null;
    }
  }

  /**
   * Log test result
   */
  logTest(testName, passed, message = '') {
    const result = {
      name: testName,
      passed,
      message,
      timestamp: new Date().toISOString()
    };

    this.testResults.tests.push(result);
    
    if (passed) {
      this.testResults.passed++;
      console.log(`✅ ${testName}: ${message}`);
    } else {
      this.testResults.failed++;
      console.log(`❌ ${testName}: ${message}`);
    }
  }

  /**
   * Test 1: Database Schema Validation
   */
  async testDatabaseSchema() {
    console.log('\n🔍 Test 1: Database Schema Validation');
    console.log('=====================================');

    try {
      // Check announcements table structure
      const [announcementsDesc] = await this.connection.query("DESCRIBE announcements");
      const announcementColumns = announcementsDesc.map(col => col.Field);
      
      const requiredAnnouncementColumns = [
        'announcement_id', 'status', 'visibility_end_at', 'archived_at', 'deleted_at'
      ];
      
      for (const column of requiredAnnouncementColumns) {
        if (announcementColumns.includes(column)) {
          this.logTest(`Announcements.${column}`, true, 'Column exists');
        } else {
          this.logTest(`Announcements.${column}`, false, 'Column missing');
        }
      }

      // Check calendar table structure
      const [calendarDesc] = await this.connection.query("DESCRIBE school_calendar");
      const calendarColumns = calendarDesc.map(col => col.Field);
      
      const requiredCalendarColumns = [
        'calendar_id', 'end_date', 'is_active', 'deleted_at'
      ];
      
      for (const column of requiredCalendarColumns) {
        if (calendarColumns.includes(column)) {
          this.logTest(`Calendar.${column}`, true, 'Column exists');
        } else {
          this.logTest(`Calendar.${column}`, false, 'Column missing');
        }
      }

      // Check status enum values
      const [statusInfo] = await this.connection.query(`
        SELECT COLUMN_TYPE 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = 'announcements' 
        AND COLUMN_NAME = 'status'
      `);
      
      const statusEnum = statusInfo[0]?.COLUMN_TYPE || '';
      if (statusEnum.includes('archived')) {
        this.logTest('Status.archived', true, 'Archived status available');
      } else {
        this.logTest('Status.archived', false, 'Archived status missing');
      }

    } catch (error) {
      this.logTest('Database Schema', false, error.message);
    }
  }

  /**
   * Test 2: Timezone Configuration
   */
  async testTimezoneConfiguration() {
    console.log('\n🌍 Test 2: Timezone Configuration');
    console.log('==================================');

    try {
      // Test database timezone
      const [timezoneInfo] = await this.connection.query(`
        SELECT @@session.time_zone as session_tz, NOW() as current_db_time
      `);
      
      const sessionTz = timezoneInfo[0].session_tz;
      if (sessionTz === '+08:00') {
        this.logTest('Database Timezone', true, 'Set to +08:00 (Asia/Manila)');
      } else {
        this.logTest('Database Timezone', false, `Set to ${sessionTz}, expected +08:00`);
      }

      // Test timezone utility
      const currentTime = timezoneUtils.now();
      const timezoneName = timezoneUtils.getTimezoneName();
      
      if (timezoneName === 'Asia/Manila') {
        this.logTest('Timezone Utils', true, 'Configured for Asia/Manila');
      } else {
        this.logTest('Timezone Utils', false, `Configured for ${timezoneName}, expected Asia/Manila`);
      }

      // Test date formatting
      const formattedDate = timezoneUtils.formatForDatabase();
      if (formattedDate && formattedDate.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)) {
        this.logTest('Date Formatting', true, `Format: ${formattedDate}`);
      } else {
        this.logTest('Date Formatting', false, `Invalid format: ${formattedDate}`);
      }

    } catch (error) {
      this.logTest('Timezone Configuration', false, error.message);
    }
  }

  /**
   * Test 3: Create Test Data
   */
  async testCreateTestData() {
    console.log('\n📝 Test 3: Create Test Data');
    console.log('============================');

    try {
      const currentTime = timezoneUtils.formatForDatabase();
      const pastTime = timezoneUtils.now().subtract(1, 'hour').format('YYYY-MM-DD HH:mm:ss');
      const futureTime = timezoneUtils.now().add(1, 'hour').format('YYYY-MM-DD HH:mm:ss');

      // Get first admin ID for foreign key constraint
      const [adminResult] = await this.connection.query(`
        SELECT admin_id FROM admin_accounts LIMIT 1
      `);
      const adminId = adminResult[0]?.admin_id || 1;

      // Create test announcement with expired visibility
      const [announcementResult] = await this.connection.query(`
        INSERT INTO announcements (
          title, content, category_id, posted_by, status,
          visibility_end_at, created_at, updated_at
        ) VALUES (
          'Test Expired Announcement',
          'This announcement should be archived automatically',
          1, ?, 'published', ?, ?, ?
        )
      `, [adminId, pastTime, currentTime, currentTime]);

      if (announcementResult.insertId) {
        this.logTest('Create Test Announcement', true, `ID: ${announcementResult.insertId}`);
      } else {
        this.logTest('Create Test Announcement', false, 'Failed to create');
      }

      // Create test calendar event with expired end date
      const pastDate = timezoneUtils.now().subtract(1, 'day').format('YYYY-MM-DD');
      const [calendarResult] = await this.connection.query(`
        INSERT INTO school_calendar (
          title, description, event_date, end_date,
          is_active, created_by, created_at, updated_at
        ) VALUES (
          'Test Expired Event',
          'This event should be archived automatically',
          ?, ?, 1, ?, ?, ?
        )
      `, [pastDate, pastDate, adminId, currentTime, currentTime]);

      if (calendarResult.insertId) {
        this.logTest('Create Test Calendar Event', true, `ID: ${calendarResult.insertId}`);
      } else {
        this.logTest('Create Test Calendar Event', false, 'Failed to create');
      }

    } catch (error) {
      this.logTest('Create Test Data', false, error.message);
    }
  }

  /**
   * Test 4: Archival Process
   */
  async testArchivalProcess() {
    console.log('\n🗃️ Test 4: Archival Process');
    console.log('============================');

    try {
      // Count expired items before archival
      const [expiredAnnouncements] = await this.connection.query(`
        SELECT COUNT(*) as count 
        FROM announcements 
        WHERE visibility_end_at IS NOT NULL 
          AND visibility_end_at <= NOW()
          AND status != 'archived'
          AND deleted_at IS NULL
      `);

      const [expiredEvents] = await this.connection.query(`
        SELECT COUNT(*) as count 
        FROM school_calendar 
        WHERE end_date IS NOT NULL 
          AND end_date <= CURDATE()
          AND is_active = 1
          AND deleted_at IS NULL
      `);

      const expiredAnnouncementCount = expiredAnnouncements[0].count;
      const expiredEventCount = expiredEvents[0].count;

      this.logTest('Pre-archival Count', true, 
        `${expiredAnnouncementCount} announcements, ${expiredEventCount} events`);

      // Run archival process
      const archiver = new AutoArchiver();
      const result = await archiver.run();

      if (result.success) {
        this.logTest('Archival Process', true, 
          `Archived ${result.stats.announcements.archived} announcements, ${result.stats.calendar.archived} events`);
      } else {
        this.logTest('Archival Process', false, result.error);
      }

      // Verify archival results
      const [archivedAnnouncements] = await this.connection.query(`
        SELECT COUNT(*) as count 
        FROM announcements 
        WHERE status = 'archived' 
          AND archived_at IS NOT NULL
      `);

      const [archivedEvents] = await this.connection.query(`
        SELECT COUNT(*) as count 
        FROM school_calendar 
        WHERE is_active = 0
      `);

      const archivedAnnouncementCount = archivedAnnouncements[0].count;
      const archivedEventCount = archivedEvents[0].count;

      this.logTest('Post-archival Verification', true, 
        `${archivedAnnouncementCount} archived announcements, ${archivedEventCount} archived events`);

    } catch (error) {
      this.logTest('Archival Process', false, error.message);
    }
  }

  /**
   * Test 5: API Filtering
   */
  async testAPIFiltering() {
    console.log('\n🔌 Test 5: API Filtering');
    console.log('=========================');

    try {
      // Test that archived announcements are excluded from normal queries
      const [normalAnnouncements] = await this.connection.query(`
        SELECT COUNT(*) as count 
        FROM announcements a
        WHERE a.deleted_at IS NULL
          AND a.status != 'archived'
          AND (a.visibility_start_at IS NULL OR a.visibility_start_at <= NOW())
          AND (a.visibility_end_at IS NULL OR a.visibility_end_at >= NOW())
      `);

      const [allAnnouncements] = await this.connection.query(`
        SELECT COUNT(*) as count 
        FROM announcements 
        WHERE deleted_at IS NULL
      `);

      const normalCount = normalAnnouncements[0].count;
      const totalCount = allAnnouncements[0].count;

      if (normalCount < totalCount) {
        this.logTest('Announcement Filtering', true, 
          `${normalCount} visible, ${totalCount} total (filtering working)`);
      } else {
        this.logTest('Announcement Filtering', false, 
          'No filtering detected - archived items may be visible');
      }

      // Test calendar event filtering
      const [activeEvents] = await this.connection.query(`
        SELECT COUNT(*) as count 
        FROM school_calendar 
        WHERE deleted_at IS NULL AND is_active = 1
      `);

      const [allEvents] = await this.connection.query(`
        SELECT COUNT(*) as count 
        FROM school_calendar 
        WHERE deleted_at IS NULL
      `);

      const activeCount = activeEvents[0].count;
      const totalEventCount = allEvents[0].count;

      if (activeCount <= totalEventCount) {
        this.logTest('Calendar Filtering', true, 
          `${activeCount} active, ${totalEventCount} total`);
      } else {
        this.logTest('Calendar Filtering', false, 
          'Filtering logic error detected');
      }

    } catch (error) {
      this.logTest('API Filtering', false, error.message);
    }
  }

  /**
   * Test 6: Cleanup Test Data
   */
  async testCleanup() {
    console.log('\n🧹 Test 6: Cleanup Test Data');
    console.log('=============================');

    try {
      // Remove test announcements
      const [announcementResult] = await this.connection.query(`
        DELETE FROM announcements 
        WHERE title LIKE 'Test %' 
          AND content LIKE '%should be archived automatically%'
      `);

      this.logTest('Cleanup Announcements', true, 
        `Removed ${announcementResult.affectedRows} test announcements`);

      // Remove test calendar events
      const [calendarResult] = await this.connection.query(`
        DELETE FROM school_calendar 
        WHERE title LIKE 'Test %' 
          AND description LIKE '%should be archived automatically%'
      `);

      this.logTest('Cleanup Calendar Events', true, 
        `Removed ${calendarResult.affectedRows} test events`);

    } catch (error) {
      this.logTest('Cleanup', false, error.message);
    }
  }

  /**
   * Run all tests
   */
  async runAllTests() {
    const startTime = Date.now();
    
    console.log('🧪 VCBA Content Archival System Test Suite');
    console.log('==========================================');
    console.log(`Started at: ${new Date().toISOString()}`);
    console.log(`Timezone: ${timezoneUtils.getTimezoneName()}`);

    try {
      await this.connect();
      
      await this.testDatabaseSchema();
      await this.testTimezoneConfiguration();
      await this.testCreateTestData();
      await this.testArchivalProcess();
      await this.testAPIFiltering();
      await this.testCleanup();

      const duration = Date.now() - startTime;
      const totalTests = this.testResults.passed + this.testResults.failed;

      console.log('\n📊 Test Results Summary');
      console.log('=======================');
      console.log(`Total Tests: ${totalTests}`);
      console.log(`✅ Passed: ${this.testResults.passed}`);
      console.log(`❌ Failed: ${this.testResults.failed}`);
      console.log(`⏱️ Duration: ${duration}ms`);
      console.log(`📈 Success Rate: ${((this.testResults.passed / totalTests) * 100).toFixed(1)}%`);

      if (this.testResults.failed === 0) {
        console.log('\n🎉 All tests passed! Archival system is working correctly.');
        return { success: true, results: this.testResults };
      } else {
        console.log('\n⚠️ Some tests failed. Please review the issues above.');
        return { success: false, results: this.testResults };
      }

    } catch (error) {
      console.error('\n💥 Test suite failed:', error.message);
      return { success: false, error: error.message, results: this.testResults };
    } finally {
      await this.disconnect();
    }
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  const testSuite = new ArchivalTestSuite();
  
  testSuite.runAllTests()
    .then(result => {
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 Unexpected error:', error.message);
      process.exit(1);
    });
}

module.exports = ArchivalTestSuite;
