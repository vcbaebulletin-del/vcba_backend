const express = require('express');
const { body, param, query } = require('express-validator');
const CommentController = require('../controllers/CommentController');
const { authenticate, adminOnly, optionalAuth } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');
const { auditCRUD, auditContentAction } = require('../middleware/auditLogger');

const router = express.Router();

// Validation rules
const createCommentValidation = [
  body('comment_text')
    .notEmpty()
    .withMessage('Comment text is required')
    .isLength({ min: 1, max: 1000 })
    .withMessage('Comment text must be between 1 and 1000 characters')
    .trim(),
  body('announcement_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Announcement ID must be a positive integer')
    .toInt(),
  body('calendar_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Calendar ID must be a positive integer')
    .toInt(),
  body('parent_comment_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Parent comment ID must be a positive integer')
    .toInt(),
  body('is_anonymous')
    .optional()
    .isBoolean()
    .withMessage('is_anonymous must be a boolean')
    .toBoolean(),
  // Custom validation to ensure either announcement_id or calendar_id is provided
  body().custom((value, { req }) => {
    const { announcement_id, calendar_id } = req.body;
    if (!announcement_id && !calendar_id) {
      throw new Error('Either announcement_id or calendar_id is required');
    }
    if (announcement_id && calendar_id) {
      throw new Error('Cannot specify both announcement_id and calendar_id');
    }
    return true;
  }),
];

const updateCommentValidation = [
  param('commentId')
    .isInt({ min: 1 })
    .withMessage('Comment ID must be a positive integer')
    .toInt(),
  body('comment_text')
    .notEmpty()
    .withMessage('Comment text is required')
    .isLength({ min: 1, max: 1000 })
    .withMessage('Comment text must be between 1 and 1000 characters')
    .trim(),
];

const commentIdValidation = [
  param('commentId')
    .isInt({ min: 1 })
    .withMessage('Comment ID must be a positive integer')
    .toInt(),
];

const getCommentsValidation = [
  query('announcement_id')
    .optional({ nullable: true, checkFalsy: true })
    .isInt({ min: 1 })
    .withMessage('Announcement ID must be a positive integer')
    .toInt(),
  query('calendar_id')
    .optional({ nullable: true, checkFalsy: true })
    .isInt({ min: 1 })
    .withMessage('Calendar ID must be a positive integer')
    .toInt(),
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
  query('sort_by')
    .optional()
    .isIn(['created_at', 'updated_at'])
    .withMessage('Sort by must be one of: created_at, updated_at'),
  query('sort_order')
    .optional()
    .isIn(['ASC', 'DESC'])
    .withMessage('Sort order must be ASC or DESC'),
  query('sort')
    .optional()
    .isIn(['newest', 'oldest', 'most_liked'])
    .withMessage('Sort must be one of: newest, oldest, most_liked'),

];

// Public routes (with optional authentication)
router.get('/', optionalAuth, CommentController.getComments);

// Calendar comments route (must come before /:commentId to avoid conflicts)
router.get('/calendar/:calendarId', optionalAuth, CommentController.getCalendarComments);

router.get('/:commentId', optionalAuth, commentIdValidation, validateRequest, CommentController.getComment);

// Protected routes (require authentication)
router.use(authenticate);

// Comment CRUD routes
router.post('/', auditCRUD('comments', { action: 'CREATE' }), CommentController.createComment);
router.post('/calendar/:calendarId', auditCRUD('comments', { action: 'CREATE' }), CommentController.createCalendarComment);
router.put('/:commentId', updateCommentValidation, validateRequest, auditCRUD('comments', { action: 'UPDATE' }), CommentController.updateComment);
router.delete('/:commentId', commentIdValidation, validateRequest, auditCRUD('comments', { action: 'DELETE' }), CommentController.deleteComment);

// Comment interaction routes
router.post('/:commentId/like', commentIdValidation, validateRequest, auditContentAction('LIKE', 'comments'), CommentController.likeComment);
router.delete('/:commentId/like', commentIdValidation, validateRequest, auditContentAction('UNLIKE', 'comments'), CommentController.unlikeComment);
router.post('/:commentId/flag', commentIdValidation, validateRequest, auditContentAction('FLAG', 'comments'), CommentController.flagComment);

// Admin routes
router.get('/admin/flagged', adminOnly, CommentController.getFlaggedComments);
router.post('/:commentId/approve', adminOnly, commentIdValidation, validateRequest, auditContentAction('APPROVE', 'comments'), CommentController.approveComment);
router.post('/:commentId/reject', adminOnly, commentIdValidation, validateRequest, auditContentAction('REJECT', 'comments'), CommentController.rejectComment);

// Additional routes
router.get('/:commentId/reactions', commentIdValidation, validateRequest, CommentController.getCommentReactionStats);

module.exports = router;
