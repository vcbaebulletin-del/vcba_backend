const express = require('express');
const { param, query } = require('express-validator');
const ArchiveController = require('../controllers/ArchiveController');
const { authenticate, adminOnly } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');
const { auditContentAction } = require('../middleware/auditLogger');

const router = express.Router();

// Apply authentication and admin-only middleware to all routes
router.use(authenticate);
router.use(adminOnly);

// Validation schemas
const paginationValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('sort_order')
    .optional()
    .isIn(['ASC', 'DESC'])
    .withMessage('Sort order must be ASC or DESC'),
];

const searchValidation = [
  query('search')
    .optional()
    .isLength({ min: 1, max: 255 })
    .withMessage('Search term must be between 1 and 255 characters'),
];

const dateRangeValidation = [
  query('start_date')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date'),
  query('end_date')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date'),
];

const idValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('ID must be a positive integer')
];

const announcementIdValidation = [
  param('announcementId')
    .isInt({ min: 1 })
    .withMessage('Announcement ID must be a positive integer')
];

const eventIdValidation = [
  param('eventId')
    .isInt({ min: 1 })
    .withMessage('Event ID must be a positive integer')
];

const studentIdValidation = [
  param('studentId')
    .isInt({ min: 1 })
    .withMessage('Student ID must be a positive integer')
];

// Archive statistics route
router.get('/stats', ArchiveController.getArchiveStats);

// Archive retrieval routes
router.get(
  '/announcements',
  [
    ...paginationValidation,
    ...searchValidation,
    ...dateRangeValidation,
    query('category_id')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Category ID must be a positive integer'),
    query('subcategory_id')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Subcategory ID must be a positive integer'),
    query('posted_by')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Posted by must be a positive integer'),
    query('sort_by')
      .optional()
      .isIn(['archived_at', 'created_at', 'updated_at', 'published_at', 'title', 'category_name', 'author_name', 'view_count'])
      .withMessage('Invalid sort field for announcements')
  ],
  validateRequest,
  ArchiveController.getArchivedAnnouncements
);

router.get(
  '/calendar-events',
  [
    ...paginationValidation,
    ...searchValidation,
    ...dateRangeValidation,
    query('category_id')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Category ID must be a positive integer'),
    query('subcategory_id')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Subcategory ID must be a positive integer'),
    query('created_by')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Created by must be a positive integer'),
    query('sort_by')
      .optional()
      .isIn(['updated_at', 'created_at', 'title', 'event_date', 'archived_at', 'category_name', 'author_name'])
      .withMessage('Invalid sort field for calendar events')
  ],
  validateRequest,
  ArchiveController.getArchivedCalendarEvents
);

router.get(
  '/students',
  [
    ...paginationValidation,
    ...searchValidation,
    ...dateRangeValidation,
    query('grade_level')
      .optional()
      .isInt({ min: 11, max: 12 })
      .withMessage('Grade level must be 11 or 12'),
    query('created_by')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Created by must be a positive integer'),
    query('sort_by')
      .optional()
      .isIn(['updated_at', 'created_at', 'archived_at', 'email', 'student_number', 'last_name', 'first_name', 'grade_level'])
      .withMessage('Invalid sort field for students')
  ],
  validateRequest,
  ArchiveController.getArchivedStudents
);

// Archive statistics
router.get(
  '/statistics',
  ArchiveController.getArchiveStatistics
);

// Restore routes (admin only)
router.put(
  '/announcements/:announcementId/restore',
  announcementIdValidation,
  validateRequest,
  auditContentAction('RESTORE', 'announcements'),
  ArchiveController.restoreAnnouncement
);

router.put(
  '/calendar-events/:eventId/restore',
  eventIdValidation,
  validateRequest,
  auditContentAction('RESTORE', 'calendar_events'),
  ArchiveController.restoreCalendarEvent
);

router.put(
  '/students/:studentId/restore',
  studentIdValidation,
  validateRequest,
  auditContentAction('RESTORE', 'students'),
  ArchiveController.restoreStudent
);

// Permanent deletion routes (admin only) - use with extreme caution
router.delete(
  '/announcements/:announcementId/permanent',
  announcementIdValidation,
  validateRequest,
  auditContentAction('PERMANENT_DELETE', 'announcements'),
  ArchiveController.permanentlyDeleteAnnouncement
);

module.exports = router;
