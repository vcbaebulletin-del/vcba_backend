const multer = require('multer');
const path = require('path');
const fs = require('fs');
const config = require('../config/config');
const { ValidationError } = require('./errorHandler');

// Ensure upload directories exist
const createUploadDirectories = () => {
  const uploadDir = path.join(process.cwd(), 'public', 'uploads');
  const welcomeDir = path.join(uploadDir, 'welcome');
  const carouselDir = path.join(uploadDir, 'carousel');
  
  [uploadDir, welcomeDir, carouselDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
};

// Initialize upload directories
createUploadDirectories();

// Configure multer storage for welcome page images
const welcomeStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(process.cwd(), 'public', 'uploads', 'welcome');
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // Generate unique filename with timestamp and random string
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    const filename = `welcome-${uniqueSuffix}${extension}`;
    cb(null, filename);
  }
});

// Configure multer storage for carousel images
const carouselStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(process.cwd(), 'public', 'uploads', 'carousel');
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // Generate unique filename with timestamp and random string
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    const filename = `carousel-${uniqueSuffix}${extension}`;
    cb(null, filename);
  }
});

// File filter for image validation
const imageFilter = (req, file, cb) => {
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

// Create multer instances
const welcomeUpload = multer({
  storage: welcomeStorage,
  fileFilter: imageFilter,
  limits: {
    fileSize: config.upload.maxSize, // 5MB default
    files: 1 // Only one file at a time for welcome images
  }
});

const carouselUpload = multer({
  storage: carouselStorage,
  fileFilter: imageFilter,
  limits: {
    fileSize: config.upload.maxSize, // 5MB default
    files: 1 // Only one file at a time for carousel images
  }
});

// Welcome page image upload middleware
const handleWelcomeImageUpload = (req, res, next) => {
  console.log('🔍 WELCOME UPLOAD - Processing welcome image upload...');
  
  welcomeUpload.single('image')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      console.error('❌ WELCOME UPLOAD - Multer error:', err);
      
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(new ValidationError('File size too large. Maximum size is 5MB'));
      }
      if (err.code === 'LIMIT_FILE_COUNT') {
        return next(new ValidationError('Too many files. Only one file allowed'));
      }
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return next(new ValidationError('Unexpected field name. Use "image" field'));
      }
      return next(new ValidationError(`Upload error: ${err.message}`));
    }

    if (err) {
      console.error('❌ WELCOME UPLOAD - General error:', err);
      return next(err);
    }

    console.log('✅ WELCOME UPLOAD - Processing completed successfully');
    console.log('🔍 WELCOME UPLOAD - req.file:', req.file ? 'Present' : 'Not present');

    // Add file info to request for further processing
    if (req.file) {
      req.uploadedWelcomeImage = {
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
        path: `/uploads/welcome/${req.file.filename}` // Relative path for database storage
      };
      console.log('✅ WELCOME UPLOAD - File info added to request');
    }

    next();
  });
};

// Carousel image upload middleware
const handleCarouselImageUpload = (req, res, next) => {
  console.log('🔍 CAROUSEL UPLOAD - Processing carousel image upload...');
  
  carouselUpload.single('image')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      console.error('❌ CAROUSEL UPLOAD - Multer error:', err);
      
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(new ValidationError('File size too large. Maximum size is 5MB'));
      }
      if (err.code === 'LIMIT_FILE_COUNT') {
        return next(new ValidationError('Too many files. Only one file allowed'));
      }
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return next(new ValidationError('Unexpected field name. Use "image" field'));
      }
      return next(new ValidationError(`Upload error: ${err.message}`));
    }

    if (err) {
      console.error('❌ CAROUSEL UPLOAD - General error:', err);
      return next(err);
    }

    console.log('✅ CAROUSEL UPLOAD - Processing completed successfully');
    console.log('🔍 CAROUSEL UPLOAD - req.file:', req.file ? 'Present' : 'Not present');

    // Add file info to request for further processing
    if (req.file) {
      req.uploadedCarouselImage = {
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
        path: `/uploads/carousel/${req.file.filename}` // Relative path for database storage
      };
      console.log('✅ CAROUSEL UPLOAD - File info added to request');
    }

    next();
  });
};

// Optional upload middleware (for updates where image is optional)
const handleOptionalWelcomeImageUpload = (req, res, next) => {
  console.log('🔍 OPTIONAL WELCOME UPLOAD - Processing optional welcome image upload...');
  
  welcomeUpload.single('image')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      console.error('❌ OPTIONAL WELCOME UPLOAD - Multer error:', err);
      
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(new ValidationError('File size too large. Maximum size is 5MB'));
      }
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        // For optional uploads, ignore unexpected field errors
        console.log('⚠️ OPTIONAL WELCOME UPLOAD - No image field found, continuing...');
        return next();
      }
      return next(new ValidationError(`Upload error: ${err.message}`));
    }

    if (err) {
      console.error('❌ OPTIONAL WELCOME UPLOAD - General error:', err);
      return next(err);
    }

    console.log('✅ OPTIONAL WELCOME UPLOAD - Processing completed successfully');

    // Add file info to request if file was uploaded
    if (req.file) {
      req.uploadedWelcomeImage = {
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
        path: `/uploads/welcome/${req.file.filename}`
      };
      console.log('✅ OPTIONAL WELCOME UPLOAD - File info added to request');
    } else {
      console.log('ℹ️ OPTIONAL WELCOME UPLOAD - No file uploaded, continuing without image');
    }

    next();
  });
};

// Optional carousel upload middleware
const handleOptionalCarouselImageUpload = (req, res, next) => {
  console.log('🔍 OPTIONAL CAROUSEL UPLOAD - Processing optional carousel image upload...');
  
  carouselUpload.single('image')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      console.error('❌ OPTIONAL CAROUSEL UPLOAD - Multer error:', err);
      
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(new ValidationError('File size too large. Maximum size is 5MB'));
      }
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        // For optional uploads, ignore unexpected field errors
        console.log('⚠️ OPTIONAL CAROUSEL UPLOAD - No image field found, continuing...');
        return next();
      }
      return next(new ValidationError(`Upload error: ${err.message}`));
    }

    if (err) {
      console.error('❌ OPTIONAL CAROUSEL UPLOAD - General error:', err);
      return next(err);
    }

    console.log('✅ OPTIONAL CAROUSEL UPLOAD - Processing completed successfully');

    // Add file info to request if file was uploaded
    if (req.file) {
      req.uploadedCarouselImage = {
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
        path: `/uploads/carousel/${req.file.filename}`
      };
      console.log('✅ OPTIONAL CAROUSEL UPLOAD - File info added to request');
    } else {
      console.log('ℹ️ OPTIONAL CAROUSEL UPLOAD - No file uploaded, continuing without image');
    }

    next();
  });
};

// Helper function to delete uploaded file
const deleteUploadedFile = async (filePath) => {
  try {
    const fullPath = path.join(process.cwd(), 'public', filePath);
    await fs.promises.unlink(fullPath);
    console.log('✅ File deleted successfully:', filePath);
  } catch (error) {
    console.warn('⚠️ Failed to delete file:', filePath, error.message);
  }
};

module.exports = {
  handleWelcomeImageUpload,
  handleCarouselImageUpload,
  handleOptionalWelcomeImageUpload,
  handleOptionalCarouselImageUpload,
  deleteUploadedFile
};
