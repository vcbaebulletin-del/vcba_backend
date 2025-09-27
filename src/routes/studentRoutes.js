const express = require('express');
const { body, param } = require('express-validator');
const StudentController = require('../controllers/StudentController');
const { authenticate, studentOnly, requireOwnership } = require('../middleware/auth');
const { validateRequest, commonValidations } = require('../middleware/validation');
const { auditCRUD, auditAuth } = require('../middleware/auditLogger');

const router = express.Router();

// Apply authentication and student-only middleware to all routes
router.use(authenticate);
router.use(studentOnly);

// Validation rules
const updateProfileValidation = [
  ...commonValidations.name('first_name', false),
  ...commonValidations.name('last_name', false),
  ...commonValidations.name('middle_name', false),
  body('suffix')
    .optional()
    .isLength({ max: 20 })
    .withMessage('Suffix must not exceed 20 characters')
    .trim(),
  ...commonValidations.date('date_of_birth', false),
  ...commonValidations.enum('gender', ['male', 'female', 'other'], false),
  ...commonValidations.phone('phone', false),
  body('address')
    .optional()
    .isLength({ max: 200 })
    .withMessage('Address must not exceed 200 characters')
    .trim(),
  body('city')
    .optional()
    .isLength({ max: 50 })
    .withMessage('City must not exceed 50 characters')
    .trim(),
  body('state')
    .optional()
    .isLength({ max: 50 })
    .withMessage('State must not exceed 50 characters')
    .trim(),
  body('postal_code')
    .optional()
    .isLength({ max: 20 })
    .withMessage('Postal code must not exceed 20 characters')
    .trim(),
  body('country')
    .optional()
    .isLength({ max: 50 })
    .withMessage('Country must not exceed 50 characters')
    .trim(),
  body('emergency_contact_name')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Emergency contact name must not exceed 100 characters')
    .trim(),
  ...commonValidations.phone('emergency_contact_phone', false),
  body('emergency_contact_relationship')
    .optional()
    .isLength({ max: 50 })
    .withMessage('Emergency contact relationship must not exceed 50 characters')
    .trim(),
  ...commonValidations.url('avatar_url', false),
  body('bio')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Bio must not exceed 500 characters')
    .trim(),
];

const changePasswordValidation = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('New password must be at least 6 characters long'),
];

// Student profile routes
router.get('/profile', auditCRUD('student_profiles', { action: 'READ' }), StudentController.getProfile);
router.put('/profile', updateProfileValidation, validateRequest, auditCRUD('student_profiles', { action: 'UPDATE' }), StudentController.updateProfile);

// Password change route
router.post('/change-password', changePasswordValidation, validateRequest, auditAuth('CHANGE_PASSWORD'), StudentController.changePassword);

module.exports = router;
