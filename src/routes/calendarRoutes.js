const express = require('express');
const { body, param, query } = require('express-validator');
const CalendarController = require('../controllers/CalendarController');
const { authenticate, adminOnly, optionalAuth } = require('../middleware/auth');
const { requireCreateCalendarEvents, requireManageCalendarEvents } = require('../middleware/permissions');
const { validateRequest, commonValidations } = require('../middleware/validation');
const { handleCalendarImageUpload } = require('../middleware/calendarUpload');
const { auditContentAction, auditCRUD, auditFileAction } = require('../middleware/auditLogger');

const router = express.Router();

// Validation rules
const createEventValidation = [
  body('title')
    .notEmpty()
    .withMessage('Title is required')
    .isLength({ min: 1, max: 255 })
    .withMessage('Title must be between 1 and 255 characters')
    .trim(),
  body('description')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Description must not exceed 1000 characters')
    .trim(),
  body('event_date')
    .notEmpty()
    .withMessage('Event date is required')
    .isISO8601()
    .withMessage('Event date must be a valid date'),
  body('end_date')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid date'),
  body('category_id')
    .notEmpty()
    .withMessage('Category is required')
    .isInt({ min: 1 })
    .withMessage('Category ID must be a positive integer')
    .toInt(),
  body('subcategory_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Subcategory ID must be a positive integer')
    .toInt(),
  body('is_recurring')
    .optional()
    .isBoolean()
    .withMessage('is_recurring must be a boolean')
    .toBoolean(),
  body('recurrence_pattern')
    .optional()
    .isIn(['yearly', 'monthly', 'weekly'])
    .withMessage('Recurrence pattern must be yearly, monthly, or weekly'),
  body('is_active')
    .optional()
    .isBoolean()
    .withMessage('is_active must be a boolean')
    .toBoolean(),
  body('is_published')
    .optional()
    .isBoolean()
    .withMessage('is_published must be a boolean')
    .toBoolean(),
  body('allow_comments')
    .optional()
    .isBoolean()
    .withMessage('allow_comments must be a boolean')
    .toBoolean(),
  body('is_alert')
    .optional()
    .isBoolean()
    .withMessage('is_alert must be a boolean')
    .toBoolean(),
];

const updateEventValidation = [
  param('eventId')
    .isInt({ min: 1 })
    .withMessage('Event ID must be a positive integer')
    .toInt(),
  body('title')
    .optional()
    .isLength({ min: 1, max: 255 })
    .withMessage('Title must be between 1 and 255 characters')
    .trim(),
  body('description')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Description must not exceed 1000 characters')
    .trim(),
  body('event_date')
    .optional()
    .isISO8601()
    .withMessage('Event date must be a valid date'),
  body('end_date')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid date'),
  body('category_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Category ID must be a positive integer')
    .toInt(),
  body('subcategory_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Subcategory ID must be a positive integer')
    .toInt(),
  body('is_recurring')
    .optional()
    .isBoolean()
    .withMessage('is_recurring must be a boolean')
    .toBoolean(),
  body('recurrence_pattern')
    .optional()
    .isIn(['yearly', 'monthly', 'weekly'])
    .withMessage('Recurrence pattern must be yearly, monthly, or weekly'),
  body('is_active')
    .optional()
    .isBoolean()
    .withMessage('is_active must be a boolean')
    .toBoolean(),
  body('is_published')
    .optional()
    .isBoolean()
    .withMessage('is_published must be a boolean')
    .toBoolean(),
  body('allow_comments')
    .optional()
    .isBoolean()
    .withMessage('allow_comments must be a boolean')
    .toBoolean(),
  body('is_alert')
    .optional()
    .isBoolean()
    .withMessage('is_alert must be a boolean')
    .toBoolean(),
];

const eventIdValidation = [
  param('eventId')
    .isInt({ min: 1 })
    .withMessage('Event ID must be a positive integer')
    .toInt(),
];

const dateValidation = [
  param('date')
    .isISO8601()
    .withMessage('Date must be a valid date'),
];

const getEventsValidation = [
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
  query('start_date')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid date'),
  query('end_date')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid date'),
  query('category_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Category ID must be a positive integer')
    .toInt(),
  query('subcategory_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Subcategory ID must be a positive integer')
    .toInt(),
  query('is_active')
    .optional()
    .isBoolean()
    .withMessage('is_active must be a boolean')
    .toBoolean(),
  query('is_recurring')
    .optional()
    .isBoolean()
    .withMessage('is_recurring must be a boolean')
    .toBoolean(),
  query('search')
    .optional()
    .trim(),
  query('sort_by')
    .optional()
    .isIn(['event_date', 'title', 'created_at', 'updated_at'])
    .withMessage('Sort by must be one of: event_date, title, created_at, updated_at'),
  query('sort_order')
    .optional()
    .isIn(['ASC', 'DESC'])
    .withMessage('Sort order must be ASC or DESC'),
];

const calendarViewValidation = [
  query('year')
    .notEmpty()
    .withMessage('Year is required')
    .isInt({ min: 2020, max: 2100 })
    .withMessage('Year must be between 2020 and 2100')
    .toInt(),
  query('month')
    .optional()
    .isInt({ min: 1, max: 12 })
    .withMessage('Month must be between 1 and 12')
    .toInt(),
];

const dateRangeValidation = [
  query('start_date')
    .notEmpty()
    .withMessage('Start date is required')
    .isISO8601()
    .withMessage('Start date must be a valid date'),
  query('end_date')
    .notEmpty()
    .withMessage('End date is required')
    .isISO8601()
    .withMessage('End date must be a valid date'),
];

// Public routes (with optional authentication)
router.get('/', optionalAuth, getEventsValidation, validateRequest, CalendarController.getEvents);
router.get('/view', optionalAuth, calendarViewValidation, validateRequest, CalendarController.getCalendarView);
router.get('/current-month', optionalAuth, CalendarController.getCurrentMonthEvents);
router.get('/upcoming', optionalAuth, CalendarController.getUpcomingEvents);

// Specific routes must come before parameterized routes to avoid conflicts
router.get('/categories/with-subcategories', optionalAuth, CalendarController.getCategoriesWithSubcategories);
router.get('/categories/active/with-subcategories', optionalAuth, CalendarController.getActiveCategoriesWithSubcategories);
router.get('/date-range', optionalAuth, dateRangeValidation, validateRequest, CalendarController.getEventsByDateRange);
router.get('/date/:date', optionalAuth, dateValidation, validateRequest, CalendarController.getEventsByDate);
// Parameterized routes (these should come last to avoid conflicts)
router.get('/:eventId/images', optionalAuth, eventIdValidation, validateRequest, CalendarController.getEventAttachments);
router.get('/:eventId', optionalAuth, eventIdValidation, validateRequest, CalendarController.getEvent);

// Protected routes (require authentication)
router.use(authenticate);

// Admin-only routes - Both super_admin and professor can create and manage calendar events
router.post('/', adminOnly, requireCreateCalendarEvents, createEventValidation, validateRequest, auditContentAction('CREATE', 'calendar_events'), CalendarController.createEvent);
router.put('/:eventId', adminOnly, requireManageCalendarEvents, updateEventValidation, validateRequest, auditContentAction('UPDATE', 'calendar_events'), CalendarController.updateEvent);
router.delete('/:eventId', adminOnly, requireManageCalendarEvents, eventIdValidation, validateRequest, auditContentAction('DELETE', 'calendar_events'), CalendarController.deleteEvent);

// Event attachment routes (admin only)
router.get('/:eventId/attachments', adminOnly, eventIdValidation, validateRequest, auditCRUD('calendar_attachments', { action: 'READ' }), CalendarController.getEventAttachments);
router.post('/:eventId/attachments', adminOnly, handleCalendarImageUpload, eventIdValidation, validateRequest, auditFileAction('UPLOAD_EVENT_ATTACHMENT'), CalendarController.uploadEventAttachment);
router.put('/attachments/:attachmentId', adminOnly, handleCalendarImageUpload, auditFileAction('UPDATE_EVENT_ATTACHMENT'), CalendarController.updateEventAttachment);
router.put('/:eventId/attachments/order', adminOnly, eventIdValidation, validateRequest, auditContentAction('UPDATE_ATTACHMENT_ORDER', 'calendar_events'), CalendarController.updateAttachmentOrder);
router.put('/:eventId/attachments/:attachmentId/primary', adminOnly, eventIdValidation, validateRequest, auditContentAction('SET_PRIMARY_ATTACHMENT', 'calendar_events'), CalendarController.setPrimaryAttachment);
router.delete('/attachments/:attachmentId', adminOnly, auditFileAction('DELETE_EVENT_ATTACHMENT'), CalendarController.deleteEventAttachment);
router.put('/:eventId/attachments/:attachmentId/primary', adminOnly, eventIdValidation, validateRequest, auditContentAction('SET_PRIMARY_ATTACHMENT', 'calendar_events'), CalendarController.setPrimaryAttachment);

// Event management routes (admin only)
router.put('/:eventId/publish', adminOnly, requireManageCalendarEvents, eventIdValidation, validateRequest, auditContentAction('PUBLISH', 'calendar_events'), CalendarController.publishEvent);
router.put('/:eventId/unpublish', adminOnly, requireManageCalendarEvents, eventIdValidation, validateRequest, auditContentAction('UNPUBLISH', 'calendar_events'), CalendarController.unpublishEvent);
router.put('/:eventId/soft-delete', adminOnly, requireManageCalendarEvents, eventIdValidation, validateRequest, auditContentAction('SOFT_DELETE', 'calendar_events'), CalendarController.softDeleteEvent);
router.put('/:eventId/restore', adminOnly, requireManageCalendarEvents, eventIdValidation, validateRequest, auditContentAction('RESTORE', 'calendar_events'), CalendarController.restoreEvent);

// Calendar reaction routes (authenticated users)
router.post('/:eventId/like', eventIdValidation, validateRequest, CalendarController.likeCalendarEvent);
router.delete('/:eventId/like', eventIdValidation, validateRequest, CalendarController.unlikeCalendarEvent);

module.exports = router;
