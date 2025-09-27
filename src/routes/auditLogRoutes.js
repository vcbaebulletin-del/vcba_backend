const express = require('express');
const { param, query, body } = require('express-validator');
const AuditLogController = require('../controllers/AuditLogController');
const { authenticate, adminOnly } = require('../middleware/auth');
const { requireSuperAdmin } = require('../middleware/permissions');
const { validateRequest } = require('../middleware/validation');

const router = express.Router();

// Apply authentication and admin-only middleware to all routes
router.use(authenticate);
router.use(adminOnly);

// Validation rules
const paginationValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('sort_by')
    .optional()
    .isIn(['performed_at', 'user_type', 'action_type', 'target_table', 'user_id'])
    .withMessage('Invalid sort field'),
  query('sort_order')
    .optional()
    .isIn(['ASC', 'DESC'])
    .withMessage('Sort order must be ASC or DESC')
];

const filterValidation = [
  query('user_type')
    .optional()
    .isIn(['admin', 'student', 'system'])
    .withMessage('User type must be admin, student, or system'),
  query('user_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('User ID must be a positive integer'),
  query('action_type')
    .optional()
    .isIn(['CREATE', 'READ', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'EXPORT', 'SECURITY_EVENT'])
    .withMessage('Invalid action type'),
  query('target_table')
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('Target table must be between 1 and 100 characters'),
  query('start_date')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date'),
  query('end_date')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date'),
  query('search')
    .optional()
    .isLength({ min: 1, max: 255 })
    .withMessage('Search term must be between 1 and 255 characters')
];

const logIdValidation = [
  param('logId')
    .isInt({ min: 1 })
    .withMessage('Log ID must be a positive integer')
];

const userIdValidation = [
  param('userId')
    .isInt({ min: 1 })
    .withMessage('User ID must be a positive integer')
];

const tableNameValidation = [
  param('tableName')
    .isLength({ min: 1, max: 100 })
    .withMessage('Table name must be between 1 and 100 characters')
    .matches(/^[a-zA-Z_][a-zA-Z0-9_]*$/)
    .withMessage('Table name must be a valid database table name')
];

const exportValidation = [
  query('format')
    .optional()
    .isIn(['json', 'csv'])
    .withMessage('Export format must be json or csv')
];

const cleanupValidation = [
  body('days_to_keep')
    .optional()
    .isInt({ min: 30, max: 3650 })
    .withMessage('Days to keep must be between 30 and 3650 (10 years)')
];

const summaryValidation = [
  query('days')
    .optional()
    .isInt({ min: 1, max: 365 })
    .withMessage('Days must be between 1 and 365')
];

// Routes

/**
 * GET /api/audit-logs
 * Get audit logs with filtering and pagination
 * Access: Admin only
 */
router.get(
  '/',
  [...paginationValidation, ...filterValidation],
  validateRequest,
  AuditLogController.getAuditLogs
);

/**
 * GET /api/audit-logs/stats
 * Get audit log statistics
 * Access: Admin only
 */
router.get(
  '/stats',
  [
    query('start_date')
      .optional()
      .isISO8601()
      .withMessage('Start date must be a valid ISO 8601 date'),
    query('end_date')
      .optional()
      .isISO8601()
      .withMessage('End date must be a valid ISO 8601 date')
  ],
  validateRequest,
  AuditLogController.getAuditLogStats
);

/**
 * GET /api/audit-logs/summary
 * Get audit log summary for dashboard
 * Access: Admin only
 */
router.get(
  '/summary',
  summaryValidation,
  validateRequest,
  AuditLogController.getAuditLogSummary
);

/**
 * GET /api/audit-logs/export
 * Export audit logs
 * Access: Admin only
 */
router.get(
  '/export',
  [...filterValidation, ...exportValidation],
  validateRequest,
  AuditLogController.exportAuditLogs
);

/**
 * GET /api/audit-logs/user/:userId
 * Get audit logs for specific user
 * Access: Admin only
 */
router.get(
  '/user/:userId',
  [...userIdValidation, ...paginationValidation, ...filterValidation],
  validateRequest,
  AuditLogController.getUserAuditLogs
);

/**
 * GET /api/audit-logs/table/:tableName
 * Get audit logs for specific table
 * Access: Admin only
 */
router.get(
  '/table/:tableName',
  [...tableNameValidation, ...paginationValidation, ...filterValidation],
  validateRequest,
  AuditLogController.getTableAuditLogs
);

/**
 * GET /api/audit-logs/:logId
 * Get specific audit log by ID
 * Access: Admin only
 */
router.get(
  '/:logId',
  logIdValidation,
  validateRequest,
  AuditLogController.getAuditLogById
);

/**
 * DELETE /api/audit-logs/cleanup
 * Clean up old audit logs
 * Access: Super Admin only
 */
router.delete(
  '/cleanup',
  requireSuperAdmin,
  cleanupValidation,
  validateRequest,
  AuditLogController.cleanupOldLogs
);

// Error handling middleware for this router
router.use((error, req, res, next) => {
  console.error('Audit Log Route Error:', error);
  
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: error.details
    });
  }

  if (error.name === 'UnauthorizedError') {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized access to audit logs'
    });
  }

  if (error.name === 'ForbiddenError') {
    return res.status(403).json({
      success: false,
      message: 'Insufficient permissions to access audit logs'
    });
  }

  // Generic error response
  res.status(500).json({
    success: false,
    message: 'Internal server error while processing audit log request',
    error: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
});

module.exports = router;
