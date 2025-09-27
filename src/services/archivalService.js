const { CronJob } = require('cron');
const mysql = require('mysql2/promise');
const timezoneUtils = require('../utils/timezone');
const logger = require('../utils/logger');
const config = require('../config/config');

/**
 * Integrated Archival Service
 * Automatically archives expired announcements and calendar events
 * Runs as part of the main Node.js server process
 */

class ArchivalService {
  constructor() {
    this.connection = null;
    this.cronJob = null;
    this.isRunning = false;
    this.lastRun = null;
    this.stats = {
      totalRuns: 0,
      lastRunStats: {
        announcements: { processed: 0, archived: 0, errors: 0 },
        calendar: { processed: 0, archived: 0, errors: 0 }
      },
      allTimeStats: {
        announcements: { processed: 0, archived: 0, errors: 0 },
        calendar: { processed: 0, archived: 0, errors: 0 }
      }
    };
  }

  /**
   * Initialize the archival service
   */
  async initialize() {
    try {
      logger.info('🗄️ Initializing Archival Service...');
      
      // Create database connection
      await this.createConnection();
      
      // Set up cron job to run every 5 minutes
      this.cronJob = new CronJob(
        '*/5 * * * *', // Every 5 minutes
        () => this.runArchival(),
        null,
        false, // Don't start immediately
        'Asia/Manila' // Use Philippines timezone
      );

      logger.info('✅ Archival Service initialized successfully');
      logger.info('📅 Scheduled to run every 5 minutes (Asia/Manila timezone)');
      
      return true;
    } catch (error) {
      logger.error('❌ Failed to initialize Archival Service:', error);
      throw error;
    }
  }

  /**
   * Start the archival service
   */
  start() {
    if (this.cronJob && !this.cronJob.running) {
      this.cronJob.start();
      logger.info('🚀 Archival Service started');
      
      // Run once immediately for testing
      setTimeout(() => {
        logger.info('🧪 Running initial archival check...');
        this.runArchival();
      }, 5000); // Wait 5 seconds after server start
      
      return true;
    }
    return false;
  }

  /**
   * Stop the archival service
   */
  stop() {
    if (this.cronJob && this.cronJob.running) {
      this.cronJob.stop();
      logger.info('⏹️ Archival Service stopped');
      return true;
    }
    return false;
  }

  /**
   * Create database connection
   */
  async createConnection() {
    try {
      this.connection = await mysql.createConnection({
        host: config.database.host,
        user: config.database.user,
        password: config.database.password,
        database: config.database.database,
        timezone: '+08:00' // Philippines timezone
      });

      // Set session timezone
      await this.connection.query("SET time_zone = '+08:00'");

      logger.info('📊 Archival Service connected to database');
      return true;
    } catch (error) {
      logger.error('❌ Failed to connect to database for archival:', error);
      throw error;
    }
  }

  /**
   * Main archival process
   */
  async runArchival() {
    if (this.isRunning) {
      logger.warn('⚠️ Archival process already running, skipping...');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();
    
    // Reset current run stats
    this.stats.lastRunStats = {
      announcements: { processed: 0, archived: 0, errors: 0 },
      calendar: { processed: 0, archived: 0, errors: 0 }
    };

    try {
      logger.info('🗄️ Starting automatic content archival...');
      
      // Ensure database connection is alive
      if (!this.connection) {
        await this.createConnection();
      }

      // Archive expired announcements
      await this.archiveExpiredAnnouncements();
      
      // Archive expired calendar events
      await this.archiveExpiredCalendarEvents();

      const duration = Date.now() - startTime;
      this.stats.totalRuns++;
      this.lastRun = new Date();

      // Update all-time stats
      this.stats.allTimeStats.announcements.processed += this.stats.lastRunStats.announcements.processed;
      this.stats.allTimeStats.announcements.archived += this.stats.lastRunStats.announcements.archived;
      this.stats.allTimeStats.announcements.errors += this.stats.lastRunStats.announcements.errors;
      this.stats.allTimeStats.calendar.processed += this.stats.lastRunStats.calendar.processed;
      this.stats.allTimeStats.calendar.archived += this.stats.lastRunStats.calendar.archived;
      this.stats.allTimeStats.calendar.errors += this.stats.lastRunStats.calendar.errors;

      const totalProcessed = this.stats.lastRunStats.announcements.processed + this.stats.lastRunStats.calendar.processed;
      const totalArchived = this.stats.lastRunStats.announcements.archived + this.stats.lastRunStats.calendar.archived;
      const totalErrors = this.stats.lastRunStats.announcements.errors + this.stats.lastRunStats.calendar.errors;

      logger.info('✅ Automatic content archival completed', {
        duration: `${duration}ms`,
        totalProcessed,
        totalArchived,
        totalErrors,
        runNumber: this.stats.totalRuns
      });

    } catch (error) {
      logger.error('❌ Archival process failed:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Archive expired announcements
   */
  async archiveExpiredAnnouncements() {
    const currentTime = timezoneUtils.formatForDatabase();
    
    try {
      await this.connection.beginTransaction();

      // Find expired announcements
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
      this.stats.lastRunStats.announcements.processed = expiredAnnouncements.length;

      if (expiredAnnouncements.length === 0) {
        await this.connection.commit();
        return;
      }

      logger.info(`📢 Found ${expiredAnnouncements.length} expired announcements to archive`);

      // Archive each expired announcement (mark as system-archived)
      const archiveQuery = `
        UPDATE announcements
        SET
          status = 'archived',
          archived_at = ?,
          archived_by = 'system',
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
            this.stats.lastRunStats.announcements.archived++;
            logger.info('📢 Archived expired announcement', {
              id: announcement.announcement_id,
              title: announcement.title,
              expiredAt: announcement.visibility_end_at
            });
          }
        } catch (error) {
          this.stats.lastRunStats.announcements.errors++;
          logger.error('❌ Failed to archive announcement', {
            id: announcement.announcement_id,
            error: error.message
          });
        }
      }

      await this.connection.commit();
    } catch (error) {
      await this.connection.rollback();
      logger.error('❌ Announcement archival failed:', error);
      throw error;
    }
  }

  /**
   * Archive expired calendar events
   */
  async archiveExpiredCalendarEvents() {
    const currentDate = timezoneUtils.now().format('YYYY-MM-DD');
    const currentTime = timezoneUtils.formatForDatabase();
    
    try {
      await this.connection.beginTransaction();

      // Find expired calendar events
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
      this.stats.lastRunStats.calendar.processed = expiredEvents.length;

      if (expiredEvents.length === 0) {
        await this.connection.commit();
        return;
      }

      logger.info(`📅 Found ${expiredEvents.length} expired calendar events to archive`);

      // Archive each expired event by setting deleted_at (soft delete)
      const archiveQuery = `
        UPDATE school_calendar 
        SET 
          deleted_at = ?,
          updated_at = ?
        WHERE calendar_id = ?
          AND is_active = 1
          AND deleted_at IS NULL;
      `;

      for (const event of expiredEvents) {
        try {
          const [result] = await this.connection.query(archiveQuery, [
            currentTime,
            currentTime,
            event.calendar_id
          ]);

          if (result.affectedRows > 0) {
            this.stats.lastRunStats.calendar.archived++;
            logger.info('📅 Archived expired calendar event', {
              id: event.calendar_id,
              title: event.title,
              endDate: event.end_date
            });
          }
        } catch (error) {
          this.stats.lastRunStats.calendar.errors++;
          logger.error('❌ Failed to archive calendar event', {
            id: event.calendar_id,
            error: error.message
          });
        }
      }

      await this.connection.commit();
    } catch (error) {
      await this.connection.rollback();
      logger.error('❌ Calendar archival failed:', error);
      throw error;
    }
  }

  /**
   * Get archival service status and statistics
   */
  getStatus() {
    return {
      isInitialized: !!this.cronJob,
      isRunning: this.cronJob?.running || false,
      isProcessing: this.isRunning,
      lastRun: this.lastRun,
      nextRun: this.cronJob?.nextDate()?.toDate() || null,
      stats: this.stats,
      schedule: '*/5 * * * *', // Every 5 minutes
      timezone: 'Asia/Manila'
    };
  }

  /**
   * Manually trigger archival process (for testing/admin use)
   */
  async manualRun() {
    logger.info('🔧 Manual archival run triggered');
    await this.runArchival();
    return this.getStatus();
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    if (this.cronJob) {
      this.cronJob.stop();
    }
    if (this.connection) {
      await this.connection.end();
    }
    logger.info('🧹 Archival Service cleaned up');
  }
}

// Create singleton instance
const archivalService = new ArchivalService();

module.exports = archivalService;
