const { asyncHandler } = require('../middleware/errorHandler');
const archivalService = require('../services/archivalService');
const logger = require('../utils/logger');

/**
 * Archival Controller
 * Provides API endpoints for monitoring and managing the automatic archival system
 */

/**
 * Get archival service status and statistics
 */
const getStatus = asyncHandler(async (req, res) => {
  const status = archivalService.getStatus();

  res.status(200).json({
    success: true,
    message: 'Archival service status retrieved successfully',
    data: {
      service: status,
      description: {
        isInitialized: 'Whether the archival service has been initialized',
        isRunning: 'Whether the cron job is actively scheduled',
        isProcessing: 'Whether an archival process is currently running',
        lastRun: 'Timestamp of the last archival run',
        nextRun: 'Timestamp of the next scheduled run',
        schedule: 'Cron schedule pattern',
        timezone: 'Timezone used for scheduling and date comparisons'
      }
    }
  });
});

/**
 * Get detailed archival statistics
 */
const getStatistics = asyncHandler(async (req, res) => {
    const status = archivalService.getStatus();
    const stats = status.stats;
    
    // Calculate success rates
    const announcementSuccessRate = stats.allTimeStats.announcements.processed > 0 
      ? ((stats.allTimeStats.announcements.archived / stats.allTimeStats.announcements.processed) * 100).toFixed(2)
      : 0;
      
    const calendarSuccessRate = stats.allTimeStats.calendar.processed > 0
      ? ((stats.allTimeStats.calendar.archived / stats.allTimeStats.calendar.processed) * 100).toFixed(2)
      : 0;

    const totalProcessed = stats.allTimeStats.announcements.processed + stats.allTimeStats.calendar.processed;
    const totalArchived = stats.allTimeStats.announcements.archived + stats.allTimeStats.calendar.archived;
    const totalErrors = stats.allTimeStats.announcements.errors + stats.allTimeStats.calendar.errors;
    
    const overallSuccessRate = totalProcessed > 0 
      ? ((totalArchived / totalProcessed) * 100).toFixed(2)
      : 0;

    res.status(200).json({
      success: true,
      message: 'Archival statistics retrieved successfully',
      data: {
        summary: {
          totalRuns: stats.totalRuns,
          totalProcessed,
          totalArchived,
          totalErrors,
          overallSuccessRate: `${overallSuccessRate}%`,
          lastRun: status.lastRun,
          nextRun: status.nextRun
        },
        announcements: {
          ...stats.allTimeStats.announcements,
          successRate: `${announcementSuccessRate}%`
        },
        calendar: {
          ...stats.allTimeStats.calendar,
          successRate: `${calendarSuccessRate}%`
        },
        lastRun: {
          announcements: stats.lastRunStats.announcements,
          calendar: stats.lastRunStats.calendar
        }
      }
    });
  });

/**
 * Manually trigger archival process (admin only)
 */
const manualRun = asyncHandler(async (req, res) => {
    logger.info('Manual archival run requested', {
      requestedBy: req.user?.id || 'unknown',
      userType: req.user?.role || 'unknown'
    });

    try {
      const result = await archivalService.manualRun();
      
      res.status(200).json({
        success: true,
        message: 'Manual archival run completed successfully',
        data: {
          status: result,
          note: 'Check the statistics for details on what was archived'
        }
      });
    } catch (error) {
      logger.error('Manual archival run failed:', error);
      res.status(500).json({
        success: false,
        message: 'Manual archival run failed',
        error: error.message
      });
    }
});

/**
 * Start the archival service (admin only)
 */
const startService = asyncHandler(async (req, res) => {
    logger.info('Archival service start requested', {
      requestedBy: req.user?.id || 'unknown',
      userType: req.user?.role || 'unknown'
    });

    const started = archivalService.start();
    
    if (started) {
      res.status(200).json({
        success: true,
        message: 'Archival service started successfully',
        data: archivalService.getStatus()
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Archival service is already running or not initialized'
      });
    }
});

/**
 * Stop the archival service (admin only)
 */
const stopService = asyncHandler(async (req, res) => {
    logger.info('Archival service stop requested', {
      requestedBy: req.user?.id || 'unknown',
      userType: req.user?.role || 'unknown'
    });

    const stopped = archivalService.stop();
    
    if (stopped) {
      res.status(200).json({
        success: true,
        message: 'Archival service stopped successfully',
        data: archivalService.getStatus()
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Archival service is not running or not initialized'
      });
    }
});

/**
 * Get archival service health check
 */
const healthCheck = asyncHandler(async (req, res) => {
    const status = archivalService.getStatus();
    const now = new Date();
    
    // Check if service is healthy
    let health = 'healthy';
    let issues = [];
    
    if (!status.isInitialized) {
      health = 'unhealthy';
      issues.push('Service not initialized');
    }
    
    if (!status.isRunning) {
      health = 'warning';
      issues.push('Service not running (cron job stopped)');
    }
    
    // Check if last run was too long ago (more than 10 minutes)
    if (status.lastRun) {
      const timeSinceLastRun = now - new Date(status.lastRun);
      const tenMinutes = 10 * 60 * 1000;
      
      if (timeSinceLastRun > tenMinutes) {
        health = 'warning';
        issues.push(`Last run was ${Math.round(timeSinceLastRun / 60000)} minutes ago`);
      }
    } else {
      issues.push('No runs recorded yet');
    }
    
    // Check error rates
    const totalProcessed = status.stats.allTimeStats.announcements.processed + status.stats.allTimeStats.calendar.processed;
    const totalErrors = status.stats.allTimeStats.announcements.errors + status.stats.allTimeStats.calendar.errors;
    
    if (totalProcessed > 0) {
      const errorRate = (totalErrors / totalProcessed) * 100;
      if (errorRate > 10) { // More than 10% error rate
        health = 'warning';
        issues.push(`High error rate: ${errorRate.toFixed(2)}%`);
      }
    }

    const httpStatus = health === 'healthy' ? 200 : health === 'warning' ? 200 : 500;

    res.status(httpStatus).json({
      success: health !== 'unhealthy',
      message: `Archival service health: ${health}`,
      data: {
        health,
        issues,
        status: {
          isInitialized: status.isInitialized,
          isRunning: status.isRunning,
          isProcessing: status.isProcessing,
          lastRun: status.lastRun,
          nextRun: status.nextRun,
          totalRuns: status.stats.totalRuns
        },
        uptime: status.lastRun ? `Last active: ${status.lastRun}` : 'Never run',
        schedule: `${status.schedule} (${status.timezone})`
      }
    });
});

/**
 * Get archival logs (recent activity)
 */
const getLogs = asyncHandler(async (req, res) => {
    const { limit = 50 } = req.query;
    
    // This would typically read from log files or database
    // For now, return basic information
    const status = archivalService.getStatus();
    
    res.status(200).json({
      success: true,
      message: 'Archival logs retrieved successfully',
      data: {
        note: 'Detailed logs are available in the server log files',
        recentActivity: {
          lastRun: status.lastRun,
          lastRunStats: status.stats.lastRunStats,
          totalRuns: status.stats.totalRuns,
          allTimeStats: status.stats.allTimeStats
        },
        logFiles: {
          application: 'logs/combined-*.log',
          errors: 'logs/error-*.log',
          archival: 'Search for "Archival" or "🗄️" in log files'
        }
      }
    });
});

module.exports = {
  getStatus,
  getStatistics,
  manualRun,
  startService,
  stopService,
  healthCheck,
  getLogs
};
