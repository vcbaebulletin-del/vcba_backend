const express = require('express');
const { body, param, query } = require('express-validator');
const AdminManagementController = require('../controllers/AdminManagementController');
const { authenticate, adminOnly } = require('../middleware/auth');
const { requireManageAdminAccounts, requireManageAdminProfiles } = require('../middleware/permissions');
const { validateRequest, commonValidations } = require('../middleware/validation');
const { handleProfilePictureUpload } = require('../middleware/profileUpload');
const { auditAdminAction, auditCRUD, auditFileAction } = require('../middleware/auditLogger');

const router = express.Router();

// Apply authentication and admin-only middleware to all routes
router.use(authenticate);
router.use(adminOnly);

// Validation schemas
const adminIdValidation = [
  param('adminId')
    .isInt({ min: 1 })
    .withMessage('Admin ID must be a positive integer')
    .toInt(),
];

const createAdminValidation = [
  // TEMPORARY: Accept username format instead of email - REVERT IN FUTURE
  body('email')
    .notEmpty()
    .withMessage('Username is required')
    .trim()
    .toLowerCase()
    .isLength({ min: 3 })
    .withMessage('Username must be at least 3 characters long')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers, and underscores'),
  // Original: .isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number'),
  body('first_name')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('First name must be between 1 and 50 characters'),
  body('last_name')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Last name must be between 1 and 50 characters'),
  body('middle_name')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Middle name must not exceed 50 characters'),
  body('suffix')
    .optional()
    .trim()
    .isLength({ max: 10 })
    .withMessage('Suffix must not exceed 10 characters'),
  body('phone_number')
    .optional()
    .trim()
    .matches(/^(\+63|0)?[0-9]{10}$/)
    .withMessage('Phone number must be a valid Philippine number'),

  body('position')
    .isIn(['super_admin', 'professor'])
    .withMessage('Position must be either super_admin or professor'),
  body('grade_level')
    .if(body('position').equals('professor'))
    .isInt({ min: 11, max: 12 })
    .withMessage('Grade level must be 11 or 12')
    .toInt(),
  body('grade_level')
    .if(body('position').equals('super_admin'))
    .optional({ nullable: true })
    .customSanitizer(() => null),
  body('is_active')
    .optional()
    .isBoolean()
    .withMessage('is_active must be a boolean')
    .toBoolean(),
];

const updateAdminValidation = [
  body('email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('first_name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('First name must be between 1 and 50 characters'),
  body('last_name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Last name must be between 1 and 50 characters'),
  body('middle_name')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Middle name must not exceed 50 characters'),
  body('suffix')
    .optional()
    .trim()
    .isLength({ max: 10 })
    .withMessage('Suffix must not exceed 10 characters'),
  body('phone_number')
    .optional()
    .trim()
    .matches(/^(\+63|0)?[0-9]{10}$/)
    .withMessage('Phone number must be a valid Philippine number'),

  body('position')
    .optional()
    .isIn(['super_admin', 'professor'])
    .withMessage('Position must be either super_admin or professor'),
  body('grade_level')
    .if(body('position').equals('professor'))
    .isInt({ min: 11, max: 12 })
    .withMessage('Grade level must be 11 or 12')
    .toInt(),
  body('grade_level')
    .if(body('position').equals('super_admin'))
    .optional({ nullable: true })
    .customSanitizer(() => null),
  body('grade_level')
    .if(body('position').not().exists())
    .optional({ nullable: true }),
  body('is_active')
    .optional()
    .isBoolean()
    .withMessage('is_active must be a boolean')
    .toBoolean(),
];

const resetPasswordValidation = [
  body('new_password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number'),
];

const getAdminsValidation = [
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
  query('position')
    .optional()
    .isIn(['super_admin', 'professor'])
    .withMessage('Position must be either super_admin or professor'),
  query('is_active')
    .optional()
    .isBoolean()
    .withMessage('is_active must be a boolean')
    .toBoolean(),
  query('status')
    .optional()
    .isIn(['active', 'inactive'])
    .withMessage('Status must be either active or inactive'),
  query('search')
    .optional()
    .trim(),
];

// Admin management routes (super_admin only)
router.get('/admins', requireManageAdminAccounts, getAdminsValidation, validateRequest, auditCRUD('admins', { action: 'READ' }), AdminManagementController.getAdmins);
router.get('/admins/:adminId', requireManageAdminAccounts, adminIdValidation, validateRequest, auditCRUD('admins', { action: 'READ' }), AdminManagementController.getAdmin);
router.post('/admins', requireManageAdminAccounts, createAdminValidation, validateRequest, auditAdminAction('CREATE'), AdminManagementController.createAdmin);
router.put('/admins/:adminId', requireManageAdminAccounts, updateAdminValidation, validateRequest, auditAdminAction('UPDATE'), AdminManagementController.updateAdmin);
router.delete('/admins/:adminId', requireManageAdminAccounts, adminIdValidation, validateRequest, auditAdminAction('DELETE'), AdminManagementController.deleteAdmin);
router.post('/admins/:adminId/reset-password', requireManageAdminAccounts, resetPasswordValidation, validateRequest, AdminManagementController.resetAdminPassword);

// Admin position management (super_admin only)
router.put('/admins/:adminId/position', requireManageAdminAccounts, adminIdValidation,
  body('position').isIn(['super_admin', 'professor']).withMessage('Position must be either super_admin or professor'),
  validateRequest, AdminManagementController.updateAdminPosition);
router.get('/admins/by-position/:position', requireManageAdminAccounts, validateRequest, AdminManagementController.getAdminsByPosition);

// Admin status management (super_admin only)
router.put('/admins/:adminId/activate', requireManageAdminAccounts, adminIdValidation, validateRequest, auditAdminAction('ACTIVATE'), AdminManagementController.activateAdmin);
router.put('/admins/:adminId/deactivate', requireManageAdminAccounts, adminIdValidation, validateRequest, auditAdminAction('DEACTIVATE'), AdminManagementController.deactivateAdmin);

// Admin profile picture management (super_admin only)
router.post('/admins/:adminId/profile-picture', requireManageAdminAccounts, adminIdValidation, validateRequest, handleProfilePictureUpload, auditFileAction('UPLOAD_PROFILE_PICTURE'), AdminManagementController.uploadAdminProfilePicture);
router.delete('/admins/:adminId/profile-picture', requireManageAdminAccounts, adminIdValidation, validateRequest, auditFileAction('REMOVE_PROFILE_PICTURE'), AdminManagementController.removeAdminProfilePicture);

module.exports = router;
