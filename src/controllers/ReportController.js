const ReportModel = require('../models/ReportModel');
const { asyncHandler } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

class ReportController {
  /**
   * Generate content activity report
   * GET /api/reports/content-activity
   */
  generateContentReport = asyncHandler(async (req, res) => {
    const {
      period = 'weekly',
      start_date,
      end_date,
      content_type = 'all',
      include_holidays = 'false',
      alert_posts_only = 'false',
      category_id,
      user_id,
      page = '1',
      limit = '25'
    } = req.query;

    try {
      // Validate period
      if (!['weekly', 'monthly'].includes(period)) {
        return res.status(400).json({
          success: false,
          message: 'Period must be either "weekly" or "monthly"'
        });
      }

      // Calculate date range if not provided
      let reportStartDate = start_date;
      let reportEndDate = end_date;

      if (!reportStartDate || !reportEndDate) {
        const now = new Date();
        reportEndDate = now.toISOString();

        if (period === 'weekly') {
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          reportStartDate = weekAgo.toISOString();
        } else if (period === 'monthly') {
          const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
          reportStartDate = monthAgo.toISOString();
        }
      }

      // Validate date range
      const startDate = new Date(reportStartDate);
      const endDate = new Date(reportEndDate);

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid date format. Please use ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ)'
        });
      }

      if (startDate >= endDate) {
        return res.status(400).json({
          success: false,
          message: 'Start date must be before end date'
        });
      }

      // Parse filter parameters
      const filters = {
        content_type,
        include_holidays: include_holidays === 'true',
        alert_posts_only: alert_posts_only === 'true',
        category_id: category_id ? parseInt(category_id) : null,
        user_id: user_id ? parseInt(user_id) : null
      };

      const pagination = {
        page: parseInt(page),
        limit: parseInt(limit)
      };

      // Generate report
      const reportModel = new ReportModel();
      const reportData = await reportModel.generateContentReport({
        period,
        start_date: reportStartDate,
        end_date: reportEndDate,
        filters,
        pagination
      });

      // Log report generation
      logger.info('Content report generated', {
        period,
        start_date: reportStartDate,
        end_date: reportEndDate,
        generated_by: req.user?.id || req.user?.admin_id,
        user_type: req.user?.role || 'admin'
      });

      res.status(200).json({
        success: true,
        message: 'Content activity report generated successfully',
        data: reportData
      });

    } catch (error) {
      logger.error('Error generating content report:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate content report',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });

  /**
   * Get report summary for dashboard
   * GET /api/reports/summary
   */
  getReportSummary = asyncHandler(async (req, res) => {
    const { days = 7 } = req.query;

    try {
      // Validate days parameter
      const daysNum = parseInt(days);
      if (isNaN(daysNum) || daysNum < 1 || daysNum > 365) {
        return res.status(400).json({
          success: false,
          message: 'Days must be a number between 1 and 365'
        });
      }

      // Calculate date range
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - daysNum * 24 * 60 * 60 * 1000);

      const reportModel = new ReportModel();
      const reportData = await reportModel.generateContentReport({
        period: daysNum <= 7 ? 'weekly' : 'monthly',
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString()
      });

      // Extract summary data
      const summary = {
        period: `Last ${daysNum} days`,
        date_range: reportData.date_range,
        announcements_summary: reportData.announcements.summary,
        calendar_events_summary: reportData.calendar_events.summary,
        user_activity_summary: {
          total_unique_users: reportData.user_activity.total_unique_users,
          user_types: reportData.user_activity.user_type_summary
        },
        system_activity_summary: reportData.system_activity.activity_trends,
        generated_at: reportData.generated_at
      };

      res.status(200).json({
        success: true,
        message: 'Report summary retrieved successfully',
        data: summary
      });

    } catch (error) {
      logger.error('Error getting report summary:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get report summary',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });

  /**
   * Get alert posts analysis
   * GET /api/reports/alert-analysis
   */
  getAlertAnalysis = asyncHandler(async (req, res) => {
    const {
      period = 'monthly',
      start_date,
      end_date
    } = req.query;

    try {
      // Calculate date range if not provided
      let reportStartDate = start_date;
      let reportEndDate = end_date;

      if (!reportStartDate || !reportEndDate) {
        const now = new Date();
        reportEndDate = now.toISOString();

        if (period === 'weekly') {
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          reportStartDate = weekAgo.toISOString();
        } else {
          const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
          reportStartDate = monthAgo.toISOString();
        }
      }

      const reportModel = new ReportModel();
      const reportData = await reportModel.generateContentReport({
        period,
        start_date: reportStartDate,
        end_date: reportEndDate
      });

      // Focus on alert analysis
      const alertAnalysis = {
        period,
        date_range: reportData.date_range,
        alert_announcements: {
          total: reportData.announcements.alert_posts.total_activities,
          activities: reportData.announcements.alert_posts.activities,
          recent_posts: reportData.announcements.alert_posts.posts.slice(0, 10)
        },
        alert_events: {
          total: reportData.calendar_events.alert_events.total_activities,
          activities: reportData.calendar_events.alert_events.activities,
          recent_events: reportData.calendar_events.alert_events.events.slice(0, 10)
        },
        comparison: {
          announcement_alert_percentage: reportData.announcements.summary.alert_percentage,
          calendar_alert_percentage: reportData.calendar_events.summary.alert_percentage,
          total_alert_activities: 
            reportData.announcements.alert_posts.total_activities + 
            reportData.calendar_events.alert_events.total_activities,
          total_regular_activities: 
            reportData.announcements.regular_posts.total_activities + 
            reportData.calendar_events.regular_events.total_activities
        },
        generated_at: reportData.generated_at
      };

      res.status(200).json({
        success: true,
        message: 'Alert analysis retrieved successfully',
        data: alertAnalysis
      });

    } catch (error) {
      logger.error('Error getting alert analysis:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get alert analysis',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });

  /**
   * Export report data
   * GET /api/reports/export
   */
  exportReport = asyncHandler(async (req, res) => {
    const {
      period = 'weekly',
      start_date,
      end_date,
      format = 'json'
    } = req.query;

    try {
      // Validate format
      if (!['json', 'csv'].includes(format)) {
        return res.status(400).json({
          success: false,
          message: 'Format must be either "json" or "csv"'
        });
      }

      // Calculate date range if not provided
      let reportStartDate = start_date;
      let reportEndDate = end_date;

      if (!reportStartDate || !reportEndDate) {
        const now = new Date();
        reportEndDate = now.toISOString();

        if (period === 'weekly') {
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          reportStartDate = weekAgo.toISOString();
        } else {
          const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
          reportStartDate = monthAgo.toISOString();
        }
      }

      const reportModel = new ReportModel();
      const reportData = await reportModel.generateContentReport({
        period,
        start_date: reportStartDate,
        end_date: reportEndDate
      });

      // Log export
      logger.info('Report exported', {
        period,
        format,
        start_date: reportStartDate,
        end_date: reportEndDate,
        exported_by: req.user?.id || req.user?.admin_id,
        user_type: req.user?.role || 'admin'
      });

      if (format === 'json') {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="content-report-${period}-${new Date().toISOString().split('T')[0]}.json"`);
        res.status(200).json(reportData);
      } else if (format === 'csv') {
        // Convert to CSV format (simplified)
        const csvData = this.convertReportToCSV(reportData);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="content-report-${period}-${new Date().toISOString().split('T')[0]}.csv"`);
        res.status(200).send(csvData);
      }

    } catch (error) {
      logger.error('Error exporting report:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to export report',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });

  /**
   * Helper method to convert report data to CSV
   */
  convertReportToCSV(reportData) {
    const lines = [];
    
    // Header
    lines.push('Content Activity Report');
    lines.push(`Period: ${reportData.period}`);
    lines.push(`Date Range: ${reportData.date_range.start_date} to ${reportData.date_range.end_date}`);
    lines.push('');
    
    // Announcements Summary
    lines.push('ANNOUNCEMENTS SUMMARY');
    lines.push('Type,Total Activities,Created,Updated,Deleted');
    lines.push(`Alert Posts,${reportData.announcements.alert_posts.total_activities},${reportData.announcements.alert_posts.activities.created},${reportData.announcements.alert_posts.activities.updated},${reportData.announcements.alert_posts.activities.deleted}`);
    lines.push(`Regular Posts,${reportData.announcements.regular_posts.total_activities},${reportData.announcements.regular_posts.activities.created},${reportData.announcements.regular_posts.activities.updated},${reportData.announcements.regular_posts.activities.deleted}`);
    lines.push('');
    
    // Calendar Events Summary
    lines.push('CALENDAR EVENTS SUMMARY');
    lines.push('Type,Total Activities,Created,Updated,Deleted');
    lines.push(`Alert Events,${reportData.calendar_events.alert_events.total_activities},${reportData.calendar_events.alert_events.activities.created},${reportData.calendar_events.alert_events.activities.updated},${reportData.calendar_events.alert_events.activities.deleted}`);
    lines.push(`Regular Events,${reportData.calendar_events.regular_events.total_activities},${reportData.calendar_events.regular_events.activities.created},${reportData.calendar_events.regular_events.activities.updated},${reportData.calendar_events.regular_events.activities.deleted}`);
    lines.push('');
    
    // User Activity
    lines.push('TOP ACTIVE USERS');
    lines.push('User Type,User ID,Total Actions,Creates,Updates,Deletes');
    reportData.user_activity.most_active_users.slice(0, 10).forEach(user => {
      lines.push(`${user.user_type},${user.user_id},${user.total_actions},${user.creates},${user.updates},${user.deletes}`);
    });
    
    return lines.join('\n');
  }

  /**
   * Generate flexible PDF report (monthly, weekly, daily, custom)
   * POST /api/reports/generate
   */
  generateReport = asyncHandler(async (req, res) => {
    console.log('🔍 [CONTROLLER DEBUG] generateReport called');
    console.log('🔍 [CONTROLLER DEBUG] Request body:', JSON.stringify(req.body, null, 2));
    console.log('🔍 [CONTROLLER DEBUG] Request user:', req.user);

    const { month, startDate, endDate, weekStart, weekEnd, fields, includeImages = false } = req.body;

    console.log('🔍 [CONTROLLER DEBUG] Extracted parameters:');
    console.log('  - month:', month);
    console.log('  - startDate:', startDate);
    console.log('  - endDate:', endDate);
    console.log('  - weekStart:', weekStart);
    console.log('  - weekEnd:', weekEnd);
    console.log('  - fields:', fields);
    console.log('  - includeImages:', includeImages);

    try {
      let reportStartDate, reportEndDate, reportTitle, reportType;

      // Determine report type and calculate date range
      console.log('🔍 [CONTROLLER DEBUG] Determining report type...');

      if (month) {
        console.log('🔍 [CONTROLLER DEBUG] Processing monthly report');
        // Monthly report
        const [year, monthNum] = month.split('-').map(Number);
        reportStartDate = new Date(Date.UTC(year, monthNum - 1, 1));
        reportEndDate = new Date(Date.UTC(year, monthNum, 0, 23, 59, 59, 999));
        reportType = 'monthly';

        const monthDate = new Date(reportStartDate);
        const monthName = monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        reportTitle = `Monthly Report - ${monthName}`;

        console.log('🔍 [CONTROLLER DEBUG] Monthly report configured:');
        console.log('  - reportStartDate:', reportStartDate.toISOString());
        console.log('  - reportEndDate:', reportEndDate.toISOString());
        console.log('  - reportTitle:', reportTitle);

      } else if (weekStart && weekEnd) {
        console.log('🔍 [CONTROLLER DEBUG] Processing weekly report');
        // Weekly report
        reportStartDate = new Date(weekStart + 'T00:00:00.000Z');
        reportEndDate = new Date(weekEnd + 'T23:59:59.999Z');
        reportType = 'weekly';

        const startStr = reportStartDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const endStr = reportEndDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        reportTitle = `Weekly Report - ${startStr} to ${endStr}`;

        console.log('🔍 [CONTROLLER DEBUG] Weekly report configured:');
        console.log('  - reportStartDate:', reportStartDate.toISOString());
        console.log('  - reportEndDate:', reportEndDate.toISOString());
        console.log('  - reportTitle:', reportTitle);

      } else if (startDate && endDate) {
        console.log('🔍 [CONTROLLER DEBUG] Processing daily/custom report');
        // Daily or custom range report
        reportStartDate = new Date(startDate + 'T00:00:00.000Z');
        reportEndDate = new Date(endDate + 'T23:59:59.999Z');

        // Determine if it's daily or custom
        const daysDifference = Math.ceil((reportEndDate.getTime() - reportStartDate.getTime()) / (1000 * 60 * 60 * 24));
        console.log('🔍 [CONTROLLER DEBUG] Days difference:', daysDifference);

        if (daysDifference <= 1) {
          reportType = 'daily';
          const dateStr = reportStartDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
          reportTitle = `Daily Report - ${dateStr}`;
        } else {
          reportType = 'custom';
          const startStr = reportStartDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          const endStr = reportEndDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
          reportTitle = `Custom Report - ${startStr} to ${endStr}`;
        }

        console.log('🔍 [CONTROLLER DEBUG] Daily/Custom report configured:');
        console.log('  - reportType:', reportType);
        console.log('  - reportStartDate:', reportStartDate.toISOString());
        console.log('  - reportEndDate:', reportEndDate.toISOString());
        console.log('  - reportTitle:', reportTitle);

      } else {
        console.log('🔍 [CONTROLLER DEBUG] No valid date parameters found');
        console.log('🔍 [CONTROLLER DEBUG] Available parameters:', { month, startDate, endDate, weekStart, weekEnd });
        return res.status(400).json({
          success: false,
          message: 'Invalid request: must provide either month, startDate/endDate, or weekStart/weekEnd'
        });
      }

      // Validate date range
      if (isNaN(reportStartDate.getTime()) || isNaN(reportEndDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid date format'
        });
      }

      // Check if dates are not in the future
      const now = new Date();
      if (reportStartDate > now) {
        return res.status(400).json({
          success: false,
          message: 'Cannot generate reports for future dates'
        });
      }

      const reportModel = new ReportModel();
      const reportData = await reportModel.generateMonthlyContentReport({
        month: month || `${reportStartDate.getFullYear()}-${String(reportStartDate.getMonth() + 1).padStart(2, '0')}`,
        start_date: reportStartDate.toISOString(),
        end_date: reportEndDate.toISOString(),
        fields,
        generated_by: req.user?.email || req.user?.username || 'Unknown Admin'
      });

      // Override the report title with our custom title
      reportData.report.title = reportTitle;
      reportData.report.type = reportType;
      reportData.report.includeImages = includeImages;

      // Log report generation
      logger.info(`${reportType.charAt(0).toUpperCase() + reportType.slice(1)} report generated`, {
        reportType,
        start_date: reportStartDate.toISOString(),
        end_date: reportEndDate.toISOString(),
        fields,
        includeImages,
        generated_by: req.user?.id || req.user?.admin_id,
        user_type: req.user?.role || 'admin',
        items_count: reportData.report.items.length
      });

      res.status(200).json({
        success: true,
        message: `${reportType.charAt(0).toUpperCase() + reportType.slice(1)} report generated successfully`,
        data: reportData
      });

    } catch (error) {
      logger.error('Error generating report:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate report',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });

  /**
   * Generate monthly PDF report (legacy method - kept for backward compatibility)
   * POST /api/reports/generate-monthly
   */
  generateMonthlyReport = asyncHandler(async (req, res) => {
    const { month, fields } = req.body;

    try {
      // Parse month to get start and end dates (using UTC to avoid timezone issues)
      const [year, monthNum] = month.split('-').map(Number);
      const startDate = new Date(Date.UTC(year, monthNum - 1, 1));
      const endDate = new Date(Date.UTC(year, monthNum, 0, 23, 59, 59, 999));

      // Validate date range
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid month format. Please use YYYY-MM format'
        });
      }

      // Check if month is not in the future
      const now = new Date();
      if (startDate > now) {
        return res.status(400).json({
          success: false,
          message: 'Cannot generate reports for future months'
        });
      }

      const reportModel = new ReportModel();
      const reportData = await reportModel.generateMonthlyContentReport({
        month,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        fields,
        generated_by: req.user?.email || req.user?.username || 'Unknown Admin'
      });

      // Log report generation
      logger.info('Monthly report generated', {
        month,
        fields,
        generated_by: req.user?.id || req.user?.admin_id,
        user_type: req.user?.role || 'admin',
        items_count: reportData.report.items.length
      });

      res.status(200).json({
        success: true,
        message: 'Monthly report generated successfully',
        data: reportData
      });

    } catch (error) {
      logger.error('Error generating monthly report:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate monthly report',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });
}

module.exports = ReportController;
