const mysql = require("mysql2/promise");
const timezoneUtils = require('../src/utils/timezone');
const logger = require('../src/utils/logger');
require('dotenv').config();

/**
 * Automatic Archival Script for Expired Content
 * Archives announcements and calendar events that have passed their expiration dates
 * Uses Asia/Manila timezone for all date comparisons
 */
class AutoArchiver {
  constructor() {
    this.connection = null;
    this.stats = {
      announcements: { processed: 0, archived: 0, errors: 0 },
      calendar: { processed: 0, archived: 0, errors: 0 }
    };
  }

  /**
   * Initialize database connection with proper timezone
   */
  async connect() {
    try {
      this.connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASS || '',
        database: process.env.DB_NAME || 'vcba_e_bulletin_board',
        timezone: '+08:00', // Philippines timezone
        acquireTimeout: 60000,
        timeout: 60000
      });

      // Set session timezone to Asia/Manila
      await this.connection.query("SET time_zone = '+08:00'");
      
      logger.info('Auto-archiver connected to database', {
        timezone: timezoneUtils.getTimezoneName(),
        currentTime: timezoneUtils.formatForDatabase()
      });

      return true;
    } catch (error) {
      logger.error('Failed to connect to database', { error: error.message });
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
      logger.info('Auto-archiver disconnected from database');
    }
  }

  /**
   * Archive expired announcements
   * Criteria: visibility_end_at <= current Asia/Manila time AND status != 'archived' AND deleted_at IS NULL
   */
  async archiveExpiredAnnouncements() {
    const currentTime = timezoneUtils.formatForDatabase();
    
    try {
      // Start transaction
      await this.connection.beginTransaction();

      // Find expired announcements that are not already archived or deleted
      const findExpiredQuery = `
        SELECT 
          announcement_id,
          title,
          status,
          visibility_end_at,
          posted_by
        FROM announcements 
        WHERE visibility_end_at IS NOT NULL 
          AND visibility_end_at <= ?
          AND status != 'archived'
          AND deleted_at IS NULL
        FOR UPDATE;
      `;

      const [expiredAnnouncements] = await this.connection.query(findExpiredQuery, [currentTime]);
      this.stats.announcements.processed = expiredAnnouncements.length;

      if (expiredAnnouncements.length === 0) {
        logger.info('No expired announcements found to archive');
        await this.connection.commit();
        return;
      }

      logger.info(`Found ${expiredAnnouncements.length} expired announcements to archive`);

      // Archive each expired announcement
      const archiveQuery = `
        UPDATE announcements 
        SET 
          status = 'archived',
          archived_at = ?,
          updated_at = ?
        WHERE announcement_id = ?
          AND status != 'archived'
          AND deleted_at IS NULL;
      `;

      for (const announcement of expiredAnnouncements) {
        try {
          const [result] = await this.connection.query(archiveQuery, [
            currentTime,
            currentTime,
            announcement.announcement_id
          ]);

          if (result.affectedRows > 0) {
            this.stats.announcements.archived++;
            logger.info('Archived expired announcement', {
              announcementId: announcement.announcement_id,
              title: announcement.title,
              expiredAt: announcement.visibility_end_at,
              archivedAt: currentTime
            });
          }
        } catch (error) {
          this.stats.announcements.errors++;
          logger.error('Failed to archive announcement', {
            announcementId: announcement.announcement_id,
            error: error.message
          });
        }
      }

      await this.connection.commit();
      logger.info('Announcement archival completed', {
        processed: this.stats.announcements.processed,
        archived: this.stats.announcements.archived,
        errors: this.stats.announcements.errors
      });

    } catch (error) {
      await this.connection.rollback();
      logger.error('Announcement archival failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Archive expired calendar events
   * Criteria: end_date <= current Asia/Manila date AND is_active = 1 AND deleted_at IS NULL
   */
  async archiveExpiredCalendarEvents() {
    const currentDate = timezoneUtils.now().format('YYYY-MM-DD');
    const currentTime = timezoneUtils.formatForDatabase();
    
    try {
      // Start transaction
      await this.connection.beginTransaction();

      // Find expired calendar events that are still active and not deleted
      const findExpiredQuery = `
        SELECT 
          calendar_id,
          title,
          event_date,
          end_date,
          is_active,
          created_by
        FROM school_calendar 
        WHERE end_date IS NOT NULL 
          AND end_date <= ?
          AND is_active = 1
          AND deleted_at IS NULL
        FOR UPDATE;
      `;

      const [expiredEvents] = await this.connection.query(findExpiredQuery, [currentDate]);
      this.stats.calendar.processed = expiredEvents.length;

      if (expiredEvents.length === 0) {
        logger.info('No expired calendar events found to archive');
        await this.connection.commit();
        return;
      }

      logger.info(`Found ${expiredEvents.length} expired calendar events to archive`);

      // Archive each expired event by setting is_active = 0 and updating timestamp
      const archiveQuery = `
        UPDATE school_calendar 
        SET 
          is_active = 0,
          updated_at = ?
        WHERE calendar_id = ?
          AND is_active = 1
          AND deleted_at IS NULL;
      `;

      for (const event of expiredEvents) {
        try {
          const [result] = await this.connection.query(archiveQuery, [
            currentTime,
            event.calendar_id
          ]);

          if (result.affectedRows > 0) {
            this.stats.calendar.archived++;
            logger.info('Archived expired calendar event', {
              calendarId: event.calendar_id,
              title: event.title,
              endDate: event.end_date,
              archivedAt: currentTime
            });
          }
        } catch (error) {
          this.stats.calendar.errors++;
          logger.error('Failed to archive calendar event', {
            calendarId: event.calendar_id,
            error: error.message
          });
        }
      }

      await this.connection.commit();
      logger.info('Calendar event archival completed', {
        processed: this.stats.calendar.processed,
        archived: this.stats.calendar.archived,
        errors: this.stats.calendar.errors
      });

    } catch (error) {
      await this.connection.rollback();
      logger.error('Calendar event archival failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Run the complete archival process
   */
  async run() {
    const startTime = Date.now();
    
    try {
      logger.info('Starting automatic content archival process', {
        timezone: timezoneUtils.getTimezoneName(),
        currentTime: timezoneUtils.formatForDisplay(timezoneUtils.now())
      });

      await this.connect();
      
      // Archive expired announcements
      await this.archiveExpiredAnnouncements();
      
      // Archive expired calendar events
      await this.archiveExpiredCalendarEvents();

      const duration = Date.now() - startTime;
      const totalProcessed = this.stats.announcements.processed + this.stats.calendar.processed;
      const totalArchived = this.stats.announcements.archived + this.stats.calendar.archived;
      const totalErrors = this.stats.announcements.errors + this.stats.calendar.errors;

      logger.info('Automatic content archival completed successfully', {
        duration: `${duration}ms`,
        totalProcessed,
        totalArchived,
        totalErrors,
        stats: this.stats
      });

      return {
        success: true,
        stats: this.stats,
        duration
      };

    } catch (error) {
      logger.error('Automatic content archival failed', { 
        error: error.message,
        stack: error.stack 
      });
      
      return {
        success: false,
        error: error.message,
        stats: this.stats
      };
    } finally {
      await this.disconnect();
    }
  }

  /**
   * Get archival statistics
   */
  getStats() {
    return this.stats;
  }
}

// Run the archiver if this script is executed directly
if (require.main === module) {
  const archiver = new AutoArchiver();
  
  archiver.run()
    .then(result => {
      if (result.success) {
        console.log('✅ Archival process completed successfully');
        console.log('📊 Statistics:', JSON.stringify(result.stats, null, 2));
        process.exit(0);
      } else {
        console.error('❌ Archival process failed:', result.error);
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('💥 Unexpected error:', error.message);
      process.exit(1);
    });
}

module.exports = AutoArchiver;
