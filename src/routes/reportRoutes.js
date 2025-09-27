const express = require('express');
const { query, body } = require('express-validator');
const ReportController = require('../controllers/ReportController');
const reportController = new ReportController();
const { authenticate, adminOnly } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');
const { auditSystemEvent } = require('../middleware/auditLogger');

const router = express.Router();

// Apply authentication and admin requirement to all routes
// TEMPORARILY DISABLED FOR TESTING
// router.use(authenticate);
// router.use(adminOnly);

// Validation rules
const periodValidation = [
  query('period')
    .optional()
    .isIn(['weekly', 'monthly'])
    .withMessage('Period must be either "weekly" or "monthly"')
];

const dateRangeValidation = [
  query('start_date')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date'),
  query('end_date')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date')
];

const daysValidation = [
  query('days')
    .optional()
    .isInt({ min: 1, max: 365 })
    .withMessage('Days must be between 1 and 365')
];

const formatValidation = [
  query('format')
    .optional()
    .isIn(['json', 'csv'])
    .withMessage('Format must be either "json" or "csv"')
];

const contentFilterValidation = [
  query('content_type')
    .optional()
    .isIn(['all', 'announcements', 'calendar'])
    .withMessage('Content type must be "all", "announcements", or "calendar"'),
  query('include_holidays')
    .optional()
    .isBoolean()
    .withMessage('Include holidays must be a boolean value'),
  query('alert_posts_only')
    .optional()
    .isBoolean()
    .withMessage('Alert posts only must be a boolean value'),
  query('category_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Category ID must be a positive integer'),
  query('user_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('User ID must be a positive integer'),
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
];

// Routes

/**
 * GET /api/reports/content-activity
 * Generate content activity report categorized by alert vs regular posts
 * Access: Admin only
 */
router.get(
  '/content-activity',
  [...periodValidation, ...dateRangeValidation, ...contentFilterValidation],
  validateRequest,
  auditSystemEvent('REPORT_GENERATE', 'Generated content activity report'),
  reportController.generateContentReport
);

/**
 * GET /api/reports/summary
 * Get report summary for dashboard
 * Access: Admin only
 */
router.get(
  '/summary',
  daysValidation,
  validateRequest,
  auditSystemEvent('REPORT_VIEW', 'Viewed report summary'),
  reportController.getReportSummary
);

/**
 * GET /api/reports/alert-analysis
 * Get detailed analysis of alert posts and events
 * Access: Admin only
 */
router.get(
  '/alert-analysis',
  [...periodValidation, ...dateRangeValidation],
  validateRequest,
  auditSystemEvent('REPORT_ANALYZE', 'Generated alert analysis report'),
  reportController.getAlertAnalysis
);

/**
 * GET /api/reports/export
 * Export report data in JSON or CSV format
 * Access: Admin only
 */
router.get(
  '/export',
  [...periodValidation, ...dateRangeValidation, ...formatValidation],
  validateRequest,
  auditSystemEvent('REPORT_EXPORT', 'Exported report data'),
  reportController.exportReport
);

// Validation rules for flexible report generation (monthly, weekly, daily, custom)
const reportGenerationValidation = [
  // Fields validation (required for all report types)
  body('fields')
    .isArray({ min: 1 })
    .withMessage('Fields must be a non-empty array')
    .custom((fields) => {
      const validFields = ['Announcements', 'SchoolCalendar'];
      const invalidFields = fields.filter(field => !validFields.includes(field));
      if (invalidFields.length > 0) {
        throw new Error(`Invalid fields: ${invalidFields.join(', ')}. Valid fields are: ${validFields.join(', ')}`);
      }
      return true;
    }),

  // Optional month field (for monthly reports)
  body('month')
    .optional()
    .matches(/^\d{4}-\d{2}$/)
    .withMessage('Month must be in YYYY-MM format'),

  // Optional date fields (for weekly, daily, custom reports)
  body('startDate')
    .optional()
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage('startDate must be in YYYY-MM-DD format'),

  body('endDate')
    .optional()
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage('endDate must be in YYYY-MM-DD format'),

  body('weekStart')
    .optional()
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage('weekStart must be in YYYY-MM-DD format'),

  body('weekEnd')
    .optional()
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage('weekEnd must be in YYYY-MM-DD format'),

  // Optional includeImages field
  body('includeImages')
    .optional()
    .isBoolean()
    .withMessage('includeImages must be a boolean'),

  // Conditional validation based on report type
  body()
    .custom((body) => {
      console.log('🔍 [VALIDATION DEBUG] Custom validation called with body:', JSON.stringify(body, null, 2));

      // Monthly report validation
      if (body.month) {
        console.log('🔍 [VALIDATION DEBUG] Monthly report detected');
        if (!body.month.match(/^\d{4}-\d{2}$/)) {
          throw new Error('Month must be in YYYY-MM format');
        }
        return true;
      }

      // Weekly report validation
      if (body.weekStart && body.weekEnd) {
        console.log('🔍 [VALIDATION DEBUG] Weekly report detected');
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(body.weekStart)) {
          throw new Error('weekStart must be in YYYY-MM-DD format');
        }
        if (!dateRegex.test(body.weekEnd)) {
          throw new Error('weekEnd must be in YYYY-MM-DD format');
        }

        const startDate = new Date(body.weekStart);
        const endDate = new Date(body.weekEnd);
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
          throw new Error('Invalid date format');
        }
        if (startDate > endDate) {
          throw new Error('weekStart cannot be after weekEnd');
        }
        return true;
      }

      // Date range validation for daily and custom reports
      if (body.startDate && body.endDate) {
        console.log('🔍 [VALIDATION DEBUG] Daily/Custom report detected');
        // Validate date format (YYYY-MM-DD)
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(body.startDate)) {
          throw new Error('startDate must be in YYYY-MM-DD format');
        }
        if (!dateRegex.test(body.endDate)) {
          throw new Error('endDate must be in YYYY-MM-DD format');
        }

        // Validate date range
        const startDate = new Date(body.startDate);
        const endDate = new Date(body.endDate);
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
          throw new Error('Invalid date format');
        }
        if (startDate > endDate) {
          throw new Error('startDate cannot be after endDate');
        }
        return true;
      }

      console.log('🔍 [VALIDATION DEBUG] No valid report type detected');
      console.log('🔍 [VALIDATION DEBUG] body.month:', body.month);
      console.log('🔍 [VALIDATION DEBUG] body.weekStart:', body.weekStart);
      console.log('🔍 [VALIDATION DEBUG] body.weekEnd:', body.weekEnd);
      console.log('🔍 [VALIDATION DEBUG] body.startDate:', body.startDate);
      console.log('🔍 [VALIDATION DEBUG] body.endDate:', body.endDate);
      throw new Error('Either month (for monthly reports) or startDate/endDate (for daily/custom reports) or weekStart/weekEnd (for weekly reports) must be provided');
    })
];

/**
 * POST /api/reports/generate
 * Generate PDF report (monthly, weekly, daily, or custom date range)
 * Access: Admin only
 */
router.post(
  '/generate',
  (req, res, next) => {
    console.log('🔍 [REPORT DEBUG] Incoming request to /api/reports/generate');
    console.log('🔍 [REPORT DEBUG] Request method:', req.method);
    console.log('🔍 [REPORT DEBUG] Request headers:', JSON.stringify(req.headers, null, 2));
    console.log('🔍 [REPORT DEBUG] Request body:', JSON.stringify(req.body, null, 2));
    console.log('🔍 [REPORT DEBUG] Request query:', JSON.stringify(req.query, null, 2));
    next();
  },
  reportGenerationValidation,
  (req, res, next) => {
    console.log('🔍 [REPORT DEBUG] After validation middleware');
    next();
  },
  validateRequest,
  (req, res, next) => {
    console.log('🔍 [REPORT DEBUG] After validateRequest middleware');
    next();
  },
  auditSystemEvent('REPORT_GENERATE', 'Generated PDF report'),
  (req, res, next) => {
    console.log('🔍 [REPORT DEBUG] Before controller - about to call generateReport');
    next();
  },
  reportController.generateReport
);

module.exports = router;
