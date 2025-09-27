const express = require('express');
const { param, query } = require('express-validator');
const NotificationController = require('../controllers/NotificationController');
const { authenticate, adminOnly } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');
const { auditCRUD, auditContentAction } = require('../middleware/auditLogger');

const router = express.Router();

// Apply authentication to all routes
router.use(authenticate);

// Validation rules
const notificationIdValidation = [
  param('notificationId')
    .isInt({ min: 1 })
    .withMessage('Notification ID must be a positive integer')
    .toInt(),
];

const getNotificationsValidation = [
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
  query('is_read')
    .optional()
    .isBoolean()
    .withMessage('is_read must be a boolean')
    .toBoolean(),
  query('type')
    .optional()
    .isIn(['announcement', 'comment', 'system', 'reminder'])
    .withMessage('Type must be one of: announcement, comment, system, reminder'),
];

// User notification routes
router.get('/', getNotificationsValidation, validateRequest, NotificationController.getNotifications);
router.get('/unread-count', NotificationController.getUnreadCount);
router.put('/:notificationId/read', notificationIdValidation, validateRequest, auditContentAction('MARK_READ', 'notifications'), NotificationController.markAsRead);
router.put('/mark-all-read', auditContentAction('MARK_ALL_READ', 'notifications'), NotificationController.markAllAsRead);
router.delete('/:notificationId', notificationIdValidation, validateRequest, auditCRUD('notifications', { action: 'DELETE' }), NotificationController.deleteNotification);

// Public routes (no auth required)
router.get('/types', NotificationController.getNotificationTypes);

// Admin routes
router.get('/admin/stats', adminOnly, NotificationController.getNotificationStats);

module.exports = router;
