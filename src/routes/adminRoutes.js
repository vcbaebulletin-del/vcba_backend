const express = require('express');
const { body, param, query } = require('express-validator');
const AdminController = require('../controllers/AdminController');
const { authenticate, adminOnly } = require('../middleware/auth');
const {
  requireManageAdminAccounts,
  requireManageAdminProfiles,
  requireManageStudents,
  requireViewStudents,
  requireManageSystemSettings
} = require('../middleware/permissions');
const { validateRequest, commonValidations } = require('../middleware/validation');
const { handleProfilePictureUpload } = require('../middleware/profileUpload');
const { auditCRUD, auditFileAction, auditAuth, auditStudentAction } = require('../middleware/auditLogger');

const router = express.Router();

// Apply authentication and admin-only middleware to all routes
router.use(authenticate);
router.use(adminOnly);

// Validation rules
const updateProfileValidation = [
  ...commonValidations.name('first_name', false),
  ...commonValidations.name('middle_name', false),
  ...commonValidations.name('last_name', false),
  body('suffix')
    .optional()
    .isLength({ max: 20 })
    .withMessage('Suffix must not exceed 20 characters')
    .trim(),
  ...commonValidations.phone('phone', false),
  body('department')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Department must not exceed 100 characters')
    .trim(),
  body('position')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Position must not exceed 100 characters')
    .trim(),
  body('bio')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Bio must not exceed 500 characters')
    .trim(),
  ...commonValidations.url('avatar_url', false),
];

const createStudentValidation = [
  // Account validation
  ...commonValidations.email('email'),
  // Custom password validation for students (allows default password)
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .custom((value) => {
      // Allow the default password 'Student123' for students
      if (value === 'Student123') {
        return true;
      }
      // Otherwise, require strong password
      const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
      return strongPasswordRegex.test(value);
    })
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number, or use the default password'),
  body('student_number')
    .notEmpty()
    .withMessage('Student number is required')
    .trim(),
  body('is_active')
    .optional()
    .isBoolean()
    .withMessage('is_active must be a boolean')
    .toBoolean(),

  // Profile validation - Name fields
  body('first_name')
    .notEmpty()
    .withMessage('First name is required')
    .isLength({ max: 100 })
    .withMessage('First name must not exceed 100 characters')
    .trim(),
  body('middle_name')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Middle name must not exceed 100 characters')
    .trim(),
  body('last_name')
    .notEmpty()
    .withMessage('Last name is required')
    .isLength({ max: 100 })
    .withMessage('Last name must not exceed 100 characters')
    .trim(),
  body('suffix')
    .optional()
    .isLength({ max: 20 })
    .withMessage('Suffix must not exceed 20 characters')
    .trim(),
  body('phone_number')
    .notEmpty()
    .withMessage('Phone number is required')
    .isLength({ min: 10, max: 11 })
    .withMessage('Phone number must be 10-11 digits long')
    .matches(/^\d+$/)
    .withMessage('Phone number must contain only numbers')
    .trim(),
  body('grade_level')
    .notEmpty()
    .withMessage('Grade level is required')
    .isInt({ min: 7, max: 12 })
    .withMessage('Grade level must be between 7 and 12')
    .toInt(),
  body('parent_guardian_name')
    .optional()
    .isLength({ max: 255 })
    .withMessage('Parent/Guardian name must not exceed 255 characters')
    .trim(),
  body('parent_guardian_phone')
    .optional()
    .isLength({ max: 20 })
    .withMessage('Parent/Guardian phone must not exceed 20 characters')
    .trim(),
  body('address')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Address must not exceed 1000 characters')
    .trim(),
  body('profile_picture')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Profile picture URL must not exceed 500 characters')
    .trim(),
];

const updateStudentValidation = [
  param('studentId')
    .isInt({ min: 1 })
    .withMessage('Student ID must be a positive integer')
    .toInt(),

  // Account validation (all optional for updates)
  body('email')
    .optional()
    .isEmail()
    .withMessage('Email must be a valid email address')
    .normalizeEmail(),
  body('student_number')
    .optional()
    .trim(),
  body('is_active')
    .optional()
    .isBoolean()
    .withMessage('is_active must be a boolean')
    .toBoolean(),

  // Profile validation (all optional for updates)
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
  body('program')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Program must not exceed 100 characters')
    .trim(),
  body('year_level')
    .optional()
    .isInt({ min: 1, max: 10 })
    .withMessage('Year level must be between 1 and 10')
    .toInt(),
  ...commonValidations.date('graduation_date', false),
  body('gpa')
    .optional()
    .isFloat({ min: 0, max: 4 })
    .withMessage('GPA must be between 0 and 4')
    .toFloat(),
  ...commonValidations.enum('status', ['active', 'inactive', 'graduated', 'suspended', 'transferred'], false),
  body('bio')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Bio must not exceed 500 characters')
    .trim(),
];

const studentIdValidation = [
  param('studentId')
    .isInt({ min: 1 })
    .withMessage('Student ID must be a positive integer')
    .toInt(),
];

const resetPasswordValidation = [
  param('studentId')
    .isInt({ min: 1 })
    .withMessage('Student ID must be a positive integer')
    .toInt(),
  ...commonValidations.password('newPassword'),
];

const changePasswordValidation = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('New password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('New password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&)'),
];

const getStudentsValidation = [
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
  query('program')
    .optional()
    .trim(),
  query('year_level')
    .optional()
    .isInt({ min: 1, max: 10 })
    .withMessage('Year level must be between 1 and 10')
    .toInt(),
  query('grade_level')
    .optional()
    .isInt({ min: 11, max: 12 })
    .withMessage('Grade level must be 11 or 12')
    .toInt(),
  query('section')
    .optional()
    .trim(),
  query('status')
    .optional()
    .isIn(['active', 'inactive', 'graduated', 'suspended', 'transferred'])
    .withMessage('Status must be one of: active, inactive, graduated, suspended, transferred'),
  query('is_active')
    .optional()
    .isBoolean()
    .withMessage('is_active must be a boolean')
    .toBoolean(),
  query('search')
    .optional()
    .trim(),
];

// Admin profile routes
router.get('/profile', auditCRUD('admin_profiles', { action: 'READ' }), AdminController.getProfile);
router.put('/profile', updateProfileValidation, validateRequest, auditCRUD('admin_profiles', { action: 'UPDATE' }), AdminController.updateProfile);

// Profile picture routes
router.post('/profile/picture', handleProfilePictureUpload, auditFileAction('UPLOAD_PROFILE_PICTURE'), AdminController.uploadProfilePicture);
router.post('/profile/picture/remove', (req, res, next) => {
  console.log('🔍 REMOVE ROUTE - Profile picture remove route hit!');
  console.log('🔍 REMOVE ROUTE - Request method:', req.method);
  console.log('🔍 REMOVE ROUTE - Request path:', req.path);
  next();
}, auditFileAction('REMOVE_PROFILE_PICTURE'), AdminController.removeProfilePicture);

// Password management routes
router.post('/change-password', changePasswordValidation, validateRequest, auditAuth('CHANGE_PASSWORD'), AdminController.changePassword);

// Dashboard routes
router.get('/dashboard/stats', AdminController.getDashboardStats);

// Student management routes
// View students - both super_admin and professor can view (read-only for professor)
router.get('/students', requireViewStudents, getStudentsValidation, validateRequest, auditCRUD('students', { action: 'READ' }), AdminController.getStudents);
router.get('/students/:studentId', requireViewStudents, studentIdValidation, validateRequest, auditCRUD('students', { action: 'READ' }), AdminController.getStudent);

// Manage students - only super_admin can create, update, delete
router.post('/students', requireManageStudents, createStudentValidation, validateRequest, auditStudentAction('CREATE'), AdminController.createStudent);
router.put('/students/:studentId', requireManageStudents, updateStudentValidation, validateRequest, auditStudentAction('UPDATE'), AdminController.updateStudent);
router.delete('/students/:studentId', requireManageStudents, studentIdValidation, validateRequest, auditStudentAction('DELETE'), AdminController.deleteStudent);
router.post('/students/:studentId/reset-password', requireManageStudents, resetPasswordValidation, validateRequest, auditStudentAction('RESET_PASSWORD'), AdminController.resetStudentPassword);

// Student profile picture routes - only super_admin can manage
router.post('/students/:studentId/profile/picture', requireManageStudents, studentIdValidation, validateRequest, handleProfilePictureUpload, AdminController.uploadStudentProfilePicture);
router.post('/students/:studentId/profile/picture/remove', requireManageStudents, studentIdValidation, validateRequest, AdminController.removeStudentProfilePicture);

module.exports = router;
// Force restart
