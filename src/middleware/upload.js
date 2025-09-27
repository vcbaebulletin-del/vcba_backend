const multer = require('multer');
const path = require('path');
const fs = require('fs');
const config = require('../config/config');
const { ValidationError } = require('./errorHandler');

// Ensure upload directories exist
const createUploadDirectories = () => {
  const uploadDir = path.join(process.cwd(), 'public', 'uploads');
  const newsfeedDir = path.join(uploadDir, 'newsfeed');
  
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  
  if (!fs.existsSync(newsfeedDir)) {
    fs.mkdirSync(newsfeedDir, { recursive: true });
  }
};

// Initialize upload directories
createUploadDirectories();

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(process.cwd(), 'public', 'uploads', 'newsfeed');
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // Generate unique filename with timestamp and random string
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    const filename = `newsfeed-${uniqueSuffix}${extension}`;
    cb(null, filename);
  }
});

// File filter for image validation
const fileFilter = (req, file, cb) => {
  // Check if file is an image
  if (!file.mimetype.startsWith('image/')) {
    return cb(new ValidationError('Only image files are allowed'), false);
  }
  
  // Check allowed image types
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  if (!allowedTypes.includes(file.mimetype)) {
    return cb(new ValidationError('Invalid image format. Allowed formats: JPEG, PNG, GIF, WebP'), false);
  }
  
  cb(null, true);
};

// Configure multer for single image upload
const uploadSingle = multer({
  storage: storage,
  limits: {
    fileSize: config.upload.maxSize, // 5MB default
    files: 1 // Only one file per upload
  },
  fileFilter: fileFilter
});

// Configure multer for multiple image upload
const uploadMultiple = multer({
  storage: storage,
  limits: {
    fileSize: config.upload.maxSize, // 5MB per file
    files: 10, // Maximum 10 files per upload
    fieldSize: 50 * 1024 * 1024 // 50MB total field size
  },
  fileFilter: fileFilter
});

// Middleware for single image upload (backward compatibility)
const uploadSingleImage = uploadSingle.single('image');

// Middleware for multiple image upload - use .any() to parse all fields including text fields
const uploadMultipleImages = uploadMultiple.any();

// Enhanced upload middleware with error handling for single image
const handleImageUpload = (req, res, next) => {
  uploadSingleImage(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(new ValidationError('File size too large. Maximum size is 5MB'));
      }
      if (err.code === 'LIMIT_FILE_COUNT') {
        return next(new ValidationError('Too many files. Only one image is allowed'));
      }
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return next(new ValidationError('Unexpected field name. Use "image" as field name'));
      }
      return next(new ValidationError(`Upload error: ${err.message}`));
    }

    if (err) {
      return next(err);
    }

    // Add file info to request for further processing
    if (req.file) {
      req.uploadedImage = {
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
        path: `/uploads/newsfeed/${req.file.filename}` // Relative path for database storage
      };
    }

    next();
  });
};

// Enhanced upload middleware with error handling for multiple images
const handleMultipleImageUpload = (req, res, next) => {
  console.log('🔍 MULTER - Processing multipart request...');
  console.log('🔍 MULTER - Content-Type:', req.headers['content-type']);

  uploadMultipleImages(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      console.log('❌ MULTER - MulterError:', err.code, err.message);
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(new ValidationError('One or more files are too large. Maximum size is 5MB per file'));
      }
      if (err.code === 'LIMIT_FILE_COUNT') {
        return next(new ValidationError('Too many files. Maximum 10 images are allowed'));
      }
      if (err.code === 'LIMIT_FIELD_VALUE') {
        return next(new ValidationError('Total upload size too large. Maximum 50MB total'));
      }
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return next(new ValidationError('Unexpected field name. Use "images" as field name'));
      }
      return next(new ValidationError(`Upload error: ${err.message}`));
    }

    if (err) {
      console.log('❌ MULTER - General error:', err.message);
      return next(err);
    }

    console.log('✅ MULTER - Parsing completed successfully');
    console.log('🔍 MULTER - req.body keys:', Object.keys(req.body || {}));
    console.log('🔍 MULTER - req.body:', req.body);
    console.log('🔍 MULTER - req.files count:', req.files ? req.files.length : 0);

    // Add files info to request for further processing
    // Filter only image files from the uploaded files (since we use .any())
    if (req.files && req.files.length > 0) {
      const imageFiles = req.files.filter(file => file.fieldname === 'images');
      if (imageFiles.length > 0) {
        req.uploadedImages = imageFiles.map(file => ({
          filename: file.filename,
          originalName: file.originalname,
          size: file.size,
          mimetype: file.mimetype,
          path: `/uploads/newsfeed/${file.filename}` // Relative path for database storage
        }));
      }
    }

    next();
  });
};

// Utility function to delete uploaded file
const deleteUploadedFile = (filename) => {
  try {
    const filePath = path.join(process.cwd(), 'public', 'uploads', 'newsfeed', filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error deleting file:', error);
    return false;
  }
};

// Utility function to get full file path
const getImageUrl = (imagePath) => {
  if (!imagePath) return null;
  
  // If already a full URL, return as is
  if (imagePath.startsWith('http')) {
    return imagePath;
  }
  
  // Return relative path (frontend will handle base URL)
  return imagePath.startsWith('/') ? imagePath : `/${imagePath}`;
};

// Utility function to delete multiple uploaded files
const deleteMultipleUploadedFiles = (filenames) => {
  if (!Array.isArray(filenames)) return false;

  let allDeleted = true;
  filenames.forEach(filename => {
    const deleted = deleteUploadedFile(filename);
    if (!deleted) allDeleted = false;
  });

  return allDeleted;
};

module.exports = {
  handleImageUpload,
  handleMultipleImageUpload,
  deleteUploadedFile,
  deleteMultipleUploadedFiles,
  getImageUrl,
  createUploadDirectories
};
