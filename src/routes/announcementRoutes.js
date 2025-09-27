const express = require('express');
const { body, param, query } = require('express-validator');
const AnnouncementController = require('../controllers/AnnouncementController');
const { authenticate, adminOnly, optionalAuth } = require('../middleware/auth');
const { requireCreateAnnouncements, requireManageAnnouncements } = require('../middleware/permissions');
const { validateRequest, commonValidations } = require('../middleware/validation');
const { handleImageUpload, handleMultipleImageUpload } = require('../middleware/upload');
const { auditContentAction, auditCRUD, auditFileAction } = require('../middleware/auditLogger');

// Middleware to handle both JSON and multipart requests
const handleRequestType = (req, res, next) => {
  const contentType = req.headers['content-type'] || '';

  console.log('🔍 REQUEST - Content-Type:', contentType);

  if (contentType.includes('multipart/form-data')) {
    // Use multipart parsing for file uploads
    console.log('📤 REQUEST - Using multipart parsing');
    return handleMultipleImageUpload(req, res, next);
  } else {
    // Use JSON parsing for text-only requests
    console.log('📤 REQUEST - Using JSON parsing');
    return next();
  }
};

const router = express.Router();

// Validation rules
const createAnnouncementValidation = [
  body('title')
    .notEmpty()
    .withMessage('Title is required')
    .isLength({ min: 1, max: 255 })
    .withMessage('Title must be between 1 and 255 characters')
    .trim(),
  body('content')
    .notEmpty()
    .withMessage('Content is required')
    .isLength({ min: 1, max: 10000 })
    .withMessage('Content must be between 1 and 10000 characters')
    .trim(),
  body('category_id')
    .notEmpty()
    .withMessage('Category is required')
    .isInt({ min: 1 })
    .withMessage('Category ID must be a positive integer')
    .toInt(),
  body('subcategory_id')
    .optional()
    .custom((value) => {
      if (value === '' || value === null || value === undefined) {
        return true; // Allow empty values
      }
      const parsed = parseInt(value, 10);
      if (isNaN(parsed) || parsed < 1) {
        throw new Error('Subcategory ID must be a positive integer');
      }
      return true;
    })
    .customSanitizer((value) => {
      if (value === '' || value === null || value === undefined) {
        return undefined; // Convert empty to undefined
      }
      return parseInt(value, 10);
    }),
  body('status')
    .optional()
    .isIn(['draft', 'scheduled', 'published', 'archived'])
    .withMessage('Status must be one of: draft, scheduled, published, archived'),
  body('is_pinned')
    .optional()
    .customSanitizer((value) => {
      return value === '1' || value === 'true' || value === true || value === 1;
    }),
  body('is_alert')
    .optional()
    .customSanitizer((value) => {
      return value === '1' || value === 'true' || value === true || value === 1;
    }),
  body('allow_comments')
    .optional()
    .customSanitizer((value) => {
      return value === '1' || value === 'true' || value === true || value === 1;
    }),
  body('allow_sharing')
    .optional()
    .customSanitizer((value) => {
      return value === '1' || value === 'true' || value === true || value === 1;
    }),
  body('scheduled_publish_at')
    .optional()
    .isISO8601()
    .withMessage('Scheduled publish date must be a valid date'),
];

const updateAnnouncementValidation = [
  param('announcementId')
    .isInt({ min: 1 })
    .withMessage('Announcement ID must be a positive integer')
    .toInt(),
  body('title')
    .optional()
    .isLength({ min: 1, max: 255 })
    .withMessage('Title must be between 1 and 255 characters')
    .trim(),
  body('content')
    .optional()
    .isLength({ min: 1, max: 10000 })
    .withMessage('Content must be between 1 and 10000 characters')
    .trim(),
  body('category_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Category ID must be a positive integer')
    .toInt(),
  body('subcategory_id')
    .optional()
    .custom((value) => {
      if (value === '' || value === null || value === undefined) {
        return true; // Allow empty values
      }
      const parsed = parseInt(value, 10);
      if (isNaN(parsed) || parsed < 1) {
        throw new Error('Subcategory ID must be a positive integer');
      }
      return true;
    })
    .customSanitizer((value) => {
      if (value === '' || value === null || value === undefined) {
        return undefined; // Convert empty to undefined
      }
      return parseInt(value, 10);
    }),
  body('status')
    .optional()
    .isIn(['draft', 'scheduled', 'published', 'archived'])
    .withMessage('Status must be one of: draft, scheduled, published, archived'),
  body('is_pinned')
    .optional()
    .customSanitizer((value) => {
      return value === '1' || value === 'true' || value === true || value === 1;
    }),
  body('is_alert')
    .optional()
    .customSanitizer((value) => {
      return value === '1' || value === 'true' || value === true || value === 1;
    }),
  body('allow_comments')
    .optional()
    .customSanitizer((value) => {
      return value === '1' || value === 'true' || value === true || value === 1;
    }),
  body('allow_sharing')
    .optional()
    .customSanitizer((value) => {
      return value === '1' || value === 'true' || value === true || value === 1;
    }),
  body('scheduled_publish_at')
    .optional()
    .isISO8601()
    .withMessage('Scheduled publish date must be a valid date'),
  body('visibility_start_at')
    .optional()
    .isISO8601()
    .withMessage('Visibility start date must be a valid date'),
  body('visibility_end_at')
    .optional()
    .isISO8601()
    .withMessage('Visibility end date must be a valid date'),
];

const announcementIdValidation = [
  param('announcementId')
    .isInt({ min: 1 })
    .withMessage('Announcement ID must be a positive integer')
    .toInt(),
];

const categoryIdValidation = [
  param('categoryId')
    .isInt({ min: 1 })
    .withMessage('Category ID must be a positive integer')
    .toInt(),
];

const getAnnouncementsValidation = [
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
  query('status')
    .optional()
    .isIn(['draft', 'pending', 'scheduled', 'published', 'archived'])
    .withMessage('Status must be one of: draft, pending, scheduled, published, archived'),
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
  query('posted_by')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Posted by must be a positive integer')
    .toInt(),
  query('is_pinned')
    .optional()
    .isBoolean()
    .withMessage('is_pinned must be a boolean')
    .toBoolean(),
  query('is_alert')
    .optional()
    .isBoolean()
    .withMessage('is_alert must be a boolean')
    .toBoolean(),
  query('search')
    .optional()
    .trim(),
  query('start_date')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid date'),
  query('end_date')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid date'),
  query('sort_by')
    .optional()
    .isIn(['created_at', 'updated_at', 'published_at', 'title', 'view_count'])
    .withMessage('Sort by must be one of: created_at, updated_at, published_at, title, view_count'),
  query('sort_order')
    .optional()
    .isIn(['ASC', 'DESC'])
    .withMessage('Sort order must be ASC or DESC'),
];

// Public routes (with optional authentication)
// IMPORTANT: Specific routes must come before parameterized routes
router.get('/categories', AnnouncementController.getCategories);
router.get('/categories/with-subcategories', AnnouncementController.getCategoriesWithSubcategories);
router.get('/categories/:categoryId/subcategories', categoryIdValidation, validateRequest, AnnouncementController.getSubcategoriesByCategory);
router.get('/subcategories', AnnouncementController.getSubcategories);
router.get('/reaction-types', AnnouncementController.getReactionTypes);
router.get('/', optionalAuth, getAnnouncementsValidation, validateRequest, AnnouncementController.getAnnouncements);
router.get('/featured', optionalAuth, AnnouncementController.getFeaturedAnnouncements);

// Protected routes (require authentication)
router.use(authenticate);

// Admin-only routes - Handle both JSON and multipart requests
// Both super_admin and professor can create and manage announcements
router.post('/', adminOnly, requireCreateAnnouncements, handleRequestType, auditContentAction('CREATE', 'announcements'), AnnouncementController.createAnnouncement);
router.put('/:announcementId', adminOnly, requireManageAnnouncements, handleRequestType, auditContentAction('UPDATE', 'announcements'), AnnouncementController.updateAnnouncement);
router.delete('/:announcementId', adminOnly, requireManageAnnouncements, announcementIdValidation, validateRequest, auditContentAction('DELETE', 'announcements'), AnnouncementController.deleteAnnouncement);
router.post('/:announcementId/publish', adminOnly, requireManageAnnouncements, announcementIdValidation, validateRequest, auditContentAction('PUBLISH', 'announcements'), AnnouncementController.publishAnnouncement);
router.post('/:announcementId/unpublish', adminOnly, requireManageAnnouncements, announcementIdValidation, validateRequest, auditContentAction('UNPUBLISH', 'announcements'), AnnouncementController.unpublishAnnouncement);

// Multiple image management routes (admin-only)
router.post('/:announcementId/images', adminOnly, requireManageAnnouncements, handleMultipleImageUpload, announcementIdValidation, validateRequest, auditFileAction('ADD_IMAGES'), AnnouncementController.addAnnouncementImages);
router.get('/:announcementId/images', announcementIdValidation, validateRequest, auditCRUD('announcement_images', { action: 'READ' }), AnnouncementController.getAnnouncementImages);
router.delete('/:announcementId/images/:attachmentId', adminOnly, requireManageAnnouncements, announcementIdValidation, validateRequest, auditFileAction('DELETE_IMAGE'), AnnouncementController.deleteAnnouncementImage);
router.put('/:announcementId/images/order', adminOnly, requireManageAnnouncements, announcementIdValidation, validateRequest, auditContentAction('UPDATE_IMAGE_ORDER', 'announcements'), AnnouncementController.updateImageOrder);
router.put('/:announcementId/images/:attachmentId/primary', adminOnly, announcementIdValidation, validateRequest, auditContentAction('SET_PRIMARY_IMAGE', 'announcements'), AnnouncementController.setPrimaryImage);

// Soft delete management routes
router.post('/:announcementId/restore', adminOnly, announcementIdValidation, validateRequest, auditContentAction('RESTORE', 'announcements'), AnnouncementController.restoreAnnouncement);
router.delete('/:announcementId/permanent', adminOnly, announcementIdValidation, validateRequest, auditContentAction('PERMANENT_DELETE', 'announcements'), AnnouncementController.permanentlyDeleteAnnouncement);

// User interaction routes
router.post('/:announcementId/view', announcementIdValidation, validateRequest, auditContentAction('VIEW', 'announcements'), AnnouncementController.markAsViewed);
router.post('/:announcementId/like', announcementIdValidation, validateRequest, auditContentAction('LIKE', 'announcements'), AnnouncementController.likeAnnouncement);
router.delete('/:announcementId/like', announcementIdValidation, validateRequest, auditContentAction('UNLIKE', 'announcements'), AnnouncementController.unlikeAnnouncement);

// Additional routes
router.get('/:announcementId/reactions', announcementIdValidation, validateRequest, AnnouncementController.getAnnouncementReactionStats);

// Approval workflow routes (admin only)
router.patch('/:announcementId/submit-approval',
  authenticate,
  adminOnly,
  announcementIdValidation,
  validateRequest,
  auditContentAction('SUBMIT_APPROVAL', 'announcements'),
  AnnouncementController.submitForApproval
);

router.patch('/:announcementId/approve',
  authenticate,
  adminOnly,
  announcementIdValidation,
  validateRequest,
  auditContentAction('APPROVE', 'announcements'),
  AnnouncementController.approveAnnouncement
);

router.patch('/:announcementId/reject',
  authenticate,
  adminOnly,
  announcementIdValidation,
  validateRequest,
  auditContentAction('REJECT', 'announcements'),
  AnnouncementController.rejectAnnouncement
);

// IMPORTANT: This parameterized route must be LAST to avoid catching other specific routes
// Get single announcement (moved to end to prevent route conflicts)
router.get('/:announcementId', optionalAuth, announcementIdValidation, validateRequest, AnnouncementController.getAnnouncement);

module.exports = router;
