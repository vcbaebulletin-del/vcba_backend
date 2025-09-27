const multer = require('multer');
const path = require('path');
const fs = require('fs');
const config = require('../config/config');
const { ValidationError } = require('./errorHandler');

// Ensure calendar upload directories exist
const createCalendarUploadDirectories = () => {
  const uploadDir = path.join(process.cwd(), 'public', 'uploads');
  const calendarDir = path.join(uploadDir, 'calendar');
  
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  
  if (!fs.existsSync(calendarDir)) {
    fs.mkdirSync(calendarDir, { recursive: true });
  }
};

// Initialize upload directories
createCalendarUploadDirectories();

// Configure multer storage for calendar events
const calendarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(process.cwd(), 'public', 'uploads', 'calendar');
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // Generate unique filename with timestamp and random string
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    const filename = `calendar-${uniqueSuffix}${extension}`;
    cb(null, filename);
  }
});

// Enhanced file filter for calendar images with security checks
const calendarFileFilter = (req, file, cb) => {
  // Check if file is an image
  if (!file.mimetype.startsWith('image/')) {
    return cb(new ValidationError('Only image files are allowed for calendar events'), false);
  }
  
  // Check allowed image types (strict whitelist)
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  if (!allowedTypes.includes(file.mimetype)) {
    return cb(new ValidationError('Invalid image format. Allowed formats: JPEG, PNG, GIF, WebP'), false);
  }

  // Additional security: Check file extension matches MIME type
  const extension = path.extname(file.originalname).toLowerCase();
  const mimeToExt = {
    'image/jpeg': ['.jpg', '.jpeg'],
    'image/png': ['.png'],
    'image/gif': ['.gif'],
    'image/webp': ['.webp']
  };

  const allowedExtensions = mimeToExt[file.mimetype] || [];
  if (!allowedExtensions.includes(extension)) {
    return cb(new ValidationError('File extension does not match MIME type'), false);
  }

  // Check filename for malicious patterns
  const filename = file.originalname;
  const maliciousPatterns = [
    /\.\./,           // Directory traversal
    /[<>:"|?*]/,      // Invalid filename characters
    /\x00/,           // Null bytes
    /\.php$/i,        // PHP files
    /\.js$/i,         // JavaScript files
    /\.html?$/i,      // HTML files
    /\.exe$/i,        // Executable files
  ];

  for (const pattern of maliciousPatterns) {
    if (pattern.test(filename)) {
      return cb(new ValidationError('Invalid filename detected'), false);
    }
  }
  
  cb(null, true);
};

// Configure multer for multiple calendar image upload
const uploadCalendarImages = multer({
  storage: calendarStorage,
  limits: {
    fileSize: config.upload.maxSize, // 5MB per file
    files: 10, // Maximum 10 files per upload
    fieldSize: 50 * 1024 * 1024, // 50MB total field size
    fieldNameSize: 100, // Limit field name size
    fields: 10 // Limit number of fields
  },
  fileFilter: calendarFileFilter
});

// Middleware for multiple calendar image upload
const uploadMultipleCalendarImages = uploadCalendarImages.array('images', 10);

// Enhanced upload middleware with error handling for calendar images
const handleCalendarImageUpload = (req, res, next) => {
  uploadMultipleCalendarImages(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(new ValidationError('One or more files are too large. Maximum size is 5MB per file'));
      }
      if (err.code === 'LIMIT_FILE_COUNT') {
        return next(new ValidationError('Too many files. Maximum 10 images are allowed per calendar event'));
      }
      if (err.code === 'LIMIT_FIELD_VALUE') {
        return next(new ValidationError('Total upload size too large. Maximum 50MB total'));
      }
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return next(new ValidationError('Unexpected field name. Use "images" as field name'));
      }
      if (err.code === 'LIMIT_PART_COUNT') {
        return next(new ValidationError('Too many parts in upload'));
      }
      return next(new ValidationError(`Upload error: ${err.message}`));
    }

    if (err) {
      return next(err);
    }

    // Add files info to request for further processing
    if (req.files && req.files.length > 0) {
      req.uploadedCalendarImages = req.files.map((file, index) => ({
        filename: file.filename,
        originalName: file.originalname,
        size: file.size,
        mimetype: file.mimetype,
        path: `/uploads/calendar/${file.filename}`, // Relative path for database storage
        displayOrder: index // Auto-assign display order
      }));
    }

    next();
  });
};

// Utility function to delete calendar uploaded file
const deleteCalendarUploadedFile = (filename) => {
  try {
    const filePath = path.join(process.cwd(), 'public', 'uploads', 'calendar', filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error deleting calendar file:', error);
    return false;
  }
};

// Utility function to delete multiple calendar uploaded files
const deleteMultipleCalendarFiles = (filenames) => {
  if (!Array.isArray(filenames)) return false;

  let allDeleted = true;
  filenames.forEach(filename => {
    const deleted = deleteCalendarUploadedFile(filename);
    if (!deleted) allDeleted = false;
  });

  return allDeleted;
};

// Utility function to get calendar image URL
const getCalendarImageUrl = (imagePath) => {
  if (!imagePath) return null;
  
  // If already a full URL, return as is
  if (imagePath.startsWith('http')) {
    return imagePath;
  }
  
  // Return relative path (frontend will handle base URL)
  return imagePath.startsWith('/') ? imagePath : `/${imagePath}`;
};

// Utility function to validate image file signature (magic bytes)
const validateImageSignature = (filePath) => {
  try {
    const buffer = fs.readFileSync(filePath);
    const signatures = {
      'image/jpeg': [0xFF, 0xD8, 0xFF],
      'image/png': [0x89, 0x50, 0x4E, 0x47],
      'image/gif': [0x47, 0x49, 0x46],
      'image/webp': [0x52, 0x49, 0x46, 0x46] // RIFF header for WebP
    };

    for (const [mimeType, signature] of Object.entries(signatures)) {
      if (signature.every((byte, index) => buffer[index] === byte)) {
        return mimeType;
      }
    }

    return null;
  } catch (error) {
    console.error('Error validating image signature:', error);
    return null;
  }
};

module.exports = {
  handleCalendarImageUpload,
  deleteCalendarUploadedFile,
  deleteMultipleCalendarFiles,
  getCalendarImageUrl,
  validateImageSignature,
  createCalendarUploadDirectories
};
