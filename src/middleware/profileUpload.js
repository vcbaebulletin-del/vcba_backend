const multer = require('multer');
const path = require('path');
const fs = require('fs');
const config = require('../config/config');
const { ValidationError } = require('./errorHandler');

// Ensure profile upload directories exist
const createProfileUploadDirectories = () => {
  const uploadDir = path.join(process.cwd(), 'public', 'uploads');
  const profileDir = path.join(uploadDir, 'profiles');
  
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  
  if (!fs.existsSync(profileDir)) {
    fs.mkdirSync(profileDir, { recursive: true });
  }
};

// Initialize upload directories
createProfileUploadDirectories();

// Configure multer storage for profile pictures
const profileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(process.cwd(), 'public', 'uploads', 'profiles');
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // Generate unique filename with timestamp and random number only
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    const filename = `profile-${uniqueSuffix}${extension}`;
    cb(null, filename);
  }
});

// File filter for profile picture validation
const profileFileFilter = (req, file, cb) => {
  // Check if file is an image
  if (!file.mimetype.startsWith('image/')) {
    return cb(new ValidationError('Only image files are allowed for profile pictures'), false);
  }
  
  // Check allowed image types for profile pictures
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(file.mimetype)) {
    return cb(new ValidationError('Invalid image format. Allowed formats: JPEG, PNG, WebP'), false);
  }
  
  cb(null, true);
};

// Configure multer for profile picture upload
const uploadProfilePicture = multer({
  storage: profileStorage,
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB limit for profile pictures
    files: 1 // Only one file per upload
  },
  fileFilter: profileFileFilter
});

// Middleware for single profile picture upload
const uploadSingleProfilePicture = uploadProfilePicture.single('profilePicture');

// Enhanced upload middleware with error handling for profile pictures
const handleProfilePictureUpload = (req, res, next) => {
  console.log('🔍 PROFILE UPLOAD - Processing profile picture upload...');
  
  uploadSingleProfilePicture(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      console.log('❌ PROFILE UPLOAD - MulterError:', err.code, err.message);
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(new ValidationError('Profile picture file size too large. Maximum size is 2MB'));
      }
      if (err.code === 'LIMIT_FILE_COUNT') {
        return next(new ValidationError('Only one profile picture is allowed'));
      }
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return next(new ValidationError('Unexpected field name. Use "profilePicture" as field name'));
      }
      return next(new ValidationError(`Profile picture upload error: ${err.message}`));
    }

    if (err) {
      console.log('❌ PROFILE UPLOAD - General error:', err.message);
      return next(err);
    }

    console.log('✅ PROFILE UPLOAD - Upload completed successfully');
    console.log('🔍 PROFILE UPLOAD - File info:', req.file ? {
      filename: req.file.filename,
      size: req.file.size,
      mimetype: req.file.mimetype
    } : 'No file uploaded');

    // Add file info to request for further processing
    if (req.file) {
      req.uploadedProfilePicture = {
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
        path: `/uploads/profiles/${req.file.filename}` // Relative path for database storage
      };
    }

    next();
  });
};

// Helper function to delete old profile picture file
const deleteProfilePictureFile = (profilePicturePath) => {
  if (!profilePicturePath) return;
  
  try {
    // Extract filename from path (remove /uploads/profiles/ prefix)
    const filename = profilePicturePath.replace('/uploads/profiles/', '');
    const fullPath = path.join(process.cwd(), 'public', 'uploads', 'profiles', filename);
    
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
      console.log('✅ PROFILE UPLOAD - Old profile picture deleted:', filename);
    }
  } catch (error) {
    console.error('❌ PROFILE UPLOAD - Error deleting old profile picture:', error.message);
    // Don't throw error, just log it as this is cleanup
  }
};

module.exports = {
  handleProfilePictureUpload,
  deleteProfilePictureFile,
  createProfileUploadDirectories
};
