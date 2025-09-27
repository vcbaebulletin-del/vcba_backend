const express = require('express');
const { body, query } = require('express-validator');
const SMSController = require('../controllers/SMSController');
const { authenticate, adminOnly } = require('../middleware/auth');
const { requireManageSMSSettings } = require('../middleware/permissions');
const { validateRequest } = require('../middleware/validation');
const { auditCRUD, auditContentAction } = require('../middleware/auditLogger');

const router = express.Router();
const smsController = new SMSController();

// Health check endpoint (no auth required)
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'SMS service is available',
    timestamp: new Date().toISOString()
  });
});

// Validation rules (moved before debug route)
const testMessageValidation = [
  body('phoneNumber')
    .notEmpty()
    .withMessage('Phone number is required')
    .matches(/^(\+639|09)\d{9}$/)
    .withMessage('Invalid Philippine mobile number format'),
  body('message')
    .notEmpty()
    .withMessage('Message is required')
    .isLength({ min: 1, max: 1600 })
    .withMessage('Message must be between 1 and 1600 characters')
];

const configUpdateValidation = [
  body('apiKey')
    .optional()
    .isLength({ min: 10 })
    .withMessage('API key must be at least 10 characters'),
  body('deviceId')
    .optional()
    .isLength({ min: 10 })
    .withMessage('Device ID must be at least 10 characters'),
  body('baseURL')
    .optional()
    .isURL()
    .withMessage('Base URL must be a valid URL'),
  body('isEnabled')
    .optional()
    .isBoolean()
    .withMessage('isEnabled must be a boolean'),
  body('rateLimitPerMinute')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('Rate limit must be between 1 and 1000')
];

// No debug routes needed - using production routes

// Apply authentication and admin-only access to all other routes
router.use(authenticate);
router.use(adminOnly);

const statisticsValidation = [
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date'),
  query('status')
    .optional()
    .isIn(['pending', 'sent', 'failed', 'delivered'])
    .withMessage('Status must be one of: pending, sent, failed, delivered')
];

const historyValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer')
    .toInt(),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
    .toInt(),
  query('phoneNumber')
    .optional()
    .matches(/^(\+639|09)\d{9}$/)
    .withMessage('Invalid Philippine mobile number format'),
  query('status')
    .optional()
    .isIn(['pending', 'sent', 'failed', 'delivered'])
    .withMessage('Status must be one of: pending, sent, failed, delivered')
];

const cleanupValidation = [
  body('daysOld')
    .optional()
    .isInt({ min: 1, max: 365 })
    .withMessage('Days old must be between 1 and 365')
    .toInt()
];

// SMS Configuration Routes
router.get('/status',
  auditContentAction('READ', 'sms_config'),
  smsController.getStatus
);

router.get('/config',
  requireManageSMSSettings,
  auditContentAction('READ', 'sms_config'),
  smsController.getFullConfig
);

router.put('/config',
  requireManageSMSSettings,
  configUpdateValidation,
  validateRequest,
  auditContentAction('update', 'sms_config'),
  smsController.updateConfig
);

// SMS Testing Routes
router.post('/test', 
  requireManageSMSSettings,
  testMessageValidation,
  validateRequest,
  auditContentAction('send_test_sms', 'sms_notifications'),
  smsController.sendTestMessage
);

router.post('/test-service',
  requireManageSMSSettings,
  body('testNumber')
    .optional()
    .matches(/^(\+639|09)\d{9}$/)
    .withMessage('Invalid Philippine mobile number format'),
  validateRequest,
  auditContentAction('test_sms_service', 'sms_config'),
  smsController.testService
);

// SMS Statistics and History Routes
router.get('/statistics',
  statisticsValidation,
  validateRequest,
  auditContentAction('read', 'sms_statistics'),
  smsController.getStatistics
);

router.get('/history',
  historyValidation,
  validateRequest,
  auditContentAction('read', 'sms_history'),
  smsController.getHistory
);

// SMS Templates Routes
router.get('/templates',
  auditContentAction('read', 'sms_templates'),
  smsController.getTemplates
);

// SMS Maintenance Routes
router.post('/cleanup',
  requireManageSMSSettings,
  cleanupValidation,
  validateRequest,
  auditContentAction('cleanup', 'sms_notifications'),
  smsController.cleanupOldNotifications
);

module.exports = router;
