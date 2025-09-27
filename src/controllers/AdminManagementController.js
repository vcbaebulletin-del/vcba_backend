const AdminModel = require('../models/AdminModel');
const { asyncHandler } = require('../middleware/errorHandler');
const { PermissionChecker } = require('../utils/permissions');
const logger = require('../utils/logger');
const path = require('path');
const fs = require('fs').promises;

class AdminManagementController {
  // Get all admins with filtering and pagination
  getAdmins = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, position, is_active, status, search } = req.query;

    console.log('🔍 AdminManagementController - Received query params:', {
      page, limit, position, is_active, status, search
    });

    const filters = {};
    if (position) filters.position = position;
    
    // Handle status filtering - prioritize 'status' parameter over 'is_active'
    if (status) {
      // Convert status string to numeric for is_active filter (database uses 1/0)
      if (status === 'active') {
        filters.is_active = 1;
        console.log('🔍 AdminManagementController - Setting is_active to 1 for active status');
      } else if (status === 'inactive') {
        filters.is_active = 0;
        console.log('🔍 AdminManagementController - Setting is_active to 0 for inactive status');
      }
    } else if (is_active !== undefined) {
      // Handle direct is_active parameter (convert boolean to numeric)
      filters.is_active = is_active ? 1 : 0;
      console.log('🔍 AdminManagementController - Using is_active parameter:', filters.is_active);
    }
    
    if (search) filters.search = search;

    console.log('🔍 AdminManagementController - Final filters:', filters);

    const result = await AdminModel.getAdminsWithPagination({
      page,
      limit,
      filters,
    });

    res.status(200).json({
      success: true,
      message: 'Admins retrieved successfully',
      data: result,
    });
  });

  // Get single admin by ID
  getAdmin = asyncHandler(async (req, res) => {
    const { adminId } = req.params;

    const admin = await AdminModel.getAdminWithProfile(adminId);
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Admin retrieved successfully',
      data: { admin },
    });
  });

  // Create new admin
  createAdmin = asyncHandler(async (req, res) => {
    const {
      email,
      password,
      first_name,
      last_name,
      middle_name,
      suffix,
      phone_number,
      position,
      grade_level,
      is_active = true,
    } = req.body;

    // Validate position
    if (!PermissionChecker.isValidPosition(position)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid position specified',
      });
    }

    const adminData = {
      email,
      password,
      is_active,
    };

    const profileData = {
      first_name,
      last_name,
      middle_name,
      suffix,
      phone_number,
      position,
      grade_level,
    };

    const admin = await AdminModel.createAdminWithProfile(adminData, profileData);

    logger.info('Admin created', {
      adminId: admin.admin_id,
      email: admin.email,
      position: admin.position,
      createdBy: req.user.id,
      userEmail: req.user.email,
    });

    res.status(201).json({
      success: true,
      message: 'Admin created successfully',
      data: { admin },
    });
  });

  // Update admin
  updateAdmin = asyncHandler(async (req, res) => {
    const { adminId } = req.params;
    const {
      email,
      first_name,
      last_name,
      middle_name,
      suffix,
      phone_number,
      position,
      grade_level,
      is_active,
    } = req.body;

    // Check if admin exists
    const existingAdmin = await AdminModel.getAdminWithProfile(adminId);
    if (!existingAdmin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found',
      });
    }

    // Validate position change if provided
    if (position && position !== existingAdmin.position) {
      await AdminModel.validatePositionUpdate(adminId, position, req.user.id);
    }

    const accountData = {};
    if (email !== undefined) accountData.email = email;
    if (is_active !== undefined) accountData.is_active = is_active;

    const profileData = {};
    if (first_name !== undefined) profileData.first_name = first_name;
    if (last_name !== undefined) profileData.last_name = last_name;
    if (middle_name !== undefined) profileData.middle_name = middle_name;
    if (suffix !== undefined) profileData.suffix = suffix;
    if (phone_number !== undefined) profileData.phone_number = phone_number;
    if (position !== undefined) profileData.position = position;
    if (grade_level !== undefined) profileData.grade_level = grade_level;

    const admin = await AdminModel.updateAdminWithProfile(adminId, accountData, profileData);

    logger.info('Admin updated', {
      adminId,
      updatedBy: req.user.id,
      userEmail: req.user.email,
      changes: { ...accountData, ...profileData },
    });

    res.status(200).json({
      success: true,
      message: 'Admin updated successfully',
      data: { admin },
    });
  });

  // Delete admin (soft delete)
  deleteAdmin = asyncHandler(async (req, res) => {
    const { adminId } = req.params;

    // Check if admin exists
    const existingAdmin = await AdminModel.getAdminWithProfile(adminId);
    if (!existingAdmin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found',
      });
    }

    // Prevent deletion of the last super admin
    if (existingAdmin.position === 'super_admin') {
      const superAdmins = await AdminModel.getAdminsByPosition('super_admin');
      if (superAdmins.length <= 1) {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete the last super admin',
        });
      }
    }

    // Prevent self-deletion
    if (parseInt(adminId) === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete your own account',
      });
    }

    await AdminModel.deleteAdmin(adminId);

    logger.info('Admin deleted', {
      adminId,
      deletedAdmin: existingAdmin.email,
      deletedBy: req.user.id,
      userEmail: req.user.email,
    });

    res.status(200).json({
      success: true,
      message: 'Admin deleted successfully',
    });
  });

  // Reset admin password
  resetAdminPassword = asyncHandler(async (req, res) => {
    const { adminId } = req.params;
    const { new_password } = req.body;

    // Check if admin exists
    const existingAdmin = await AdminModel.getAdminWithProfile(adminId);
    if (!existingAdmin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found',
      });
    }

    await AdminModel.updatePassword(adminId, new_password);

    logger.info('Admin password reset', {
      adminId,
      targetAdmin: existingAdmin.email,
      resetBy: req.user.id,
      userEmail: req.user.email,
    });

    res.status(200).json({
      success: true,
      message: 'Admin password reset successfully',
    });
  });

  // Update admin position
  updateAdminPosition = asyncHandler(async (req, res) => {
    const { adminId } = req.params;
    const { position } = req.body;

    // Validate position update
    await AdminModel.validatePositionUpdate(adminId, position, req.user.id);

    const admin = await AdminModel.updateAdminProfile(adminId, { position });

    logger.info('Admin position updated', {
      adminId,
      newPosition: position,
      updatedBy: req.user.id,
      userEmail: req.user.email,
    });

    res.status(200).json({
      success: true,
      message: 'Admin position updated successfully',
      data: { admin },
    });
  });

  // Get admins by position
  getAdminsByPosition = asyncHandler(async (req, res) => {
    const { position } = req.params;

    if (!PermissionChecker.isValidPosition(position)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid position specified',
      });
    }

    const admins = await AdminModel.getAdminsByPosition(position);

    res.status(200).json({
      success: true,
      message: `${position} admins retrieved successfully`,
      data: { admins },
    });
  });

  // Activate admin
  activateAdmin = asyncHandler(async (req, res) => {
    const { adminId } = req.params;

    await AdminModel.updateAdminAccount(adminId, { is_active: true });

    logger.info('Admin activated', {
      adminId,
      activatedBy: req.user.id,
      userEmail: req.user.email,
    });

    res.status(200).json({
      success: true,
      message: 'Admin activated successfully',
    });
  });

  // Deactivate admin
  deactivateAdmin = asyncHandler(async (req, res) => {
    const { adminId } = req.params;

    try {
      // Prevent self-deactivation
      if (parseInt(adminId) === req.user.id) {
        return res.status(400).json({
          success: false,
          message: 'Cannot deactivate your own account',
        });
      }

      // Check if admin exists and get their position
      const existingAdmin = await AdminModel.getAdminWithProfile(adminId);
      if (!existingAdmin) {
        return res.status(404).json({
          success: false,
          message: 'Admin not found',
        });
      }

      // Prevent deactivation of the last super admin
      if (existingAdmin.position === 'super_admin') {
        try {
          // Get all super admins (both active and inactive) to properly count active ones
          const allSuperAdmins = await AdminModel.getAllAdminsByPosition('super_admin');
          const activeSuperAdmins = allSuperAdmins.filter(admin => admin.is_active);
          
          if (activeSuperAdmins.length <= 1) {
            return res.status(400).json({
              success: false,
              message: 'Cannot deactivate the last active super admin',
            });
          }
        } catch (positionError) {
          logger.error('Error checking super admin count:', positionError);
          return res.status(500).json({
            success: false,
            message: 'Error validating super admin deactivation',
          });
        }
      }

      // Perform the deactivation
      await AdminModel.updateAdminAccount(adminId, { is_active: false });

      logger.info('Admin deactivated', {
        adminId,
        deactivatedAdmin: existingAdmin.email,
        deactivatedBy: req.user.id,
        userEmail: req.user.email,
      });

      res.status(200).json({
        success: true,
        message: 'Admin deactivated successfully',
      });

    } catch (error) {
      logger.error('Error in deactivateAdmin:', {
        adminId,
        error: error.message,
        stack: error.stack,
        requestedBy: req.user.id,
      });

      res.status(500).json({
        success: false,
        message: 'Failed to deactivate admin account',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  });

  // Upload admin profile picture
  uploadAdminProfilePicture = asyncHandler(async (req, res) => {
    const { adminId } = req.params;

    // Check if admin exists
    const existingAdmin = await AdminModel.getAdminWithProfile(adminId);
    if (!existingAdmin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found',
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded',
      });
    }

    // Update admin profile with new picture path
    const profilePicturePath = `/uploads/profiles/${req.file.filename}`;
    await AdminModel.updateAdminProfile(adminId, {
      profile_picture: profilePicturePath,
    });

    // Get updated admin data
    const updatedAdmin = await AdminModel.getAdminWithProfile(adminId);

    logger.info('Admin profile picture uploaded', {
      adminId,
      filename: req.file.filename,
      uploadedBy: req.user.id,
      userEmail: req.user.email,
    });

    res.status(200).json({
      success: true,
      message: 'Profile picture uploaded successfully',
      data: {
        admin: updatedAdmin,
        profilePicture: profilePicturePath,
      },
    });
  });

  // Remove admin profile picture
  removeAdminProfilePicture = asyncHandler(async (req, res) => {
    const { adminId } = req.params;

    // Check if admin exists
    const existingAdmin = await AdminModel.getAdminWithProfile(adminId);
    if (!existingAdmin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found',
      });
    }

    // Remove profile picture from database
    await AdminModel.updateAdminProfile(adminId, {
      profile_picture: null,
    });

    // Get updated admin data
    const updatedAdmin = await AdminModel.getAdminWithProfile(adminId);

    logger.info('Admin profile picture removed', {
      adminId,
      removedBy: req.user.id,
      userEmail: req.user.email,
    });

    res.status(200).json({
      success: true,
      message: 'Profile picture removed successfully',
      data: {
        admin: updatedAdmin,
      },
    });
  });
}

module.exports = new AdminManagementController();
