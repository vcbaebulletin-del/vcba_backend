const express = require('express');
const { body } = require('express-validator');
const AuthController = require('../controllers/AuthController');
const { authenticate } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');
const { auditAuth } = require('../middleware/auditLogger');

const router = express.Router();

// Validation rules
// TEMPORARY: Email field now accepts username format - REVERT IN FUTURE
const loginValidation = [
  body('email')
    .notEmpty()
    .withMessage('Username or student number is required')
    .trim(),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 1 })
    .withMessage('Password cannot be empty'),
  body('userType')
    .optional()
    .isIn(['admin', 'student'])
    .withMessage('User type must be either admin or student'),
];

const changePasswordValidation = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('New password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('New password must contain at least one lowercase letter, one uppercase letter, and one number'),
  body('confirmPassword')
    .notEmpty()
    .withMessage('Password confirmation is required'),
];

const validateTokenValidation = [
  body('token')
    .notEmpty()
    .withMessage('Token is required'),
];

const adminRegisterValidation = [
  // TEMPORARY: Accept username format instead of email - REVERT IN FUTURE
  body('email')
    .notEmpty()
    .withMessage('Username is required')
    .trim()
    .isLength({ min: 3 })
    .withMessage('Username must be at least 3 characters long')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers, and underscores'),
  // Original validation (commented for future revert):
  // .isEmail()
  // .withMessage('Email must be a valid email address')
  // .normalizeEmail(),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  body('firstName')
    .notEmpty()
    .withMessage('First name is required')
    .isLength({ max: 50 })
    .withMessage('First name must not exceed 50 characters')
    .trim(),
  body('lastName')
    .notEmpty()
    .withMessage('Last name is required')
    .isLength({ max: 50 })
    .withMessage('Last name must not exceed 50 characters')
    .trim(),
  body('middleName')
    .optional()
    .isLength({ max: 50 })
    .withMessage('Middle name must not exceed 50 characters')
    .trim(),
  body('suffix')
    .optional()
    .isLength({ max: 20 })
    .withMessage('Suffix must not exceed 20 characters')
    .trim(),
  body('phoneNumber')
    .optional()
    .trim()
    .isLength({ min: 10, max: 11 })
    .withMessage('Phone number must be 10-11 digits long')
    .matches(/^\d+$/)
    .withMessage('Phone number must contain only numbers'),
  body('department')
    .notEmpty()
    .withMessage('Department is required')
    .isLength({ max: 100 })
    .withMessage('Department must not exceed 100 characters')
    .trim(),
  body('position')
    .notEmpty()
    .withMessage('Position is required')
    .isLength({ max: 100 })
    .withMessage('Position must not exceed 100 characters')
    .trim(),
  body('gradeLevel')
    .optional({ nullable: true, checkFalsy: true })
    .custom((value) => {
      if (value === undefined || value === null || value === '') {
        return true; // Allow empty values for system admins
      }
      const intValue = parseInt(value);
      if (isNaN(intValue) || intValue < 11 || intValue > 12) {
        throw new Error('Grade level must be between 11 and 12');
      }
      return true;
    })
    .customSanitizer((value) => {
      if (value === undefined || value === null || value === '') {
        return undefined; // Convert empty values to undefined
      }
      return parseInt(value);
    }),
];

const verifyOtpValidation = [
  body('email')
    .isEmail()
    .withMessage('Email must be a valid email address')
    .normalizeEmail(),
  body('otp')
    .notEmpty()
    .withMessage('OTP is required')
    .isLength({ min: 6, max: 6 })
    .withMessage('OTP must be 6 digits')
    .isNumeric()
    .withMessage('OTP must contain only numbers'),
];

const resendOtpValidation = [
  body('email')
    .isEmail()
    .withMessage('Email must be a valid email address')
    .normalizeEmail(),
];

// Public routes
router.post('/login', loginValidation, validateRequest, auditAuth('LOGIN'), AuthController.login);
router.post('/refresh', auditAuth('TOKEN_REFRESH'), AuthController.refreshToken);
router.post('/validate-token', validateTokenValidation, validateRequest, auditAuth('TOKEN_VALIDATION'), AuthController.validateToken);

// Admin registration routes
router.post('/admin/register', adminRegisterValidation, validateRequest, auditAuth('ADMIN_REGISTER'), AuthController.adminRegister);
router.post('/admin/verify-otp', verifyOtpValidation, validateRequest, auditAuth('ADMIN_VERIFY_OTP'), AuthController.verifyAdminOtp);
router.post('/admin/resend-otp', resendOtpValidation, validateRequest, auditAuth('ADMIN_RESEND_OTP'), AuthController.resendAdminOtp);

// Protected routes
router.use(authenticate); // All routes below require authentication

router.get('/me', AuthController.getProfile);
router.get('/check', AuthController.checkAuth);
router.post('/logout', auditAuth('LOGOUT'), AuthController.logout);
router.post('/logout-all', auditAuth('LOGOUT_ALL'), AuthController.logoutAll);
router.post('/change-password', changePasswordValidation, validateRequest, auditAuth('CHANGE_PASSWORD'), AuthController.changePassword);

module.exports = router;
