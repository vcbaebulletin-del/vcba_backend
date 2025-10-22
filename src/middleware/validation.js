const { validationResult, body } = require('express-validator');
const { ValidationError } = require('./errorHandler');

// Middleware to handle validation results
const validateRequest = (req, res, next) => {
  console.log('🔍 [VALIDATION DEBUG] validateRequest called');
  console.log('🔍 [VALIDATION DEBUG] Request body:', JSON.stringify(req.body, null, 2));

  const errors = validationResult(req);
  console.log('🔍 [VALIDATION DEBUG] Validation errors:', errors.array());

  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map((error) => ({
      field: error.path || error.param,
      message: error.msg,
      value: error.value,
    }));

    console.log('🔍 [VALIDATION DEBUG] Validation failed with errors:', errorMessages);
    throw new ValidationError('Validation failed', errorMessages);
  }

  console.log('🔍 [VALIDATION DEBUG] Validation passed successfully');
  next();
};

// Custom validation functions
const customValidators = {
  // Check if value is a valid email
  isValidEmail: (value) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
  },

  // Check if value is a valid phone number (numbers only)
  isValidPhone: (value) => {
    const phoneRegex = /^\d{10,11}$/; // Only digits, 10-11 characters
    return phoneRegex.test(value);
  },

  // Check if value is a valid date
  isValidDate: (value) => {
    const date = new Date(value);
    return date instanceof Date && !isNaN(date);
  },

  // Check if value is a valid URL
  isValidUrl: (value) => {
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  },

  // Check if password meets strength requirements
  isStrongPassword: (value) => {
    // At least 8 characters, 1 uppercase, 1 lowercase, 1 number
    const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    return strongPasswordRegex.test(value);
  },

  // Check if value is a valid student number format
  isValidStudentNumber: (value) => {
    // Assuming format: YYYY-NNNN (year-number)
    const studentNumberRegex = /^\d{4}-\d{4}$/;
    return studentNumberRegex.test(value);
  },

  // Check if value is within allowed file types
  isAllowedFileType: (mimetype, allowedTypes = []) => allowedTypes.includes(mimetype),

  // Check if file size is within limit
  isValidFileSize: (size, maxSize = 5 * 1024 * 1024) => // 5MB default
    size <= maxSize,

  // Check if value is a valid enum value
  isValidEnum: (value, allowedValues = []) => allowedValues.includes(value),

  // Check if value is a valid positive integer
  isPositiveInteger: (value) => {
    const num = parseInt(value, 10);
    return Number.isInteger(num) && num > 0;
  },

  // Check if value is within range
  isInRange: (value, min, max) => {
    const num = parseFloat(value);
    return !isNaN(num) && num >= min && num <= max;
  },
};

// Sanitization functions
const sanitizers = {
  // Remove HTML tags
  stripHtml: (value) => value.replace(/<[^>]*>/g, ''),

  // Normalize email
  normalizeEmail: (value) => value.toLowerCase().trim(),

  // Normalize phone number (remove non-digits)
  normalizePhone: (value) => value.replace(/[^0-9]/g, ''),

  // Capitalize first letter of each word
  capitalizeWords: (value) => value.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()),

  // Remove extra whitespace
  trimWhitespace: (value) => value.replace(/\s+/g, ' ').trim(),

  // Escape special characters for SQL
  escapeSql: (value) => value.replace(/[\0\x08\x09\x1a\n\r"'\\\%]/g, (char) => {
    switch (char) {
      case '\0': return '\\0';
      case '\x08': return '\\b';
      case '\x09': return '\\t';
      case '\x1a': return '\\z';
      case '\n': return '\\n';
      case '\r': return '\\r';
      case '"':
      case "'":
      case '\\':
      case '%': return `\\${char}`;
      default: return char;
    }
  }),
};

// Common validation chains
const commonValidations = {
  // TEMPORARY: Email validation modified to accept username format - REVERT IN FUTURE
  email: (fieldName = 'email') => [
    body(fieldName)
      .notEmpty()
      .withMessage(`${fieldName} is required`)
      .trim()
      .isLength({ min: 3 })
      .withMessage(`${fieldName} must be at least 3 characters long`)
      .matches(/^[a-zA-Z0-9_]+$/)
      .withMessage(`${fieldName} can only contain letters, numbers, and underscores`),
    // Original validation (commented for future revert):
    // .isEmail()
    // .withMessage(`${fieldName} must be a valid email address`)
    // .normalizeEmail()
  ],

  password: (fieldName = 'password', minLength = 8) => [
    body(fieldName)
      .isLength({ min: minLength })
      .withMessage(`${fieldName} must be at least ${minLength} characters long`)
      .custom(customValidators.isStrongPassword)
      .withMessage(`${fieldName} must contain at least one uppercase letter, one lowercase letter, and one number`),
  ],

  name: (fieldName, required = true) => {
    const validation = body(fieldName)
      .isLength({ min: 1, max: 50 })
      .withMessage(`${fieldName} must be between 1 and 50 characters`)
      .matches(/^[a-zA-Z\s\-'\.]+$/)
      .withMessage(`${fieldName} can only contain letters, spaces, hyphens, apostrophes, and periods`)
      .customSanitizer(sanitizers.capitalizeWords)
      .trim();

    if (required) {
      validation.notEmpty().withMessage(`${fieldName} is required`);
    } else {
      validation.optional();
    }

    return [validation];
  },

  phone: (fieldName = 'phone', required = false) => {
    const validation = body(fieldName)
      .optional()
      .trim()
      .isLength({ min: 10, max: 11 })
      .withMessage(`${fieldName} must be 10-11 digits long`)
      .matches(/^\d+$/)
      .withMessage(`${fieldName} must contain only numbers`)
      .customSanitizer(sanitizers.normalizePhone);

    if (required) {
      validation.notEmpty().withMessage(`${fieldName} is required`);
    }

    return [validation];
  },

  studentNumber: (fieldName = 'student_number') => [
    body(fieldName)
      .notEmpty()
      .withMessage(`${fieldName} is required`)
      .custom(customValidators.isValidStudentNumber)
      .withMessage(`${fieldName} must be in format YYYY-NNNN`)
      .trim(),
  ],

  id: (fieldName = 'id') => [
    body(fieldName)
      .isInt({ min: 1 })
      .withMessage(`${fieldName} must be a positive integer`)
      .toInt(),
  ],

  date: (fieldName, required = false) => {
    const validation = body(fieldName)
      .custom(customValidators.isValidDate)
      .withMessage(`${fieldName} must be a valid date`)
      .toDate();

    if (required) {
      validation.notEmpty().withMessage(`${fieldName} is required`);
    } else {
      validation.optional();
    }

    return [validation];
  },

  url: (fieldName, required = false) => {
    const validation = body(fieldName)
      .custom(customValidators.isValidUrl)
      .withMessage(`${fieldName} must be a valid URL`);

    if (required) {
      validation.notEmpty().withMessage(`${fieldName} is required`);
    } else {
      validation.optional();
    }

    return [validation];
  },

  enum: (fieldName, allowedValues, required = true) => {
    const validation = body(fieldName)
      .custom((value) => customValidators.isValidEnum(value, allowedValues))
      .withMessage(`${fieldName} must be one of: ${allowedValues.join(', ')}`);

    if (required) {
      validation.notEmpty().withMessage(`${fieldName} is required`);
    } else {
      validation.optional();
    }

    return [validation];
  },
};

module.exports = {
  validateRequest,
  customValidators,
  sanitizers,
  commonValidations,
};
