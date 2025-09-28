const { asyncHandler, ValidationError, NotFoundError } = require('../middleware/errorHandler');
const AnnouncementModel = require('../models/AnnouncementModel');
const AnnouncementAttachmentModel = require('../models/AnnouncementAttachmentModel');
const ReactionModel = require('../models/ReactionModel');
const StudentModel = require('../models/StudentModel');
const SMSNotificationModel = require('../models/SMSNotificationModel');
const notificationService = require('../services/notificationService');
const smsService = require('../services/smsService');
const websocketService = require('../services/websocketService');
const { deleteUploadedFile, deleteMultipleUploadedFiles, getImageUrl } = require('../middleware/upload');

// Helper function to safely parse integers
const safeParseInt = (value, defaultValue = 0) => {
  const parsed = parseInt(value);
  return isNaN(parsed) ? defaultValue : parsed;
};

class AnnouncementController {
  constructor() {
    this.announcementModel = AnnouncementModel; // Use the already instantiated model
    this.attachmentModel = new AnnouncementAttachmentModel(); // This one exports the class
    this.reactionModel = ReactionModel; // Use the already instantiated model
    this.studentModel = StudentModel; // Use the already instantiated model
    this.smsNotificationModel = new SMSNotificationModel(); // This one exports the class
  }

  // Get all announcements
  getAnnouncements = asyncHandler(async (req, res) => {
    const {
      page = 1,
      limit = 20,
      status,
      category_id,
      subcategory_id,
      posted_by,
      is_pinned,
      is_alert,
      search,
      start_date,
      end_date,
      sort_by = 'created_at',
      sort_order = 'DESC'
    } = req.query;

    const filters = {
      status,
      category_id: category_id ? safeParseInt(category_id) : undefined,
      subcategory_id: subcategory_id ? safeParseInt(subcategory_id) : undefined,
      posted_by: posted_by ? safeParseInt(posted_by) : undefined,
      is_pinned: is_pinned !== undefined ? safeParseInt(is_pinned) : undefined,
      is_alert: is_alert !== undefined ? safeParseInt(is_alert) : undefined,
      search,
      start_date,
      end_date
    };

    // Add grade level filtering only if explicitly requested via query parameter
    // This allows both admin and student newsfeeds to show all announcements by default
    // while still supporting grade-level filtering through the frontend filter dropdowns
    if (req.query.grade_level !== undefined) {
      const gradeLevel = safeParseInt(req.query.grade_level);
      filters.grade_level = gradeLevel === 0 ? null : gradeLevel; // 0 means "all grades" (null)
    }

    const pagination = {
      page: safeParseInt(page, 1),
      limit: safeParseInt(limit, 10),
      sort_by,
      sort_order
    };

    // Pass user info for filtering and reaction checks
    const options = {
      userType: req.user?.role || 'public',
      userId: req.user?.id || 0
    };

    const result = await AnnouncementModel.getAnnouncements(filters, pagination, options);

    res.status(200).json({
      success: true,
      message: 'Announcements retrieved successfully',
      data: result,
    });

    console.log('✅ AnnouncementController.getAnnouncements - END');
  });

  // Get featured announcements
  getFeaturedAnnouncements = asyncHandler(async (req, res) => {
    const { limit = 5 } = req.query;
    const announcements = await AnnouncementModel.getFeaturedAnnouncements(safeParseInt(limit, 5));

    res.status(200).json({
      success: true,
      message: 'Featured announcements retrieved successfully',
      data: { announcements },
    });
  });

  // Get single announcement
  getAnnouncement = asyncHandler(async (req, res) => {
    const { announcementId } = req.params;
    const userId = req.user?.id;
    const userType = req.user?.role;

    const parsedAnnouncementId = safeParseInt(announcementId);
    if (parsedAnnouncementId === 0) {
      throw new ValidationError('Invalid announcement ID');
    }

    const announcement = await AnnouncementModel.getAnnouncementById(
      parsedAnnouncementId,
      userId,
      userType
    );

    res.status(200).json({
      success: true,
      message: 'Announcement retrieved successfully',
      data: { announcement },
    });
  });

  // Create announcement (admin only)
  createAnnouncement = asyncHandler(async (req, res) => {
    // Debug: Log the received request body
    console.log('🔍 CREATE - Request body:', req.body);
    console.log('🔍 CREATE - Request body keys:', Object.keys(req.body || {}));
    console.log('🔍 CREATE - Files:', req.files ? req.files.length : 0);
    console.log('🔍 CREATE - Content-Type:', req.headers['content-type']);

    // Check if req.body is empty (multipart parsing issue)
    if (!req.body || Object.keys(req.body).length === 0) {
      console.error('❌ CREATE - req.body is empty! Multipart parsing failed.');
      throw new ValidationError('Request body is empty. Please check multipart form data.');
    }

    // Extract and validate required fields
    const title = req.body.title?.trim();
    const content = req.body.content?.trim();
    const category_id = parseInt(req.body.category_id);

    console.log('🔍 CREATE - Extracted fields:', { title, content, category_id });

    // Validate required fields
    if (!title) {
      throw new ValidationError('Title is required');
    }
    if (!content) {
      throw new ValidationError('Content is required');
    }
    if (!category_id || isNaN(category_id) || category_id < 1) {
      throw new ValidationError('Valid category is required');
    }

    // Debug logging for boolean fields (can be removed in production)
    console.log('🔍 Boolean values received:', {
      is_pinned: req.body.is_pinned,
      is_alert: req.body.is_alert,
      allow_comments: req.body.allow_comments,
      allow_sharing: req.body.allow_sharing
    });

    // Extract optional fields with proper defaults
    const subcategory_id = req.body.subcategory_id && req.body.subcategory_id !== '' ? parseInt(req.body.subcategory_id) : null;
    const grade_level = req.body.grade_level ? parseInt(req.body.grade_level) : null;

    // Set status based on user position: professors get 'pending', super admins get 'draft' (or specified status)
    let status;
    if (req.user.position === 'Professor') {
      status = 'pending'; // Professors automatically submit for approval
    } else {
      status = req.body.status || 'draft'; // Super admins can set any status
    }
    const is_pinned = req.body.is_pinned !== undefined ?
      (req.body.is_pinned === '1' || req.body.is_pinned === 'true' || req.body.is_pinned === true) : false;
    const is_alert = req.body.is_alert !== undefined ?
      (req.body.is_alert === '1' || req.body.is_alert === 'true' || req.body.is_alert === true) : false;
    const allow_comments = req.body.allow_comments !== undefined ?
      (req.body.allow_comments === '1' || req.body.allow_comments === 'true' || req.body.allow_comments === true) : true;
    const allow_sharing = req.body.allow_sharing !== undefined ?
      (req.body.allow_sharing === '1' || req.body.allow_sharing === 'true' || req.body.allow_sharing === true) : true;

    console.log('🔍 Processed boolean values:', {
      is_pinned,
      is_alert,
      allow_comments,
      allow_sharing
    });
    const scheduled_publish_at = (status === 'scheduled' && req.body.scheduled_publish_at) ? req.body.scheduled_publish_at : null;

    // Determine grade level for the announcement
    let announcementGradeLevel = null;

    // If admin has a specific grade level assigned, use it for the announcement
    if (req.user.grade_level) {
      announcementGradeLevel = req.user.grade_level;
    } else if (grade_level) {
      // System admins can specify grade level manually
      const parsedGradeLevel = parseInt(grade_level);
      announcementGradeLevel = isNaN(parsedGradeLevel) ? null : parsedGradeLevel;
    }
    // If neither, announcement will be for all grades (null)

    const announcementData = {
      title,
      content,
      category_id,
      subcategory_id,
      posted_by: req.user.id,
      grade_level: announcementGradeLevel,
      status,
      is_pinned,
      is_alert,
      allow_comments,
      allow_sharing,
      scheduled_publish_at,
      visibility_start_at: req.body.visibility_start_at || null,
      visibility_end_at: req.body.visibility_end_at || null
    };

    // Handle backward compatibility - single image upload
    if (req.uploadedImage) {
      announcementData.image_path = req.uploadedImage.path;
    }

    try {
      const announcement = await this.announcementModel.createAnnouncement(announcementData);

      // Handle multiple image uploads if present
      let attachments = [];
      if (req.uploadedImages && req.uploadedImages.length > 0) {
        try {
          attachments = await this.attachmentModel.createAttachments(
            announcement.announcement_id,
            req.uploadedImages
          );
        } catch (attachmentError) {
          // If attachment creation fails, we should still return the announcement
          // but log the error for monitoring
          console.error('Error creating attachments:', attachmentError);
        }
      }

      // Get all images for response (including both single and multiple uploads)
      const allImages = await this.attachmentModel.getAttachmentsByAnnouncementId(
        announcement.announcement_id,
        'image'
      );

      res.status(201).json({
        success: true,
        message: 'Announcement created successfully',
        data: {
          announcement: {
            ...announcement,
            image_url: getImageUrl(announcement.image_path),
            images: allImages.map(img => ({
              ...img,
              file_url: getImageUrl(img.file_path)
            }))
          }
        },
      });
    } catch (error) {
      // Clean up uploaded files if announcement creation fails
      if (req.uploadedImage) {
        deleteUploadedFile(req.uploadedImage.filename);
      }
      if (req.uploadedImages && req.uploadedImages.length > 0) {
        const filenames = req.uploadedImages.map(img => img.filename);
        deleteMultipleUploadedFiles(filenames);
      }
      throw error;
    }
  });

  // Update announcement (admin only)
  updateAnnouncement = asyncHandler(async (req, res) => {
    const { announcementId } = req.params;

    // Debug: Log the received request body
    console.log('🔍 UPDATE - Request body:', req.body);
    console.log('🔍 UPDATE - Files:', req.files ? req.files.length : 0);
    console.log('🔍 UPDATE - Announcement ID:', announcementId);

    // Process the update data to ensure proper formatting
    const updateData = {};

    // Handle each field with proper validation
    if (req.body.title !== undefined) {
      const title = req.body.title?.trim();
      if (title) updateData.title = title;
    }

    if (req.body.content !== undefined) {
      const content = req.body.content?.trim();
      if (content) updateData.content = content;
    }

    if (req.body.category_id !== undefined) {
      const categoryId = parseInt(req.body.category_id);
      if (!isNaN(categoryId) && categoryId > 0) {
        updateData.category_id = categoryId;
      }
    }

    if (req.body.subcategory_id !== undefined) {
      if (req.body.subcategory_id === '' || req.body.subcategory_id === null) {
        updateData.subcategory_id = null;
      } else {
        const subcategoryId = parseInt(req.body.subcategory_id);
        if (!isNaN(subcategoryId) && subcategoryId > 0) {
          updateData.subcategory_id = subcategoryId;
        }
      }
    }

    if (req.body.status !== undefined) {
      updateData.status = req.body.status;
    }

    // Debug logging for boolean fields in update
    console.log('🔍 Update boolean values received:', {
      is_pinned: req.body.is_pinned,
      is_alert: req.body.is_alert,
      allow_comments: req.body.allow_comments,
      allow_sharing: req.body.allow_sharing
    });

    // Handle boolean fields
    ['is_pinned', 'is_alert', 'allow_comments', 'allow_sharing'].forEach(field => {
      if (req.body[field] !== undefined) {
        updateData[field] = (req.body[field] === '1' || req.body[field] === 'true' || req.body[field] === true);
      }
    });

    console.log('🔍 Update processed boolean values:', {
      is_pinned: updateData.is_pinned,
      is_alert: updateData.is_alert,
      allow_comments: updateData.allow_comments,
      allow_sharing: updateData.allow_sharing
    });

    if (req.body.scheduled_publish_at !== undefined) {
      if (req.body.scheduled_publish_at === '' || req.body.status !== 'scheduled') {
        updateData.scheduled_publish_at = null;
      } else {
        updateData.scheduled_publish_at = req.body.scheduled_publish_at;
      }
    }

    // Handle visibility date fields with debug logging
    if (req.body.visibility_start_at !== undefined) {
      console.log('🔍 UPDATE - visibility_start_at received:', req.body.visibility_start_at, typeof req.body.visibility_start_at);
      if (req.body.visibility_start_at === '' || req.body.visibility_start_at === null) {
        updateData.visibility_start_at = null;
        console.log('🔍 UPDATE - visibility_start_at set to null');
      } else {
        updateData.visibility_start_at = req.body.visibility_start_at;
        console.log('🔍 UPDATE - visibility_start_at set to:', updateData.visibility_start_at);
      }
    }

    if (req.body.visibility_end_at !== undefined) {
      console.log('🔍 UPDATE - visibility_end_at received:', req.body.visibility_end_at, typeof req.body.visibility_end_at);
      if (req.body.visibility_end_at === '' || req.body.visibility_end_at === null) {
        updateData.visibility_end_at = null;
        console.log('🔍 UPDATE - visibility_end_at set to null');
      } else {
        updateData.visibility_end_at = req.body.visibility_end_at;
        console.log('🔍 UPDATE - visibility_end_at set to:', updateData.visibility_end_at);
      }
    }

    let oldImagePath = null;

    try {
      const parsedAnnouncementId = safeParseInt(announcementId);
      if (parsedAnnouncementId === 0) {
        throw new ValidationError('Invalid announcement ID');
      }

      // Get current announcement to check for existing image
      const currentAnnouncement = await AnnouncementModel.findById(parsedAnnouncementId);
      if (!currentAnnouncement) {
        throw new NotFoundError('Announcement not found');
      }

      oldImagePath = currentAnnouncement.image_path;

      // Add new image path if uploaded
      if (req.uploadedImage) {
        updateData.image_path = req.uploadedImage.path;
      }

      const announcement = await AnnouncementModel.updateAnnouncement(
        parsedAnnouncementId,
        updateData
      );

      // If update successful and we have a new image, delete the old one
      if (req.uploadedImage && oldImagePath) {
        const oldFilename = oldImagePath.split('/').pop();
        deleteUploadedFile(oldFilename);
      }

      res.status(200).json({
        success: true,
        message: 'Announcement updated successfully',
        data: {
          announcement: {
            ...announcement,
            image_url: getImageUrl(announcement.image_path)
          }
        },
      });
    } catch (error) {
      // If update fails and we uploaded a new image, clean it up
      if (req.uploadedImage) {
        deleteUploadedFile(req.uploadedImage.filename);
      }
      throw error;
    }
  });

  // Soft delete announcement (admin only)
  deleteAnnouncement = asyncHandler(async (req, res) => {
    const { announcementId } = req.params;

    await AnnouncementModel.softDeleteAnnouncement(parseInt(announcementId));

    res.status(200).json({
      success: true,
      message: 'Announcement deleted successfully',
    });
  });

  // Permanently delete announcement (admin only) - for cleanup purposes
  permanentlyDeleteAnnouncement = asyncHandler(async (req, res) => {
    const { announcementId } = req.params;

    // Get announcement to delete associated image
    const announcement = await AnnouncementModel.findById(parseInt(announcementId), true); // Include soft deleted

    if (announcement && announcement.image_path) {
      const filename = announcement.image_path.split('/').pop();
      deleteUploadedFile(filename);
    }

    await AnnouncementModel.permanentlyDeleteAnnouncement(parseInt(announcementId));

    res.status(200).json({
      success: true,
      message: 'Announcement permanently deleted successfully',
    });
  });

  // Restore soft deleted announcement (admin only)
  restoreAnnouncement = asyncHandler(async (req, res) => {
    const { announcementId } = req.params;

    const announcement = await AnnouncementModel.restoreAnnouncement(parseInt(announcementId));

    res.status(200).json({
      success: true,
      message: 'Announcement restored successfully',
      data: {
        announcement: {
          ...announcement,
          image_url: getImageUrl(announcement.image_path)
        }
      },
    });
  });

  // Publish announcement (admin only)
  publishAnnouncement = asyncHandler(async (req, res) => {
    const { announcementId } = req.params;

    const announcement = await AnnouncementModel.publishAnnouncement(parseInt(announcementId));

    res.status(200).json({
      success: true,
      message: 'Announcement published successfully',
      data: { announcement },
    });
  });

  // Unpublish announcement (admin only)
  unpublishAnnouncement = asyncHandler(async (req, res) => {
    const { announcementId } = req.params;

    const announcement = await AnnouncementModel.unpublishAnnouncement(parseInt(announcementId));

    res.status(200).json({
      success: true,
      message: 'Announcement unpublished successfully',
      data: { announcement },
    });
  });

  // Mark announcement as viewed
  markAsViewed = asyncHandler(async (req, res) => {
    const { announcementId } = req.params;
    const userId = req.user.id;
    const userType = req.user.role;
    const ipAddress = req.ip;

    await AnnouncementModel.markAsViewed(
      parseInt(announcementId),
      userId,
      userType,
      ipAddress
    );

    res.status(200).json({
      success: true,
      message: 'Announcement marked as viewed',
    });
  });

  // Add reaction to announcement
  likeAnnouncement = asyncHandler(async (req, res) => {
    const { announcementId } = req.params;
    const { reaction_id = 1 } = req.body; // Default to 'like' reaction
    const userId = req.user.id;
    const userType = req.user.role;

    await AnnouncementModel.addReaction(
      parseInt(announcementId),
      userId,
      userType,
      parseInt(reaction_id)
    );

    // Send notification and real-time update
    try {
      const announcement = await AnnouncementModel.getAnnouncementById(parseInt(announcementId));
      const reactionType = await ReactionModel.findById(parseInt(reaction_id));

      // Notify announcement author (if not reacting to own announcement)
      if (!(announcement.posted_by === userId && userType === 'admin')) {
        await notificationService.notifyAnnouncementReaction(
          announcement,
          reactionType,
          { id: userId, type: userType }
        );
      }

      // Broadcast real-time update
      websocketService.broadcastAnnouncementReaction({
        announcement_id: parseInt(announcementId),
        reaction_id: parseInt(reaction_id),
        user_id: userId,
        user_type: userType,
        action: 'added'
      });
    } catch (notificationError) {
      console.error('Failed to send reaction notification:', notificationError);
      // Don't fail the main request if notification fails
    }

    res.status(200).json({
      success: true,
      message: 'Reaction added successfully',
    });
  });

  // Remove reaction from announcement
  unlikeAnnouncement = asyncHandler(async (req, res) => {
    const { announcementId } = req.params;
    const userId = req.user.id;
    const userType = req.user.role;

    const result = await AnnouncementModel.removeReaction(
      parseInt(announcementId),
      userId,
      userType
    );

    // Broadcast real-time update if reaction was removed
    if (result.removed) {
      try {
        websocketService.broadcastAnnouncementReaction({
          announcement_id: parseInt(announcementId),
          reaction_id: null,
          user_id: userId,
          user_type: userType,
          action: 'removed'
        });
      } catch (error) {
        console.error('Failed to broadcast reaction removal:', error);
      }
    }

    res.status(200).json({
      success: true,
      message: result.removed ? 'Reaction removed successfully' : 'No reaction to remove',
      data: { removed: result.removed },
    });
  });

  // Get categories
  getCategories = asyncHandler(async (req, res) => {
    const categories = await AnnouncementModel.getCategories();

    res.status(200).json({
      success: true,
      message: 'Categories retrieved successfully',
      data: { categories },
    });
  });

  // Get all subcategories
  getSubcategories = asyncHandler(async (req, res) => {
    const subcategories = await AnnouncementModel.getSubcategories();

    res.status(200).json({
      success: true,
      message: 'Subcategories retrieved successfully',
      data: { subcategories },
    });
  });

  // Get subcategories by category ID
  getSubcategoriesByCategory = asyncHandler(async (req, res) => {
    const { categoryId } = req.params;
    const subcategories = await AnnouncementModel.getSubcategoriesByCategory(parseInt(categoryId));

    res.status(200).json({
      success: true,
      message: 'Subcategories retrieved successfully',
      data: { subcategories },
    });
  });

  // Get categories with their subcategories (hierarchical structure)
  getCategoriesWithSubcategories = asyncHandler(async (req, res) => {
    const categories = await AnnouncementModel.getCategoriesWithSubcategories();

    res.status(200).json({
      success: true,
      message: 'Categories with subcategories retrieved successfully',
      data: { categories },
    });
  });

  // Get reaction types
  getReactionTypes = asyncHandler(async (req, res) => {
    const reactionTypes = await ReactionModel.getReactionTypes();

    res.status(200).json({
      success: true,
      message: 'Reaction types retrieved successfully',
      data: { reactionTypes },
    });
  });

  // Get announcement reaction statistics
  getAnnouncementReactionStats = asyncHandler(async (req, res) => {
    const { announcementId } = req.params;

    const stats = await ReactionModel.getAnnouncementReactionStats(
      announcementId ? parseInt(announcementId) : null
    );

    res.status(200).json({
      success: true,
      message: 'Reaction statistics retrieved successfully',
      data: { stats },
    });
  });

  // Add multiple images to existing announcement
  addAnnouncementImages = asyncHandler(async (req, res) => {
    const { announcementId } = req.params;

    if (!req.uploadedImages || req.uploadedImages.length === 0) {
      throw new ValidationError('No images provided');
    }

    try {
      // Verify announcement exists and user has permission
      const announcement = await this.announcementModel.findById(parseInt(announcementId));
      if (!announcement) {
        throw new NotFoundError('Announcement not found');
      }

      // Create attachments
      const attachments = await this.attachmentModel.createAttachments(
        parseInt(announcementId),
        req.uploadedImages
      );

      // Get all images for the announcement
      const allImages = await this.attachmentModel.getAttachmentsByAnnouncementId(
        parseInt(announcementId),
        'image'
      );

      res.status(201).json({
        success: true,
        message: 'Images added successfully',
        data: {
          attachments: attachments.map(att => ({
            ...att,
            file_url: getImageUrl(att.file_path)
          })),
          all_images: allImages.map(img => ({
            ...img,
            file_url: getImageUrl(img.file_path)
          }))
        }
      });
    } catch (error) {
      // Clean up uploaded files if operation fails
      if (req.uploadedImages && req.uploadedImages.length > 0) {
        const filenames = req.uploadedImages.map(img => img.filename);
        deleteMultipleUploadedFiles(filenames);
      }
      throw error;
    }
  });

  // Delete specific image from announcement
  deleteAnnouncementImage = asyncHandler(async (req, res) => {
    const { announcementId, attachmentId } = req.params;

    try {
      const success = await this.attachmentModel.deleteAttachment(
        parseInt(attachmentId),
        parseInt(announcementId)
      );

      if (!success) {
        throw new NotFoundError('Image not found');
      }

      res.status(200).json({
        success: true,
        message: 'Image deleted successfully'
      });
    } catch (error) {
      throw error;
    }
  });

  // Update image display order
  updateImageOrder = asyncHandler(async (req, res) => {
    const { announcementId } = req.params;
    const { imageOrder } = req.body;

    if (!Array.isArray(imageOrder)) {
      throw new ValidationError('Image order must be an array');
    }

    try {
      await this.attachmentModel.updateDisplayOrder(parseInt(announcementId), imageOrder);

      res.status(200).json({
        success: true,
        message: 'Image order updated successfully'
      });
    } catch (error) {
      throw error;
    }
  });

  // Set primary image for announcement
  setPrimaryImage = asyncHandler(async (req, res) => {
    const { announcementId, attachmentId } = req.params;

    try {
      await this.attachmentModel.setPrimaryImage(
        parseInt(announcementId),
        parseInt(attachmentId)
      );

      res.status(200).json({
        success: true,
        message: 'Primary image updated successfully'
      });
    } catch (error) {
      throw error;
    }
  });

  // Get all images for an announcement
  getAnnouncementImages = asyncHandler(async (req, res) => {
    const { announcementId } = req.params;

    try {
      const images = await this.attachmentModel.getAttachmentsByAnnouncementId(
        parseInt(announcementId),
        'image'
      );

      res.status(200).json({
        success: true,
        message: 'Images retrieved successfully',
        data: {
          images: images.map(img => ({
            ...img,
            file_url: getImageUrl(img.file_path)
          }))
        }
      });
    } catch (error) {
      throw error;
    }
  });

  // Submit announcement for approval (Professor)
  submitForApproval = asyncHandler(async (req, res) => {
    const { announcementId } = req.params;
    const adminId = req.user.id;

    try {
      // Check if announcement exists and belongs to the user
      const announcement = await this.announcementModel.getAnnouncementById(parseInt(announcementId));
      if (!announcement) {
        throw new NotFoundError('Announcement not found');
      }

      // Check if user is the author or has permission
      if (announcement.posted_by !== adminId && req.user.position !== 'Super Admin') {
        return res.status(403).json({
          success: false,
          message: 'You can only submit your own announcements for approval'
        });
      }

      // Check if announcement is in draft status
      if (announcement.status !== 'draft') {
        return res.status(400).json({
          success: false,
          message: 'Only draft announcements can be submitted for approval'
        });
      }

      // Update status to pending
      await this.announcementModel.updateAnnouncement(parseInt(announcementId), {
        status: 'pending'
      });

      res.status(200).json({
        success: true,
        message: 'Announcement submitted for approval successfully'
      });
    } catch (error) {
      throw error;
    }
  });

  // Approve announcement (Super Admin only)
  approveAnnouncement = asyncHandler(async (req, res) => {
    const { announcementId } = req.params;
    const adminId = req.user.id;

    try {
      // Check if user is Super Admin (case-insensitive)
      const userPosition = (req.user.position || '').toLowerCase();
      if (userPosition !== 'super admin' && userPosition !== 'super_admin') {
        return res.status(403).json({
          success: false,
          message: 'Only Super Admins can approve announcements'
        });
      }

      // Check if announcement exists
      const announcement = await this.announcementModel.getAnnouncementById(parseInt(announcementId));
      if (!announcement) {
        throw new NotFoundError('Announcement not found');
      }

      // Check if announcement is pending
      if (announcement.status !== 'pending') {
        return res.status(400).json({
          success: false,
          message: 'Only pending announcements can be approved'
        });
      }

      // Update announcement to approved status
      await this.announcementModel.updateAnnouncement(parseInt(announcementId), {
        status: 'published',
        approved_by: adminId,
        approved_at: new Date(),
        published_at: new Date()
      });

      // Send notification to the announcement author
      try {
        const notificationService = require('../services/notificationService');
        await notificationService.notifyAnnouncementApproval(
          announcement,
          { id: adminId }
        );
      } catch (notificationError) {
        // Log the error but don't fail the approval process
        console.error('Failed to send approval notification:', notificationError);
      }

      // Send SMS notifications if announcement is marked as alert
      if (announcement.is_alert) {
        try {
          console.log('📱 Announcement is marked as alert, sending SMS notifications...');
          console.log('📱 Announcement details:', {
            id: announcement.announcement_id,
            title: announcement.title,
            grade_level: announcement.grade_level,
            is_alert: announcement.is_alert
          });

          // Check if SMS service is enabled
          const smsService = require('../services/smsService');
          if (!smsService.isServiceEnabled()) {
            console.log('❌ SMS service is not enabled, skipping notifications');
            // Continue with approval but log the issue
          } else {
            console.log('✅ SMS service is enabled, proceeding with notifications');

            // Get active students filtered by grade level
            const filters = {};
            if (announcement.grade_level) {
              filters.grade_level = announcement.grade_level;
              console.log(`📱 Filtering students by grade level: ${announcement.grade_level}`);
            } else {
              console.log('📱 Sending to all active students (no grade level filter)');
            }

            const students = await this.studentModel.getActiveStudentsForSMS(filters);
            console.log(`📱 Found ${students.length} eligible students for SMS`);

            if (students.length > 0) {
              // Extract phone numbers
              const phoneNumbers = students.map(student => student.phone_number);
              console.log('📱 Phone numbers to send to:', phoneNumbers.map(p => p.substring(0, 6) + '...'));

              // Send SMS using the SMS service
              const smsResult = await smsService.sendAnnouncementAlert(announcement, phoneNumbers);
              console.log('📱 SMS sending result:', smsResult);

              // Create SMS notification records for tracking
              if (smsResult.sent > 0) {
                const smsNotifications = [];

                // Create notification records for successful sends
                for (const student of students) {
                  if (smsService.validatePhoneNumber(student.phone_number)) {
                    smsNotifications.push({
                      notification_id: null, // We don't have a specific notification ID for this
                      phone_number: smsService.formatPhoneNumber(student.phone_number),
                      message: `VCBA ALERT: ${announcement.title}`,
                      status: smsResult.success ? 'sent' : 'failed',
                      error_message: smsResult.success ? null : smsResult.error
                    });
                  }
                }

                if (smsNotifications.length > 0) {
                  await this.smsNotificationModel.createBulkSMSNotifications(smsNotifications);
                  console.log(`📱 Created ${smsNotifications.length} SMS notification records`);
                }
              }

              console.log(`📱 SMS Alert sent to ${smsResult.sent} students for announcement: ${announcement.title}`);
            } else {
              console.log('📱 No eligible students found for SMS notifications');
            }
          }
        } catch (smsError) {
          // Log the error but don't fail the approval process
          console.error('Failed to send SMS notifications:', smsError);
        }
      } else {
        console.log('📱 Announcement is not marked as alert, skipping SMS notifications');
      }

      res.status(200).json({
        success: true,
        message: 'Announcement approved and published successfully'
      });
    } catch (error) {
      throw error;
    }
  });

  // Reject announcement (Super Admin only) - now performs soft deletion
  rejectAnnouncement = asyncHandler(async (req, res) => {
    const { announcementId } = req.params;
    const adminId = req.user.id;

    try {
      // Check if user is Super Admin (case-insensitive)
      const userPosition = (req.user.position || '').toLowerCase();
      if (userPosition !== 'super admin' && userPosition !== 'super_admin') {
        return res.status(403).json({
          success: false,
          message: 'Only Super Admins can reject announcements'
        });
      }

      // Check if announcement exists
      const announcement = await this.announcementModel.getAnnouncementById(parseInt(announcementId));
      if (!announcement) {
        throw new NotFoundError('Announcement not found');
      }

      // Check if announcement is pending
      if (announcement.status !== 'pending') {
        return res.status(400).json({
          success: false,
          message: 'Only pending announcements can be rejected'
        });
      }

      // Archive the rejected announcement so it appears in ArchivedAnnouncements
      await this.announcementModel.updateAnnouncement(parseInt(announcementId), {
        status: 'archived',
        archived_at: new Date()
      });

      res.status(200).json({
        success: true,
        message: 'Announcement rejected and deleted successfully'
      });
    } catch (error) {
      throw error;
    }
  });
}

module.exports = new AnnouncementController();
