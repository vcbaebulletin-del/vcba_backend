const AdminModel = require('../models/AdminModel');
const StudentModel = require('../models/StudentModel');
const { asyncHandler } = require('../middleware/errorHandler');
const { deleteProfilePictureFile } = require('../middleware/profileUpload');
const logger = require('../utils/logger');

class AdminController {
  // Get admin profile
  getProfile = asyncHandler(async (req, res) => {
    const admin = await AdminModel.getAdminWithProfile(req.user.id);

    if (!admin) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Admin profile not found',
        },
      });
    }

    // Remove sensitive data
    const { password, ...adminData } = admin;

    res.status(200).json({
      success: true,
      message: 'Admin profile retrieved successfully',
      data: { admin: adminData },
    });
  });

  // Update admin profile
  updateProfile = asyncHandler(async (req, res) => {
    const {
      first_name,
      last_name,
      phone,
      department,
      position,
      bio,
      avatar_url,
    } = req.body;

    const profileData = {
      first_name,
      last_name,
      phone,
      department,
      position,
      bio,
      avatar_url,
    };

    const updatedAdmin = await AdminModel.updateProfile(req.user.id, profileData);

    logger.info('Admin profile updated', {
      adminId: req.user.id,
      updatedFields: Object.keys(profileData).filter(key => profileData[key] !== undefined),
    });

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: { admin: updatedAdmin },
    });
  });

  // Upload profile picture
  uploadProfilePicture = asyncHandler(async (req, res) => {
    if (!req.uploadedProfilePicture) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'No profile picture file uploaded',
        },
      });
    }

    // TEMPORARY: Mock user for debugging - REMOVE AFTER FIXING AUTH
    const mockUserId = req.user?.id || 31; // Use actual admin ID 31
    console.log('🔍 DEBUG - Using user ID for database operations:', mockUserId);

    // Get current admin profile to check for existing profile picture
    const currentAdmin = await AdminModel.getAdminWithProfile(mockUserId);

    // Delete old profile picture if it exists
    if (currentAdmin && currentAdmin.profile_picture) {
      deleteProfilePictureFile(currentAdmin.profile_picture);
    }

    // Update profile with new profile picture path
    const profileData = {
      profile_picture: req.uploadedProfilePicture.path,
    };

    const updatedAdmin = await AdminModel.updateProfile(mockUserId, profileData);

    logger.info('Admin profile picture uploaded', {
      adminId: mockUserId,
      filename: req.uploadedProfilePicture.filename,
      size: req.uploadedProfilePicture.size,
    });

    res.status(200).json({
      success: true,
      message: 'Profile picture uploaded successfully',
      data: {
        admin: updatedAdmin,
        profilePicture: req.uploadedProfilePicture.path
      },
    });
  });

  // Remove profile picture
  removeProfilePicture = asyncHandler(async (req, res) => {
    console.log('🔍 PROFILE REMOVE - Starting profile picture removal...');

    // TEMPORARY: Mock user for debugging - REMOVE AFTER FIXING AUTH
    const mockUserId = req.user?.id || 31; // Use actual admin ID 31
    console.log('🔍 DEBUG - Using user ID for remove:', mockUserId);

    // Get current admin profile to check for existing profile picture
    const currentAdmin = await AdminModel.getAdminWithProfile(mockUserId);
    console.log('🔍 DEBUG - Current admin profile:', currentAdmin ? 'Found' : 'Not found');
    console.log('🔍 DEBUG - Current profile picture:', currentAdmin?.profile_picture || 'None');

    if (!currentAdmin || !currentAdmin.profile_picture) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'No profile picture found to remove',
        },
      });
    }

    // Delete the profile picture file
    deleteProfilePictureFile(currentAdmin.profile_picture);

    // Update profile to remove profile picture path
    const profileData = {
      profile_picture: null,
    };

    const updatedAdmin = await AdminModel.updateProfile(mockUserId, profileData);

    logger.info('Admin profile picture removed', {
      adminId: mockUserId,
      removedFile: currentAdmin.profile_picture,
    });

    res.status(200).json({
      success: true,
      message: 'Profile picture removed successfully',
      data: { admin: updatedAdmin },
    });
  });

  // Get all students
  getStudents = asyncHandler(async (req, res) => {
    // Disable caching for this endpoint to ensure fresh data
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    const {
      page = 1,
      limit = 20,
      program,
      year_level,
      grade_level,
      status,
      is_active,
      search,
    } = req.query;

    const filters = {};
    if (program) filters.program = program;
    if (year_level) filters.year_level = year_level;
    if (grade_level) filters.grade_level = grade_level;
    if (status) filters.status = status;
    if (is_active !== undefined) {
      // Handle both boolean and string values
      const boolValue = is_active === true || is_active === 'true';
      filters.is_active = boolValue ? 1 : 0;
    }
    if (search) filters.search = search;

    const result = await StudentModel.getAllStudentsWithProfiles(
      filters,
      parseInt(page, 10),
      parseInt(limit, 10)
    );

    res.status(200).json({
      success: true,
      message: 'Students retrieved successfully',
      students: result?.data || [],
      pagination: result?.pagination || {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total: 0,
        totalPages: 0
      }
    });
  });

  // Get single student
  getStudent = asyncHandler(async (req, res) => {
    const { studentId } = req.params;

    const student = await StudentModel.getStudentWithProfile(studentId);

    if (!student) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Student not found',
        },
      });
    }

    // Remove sensitive data
    const { password, ...studentData } = student;

    res.status(200).json({
      success: true,
      message: 'Student retrieved successfully',
      data: { student: studentData },
    });
  });

  // Create student account
  createStudent = asyncHandler(async (req, res) => {
    const {
      // Account data
      email,
      password,
      student_number,
      is_active = true,

      // Profile data - new name fields
      first_name,
      middle_name,
      last_name,
      suffix,
      phone_number,
      grade_level,
      parent_guardian_name,
      parent_guardian_phone,
      address,
      profile_picture,
    } = req.body;

    const accountData = {
      email,
      password,
      student_number,
      is_active,
      created_by: req.user?.id || 1, // Current admin's ID or default to 1
    };

    const profileData = {
      first_name,
      middle_name,
      last_name,
      suffix,
      phone_number,
      grade_level,
      parent_guardian_name,
      parent_guardian_phone,
      address,
      profile_picture,
    };

    const student = await StudentModel.createStudent(accountData, profileData);

    if (!student) {
      throw new Error('Failed to create student account');
    }

    logger.info('Student account created by admin', {
      adminId: req.user?.id || 1,
      studentId: student.student_id,
      studentEmail: student.email,
      studentNumber: student.student_number,
    });

    // Remove sensitive data from response
    const studentData = {
      student_id: student.student_id,
      email: student.email,
      student_number: student.student_number,
      is_active: student.is_active,
      last_login: student.last_login,
      created_by: student.created_by,
      created_at: student.created_at,
      updated_at: student.updated_at,
      profile: student.profile
    };

    res.status(201).json({
      success: true,
      message: 'Student account created successfully',
      data: {
        student: studentData,
      },
    });
  });

  // Update student account
  updateStudent = asyncHandler(async (req, res) => {
    const { studentId } = req.params;
    const {
      // Account data
      email,
      student_number,
      is_active,

      // Profile data - new name fields
      first_name,
      middle_name,
      last_name,
      suffix,
      phone_number,
      grade_level,
      parent_guardian_name,
      parent_guardian_phone,
      address,
      profile_picture,
    } = req.body;

    // Check if student exists
    const existingStudent = await StudentModel.getStudentWithProfile(studentId);
    if (!existingStudent) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Student not found',
        },
      });
    }

    // Update account data if provided
    const accountData = {};
    if (email !== undefined) accountData.email = email;
    if (student_number !== undefined) accountData.student_number = student_number;
    if (is_active !== undefined) accountData.is_active = is_active;

    if (Object.keys(accountData).length > 0) {
      await StudentModel.updateAccount(studentId, accountData);
    }

    // Update profile data if provided - new name fields
    const profileData = {};
    if (first_name !== undefined) profileData.first_name = first_name;
    if (middle_name !== undefined) profileData.middle_name = middle_name;
    if (last_name !== undefined) profileData.last_name = last_name;
    if (suffix !== undefined) profileData.suffix = suffix;
    if (phone_number !== undefined) profileData.phone_number = phone_number;
    if (grade_level !== undefined) profileData.grade_level = grade_level;
    if (parent_guardian_name !== undefined) profileData.parent_guardian_name = parent_guardian_name;
    if (parent_guardian_phone !== undefined) profileData.parent_guardian_phone = parent_guardian_phone;
    if (address !== undefined) profileData.address = address;
    if (profile_picture !== undefined) profileData.profile_picture = profile_picture;

    let updatedStudent;
    if (Object.keys(profileData).length > 0) {
      updatedStudent = await StudentModel.updateProfile(studentId, profileData);
    } else {
      updatedStudent = await StudentModel.getStudentWithProfile(studentId);
    }

    logger.info('Student account updated by admin', {
      adminId: req.user?.id || 1,
      studentId,
      updatedAccountFields: Object.keys(accountData),
      updatedProfileFields: Object.keys(profileData),
    });

    // Format response data (no password field in our structure)
    const studentData = {
      student_id: updatedStudent.student_id,
      email: updatedStudent.email,
      student_number: updatedStudent.student_number,
      is_active: updatedStudent.is_active,
      last_login: updatedStudent.last_login,
      created_by: updatedStudent.created_by,
      created_at: updatedStudent.created_at,
      updated_at: updatedStudent.updated_at,
      profile: updatedStudent.profile
    };

    res.status(200).json({
      success: true,
      message: 'Student updated successfully',
      student: studentData,
    });
  });

  // Delete student account (soft delete)
  deleteStudent = asyncHandler(async (req, res) => {
    const { studentId } = req.params;

    // Check if student exists
    const student = await StudentModel.getStudentWithProfile(studentId);
    if (!student) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Student not found',
        },
      });
    }

    // Soft delete by deactivating the account
    await StudentModel.updateAccount(studentId, { is_active: false });

    logger.info('Student account deactivated by admin', {
      adminId: req.user?.id || 1,
      studentId,
      studentEmail: student.email,
    });

    res.status(200).json({
      success: true,
      message: 'Student account deactivated successfully',
    });
  });

  // Reset student password
  resetStudentPassword = asyncHandler(async (req, res) => {
    const { studentId } = req.params;
    const { newPassword } = req.body;

    // Check if student exists
    const student = await StudentModel.findById(studentId);
    if (!student) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Student not found',
        },
      });
    }

    // Update password
    await StudentModel.updateAccount(studentId, { password: newPassword });

    logger.info('Student password reset by admin', {
      adminId: req.user?.id || 1,
      studentId,
      studentEmail: student.email,
    });

    res.status(200).json({
      success: true,
      message: 'Student password reset successfully',
    });
  });

  // Change admin password
  changePassword = asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const adminId = req.user?.id;

    if (!adminId) {
      return res.status(401).json({
        success: false,
        error: {
          message: 'Authentication required',
        },
      });
    }

    // Get admin with password for verification
    const admin = await AdminModel.findByIdWithPassword(adminId);
    if (!admin) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Admin not found',
        },
      });
    }

    // Verify current password
    const bcrypt = require('bcrypt');
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, admin.password);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Current password is incorrect',
        },
      });
    }

    // Check if new password is different from current
    const isSamePassword = await bcrypt.compare(newPassword, admin.password);
    if (isSamePassword) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'New password must be different from current password',
        },
      });
    }

    // Update password
    await AdminModel.updatePassword(adminId, newPassword);

    logger.info('Admin password changed successfully', {
      adminId,
      adminEmail: admin.email,
    });

    res.status(200).json({
      success: true,
      message: 'Password changed successfully',
    });
  });

  // Get dashboard statistics
  getDashboardStats = asyncHandler(async (req, res) => {
    // Get basic statistics
    const totalStudents = await StudentModel.count();
    const activeStudents = await StudentModel.count({ is_active: true });
    const inactiveStudents = totalStudents - activeStudents;

    // Get students by status
    const enrolledStudents = await StudentModel.count({ status: 'active' });
    const graduatedStudents = await StudentModel.count({ status: 'graduated' });
    const suspendedStudents = await StudentModel.count({ status: 'suspended' });

    const stats = {
      students: {
        total: totalStudents,
        active: activeStudents,
        inactive: inactiveStudents,
        enrolled: enrolledStudents,
        graduated: graduatedStudents,
        suspended: suspendedStudents,
      },
    };

    res.status(200).json({
      success: true,
      message: 'Dashboard statistics retrieved successfully',
      data: stats,
    });
  });

  // Upload student profile picture
  uploadStudentProfilePicture = asyncHandler(async (req, res) => {
    const { studentId } = req.params;

    if (!req.uploadedProfilePicture) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'No profile picture file uploaded',
        },
      });
    }

    // Check if student exists
    const existingStudent = await StudentModel.getStudentWithProfile(studentId);
    if (!existingStudent) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Student not found',
        },
      });
    }

    // Delete old profile picture if it exists
    if (existingStudent.profile && existingStudent.profile.profile_picture) {
      deleteProfilePictureFile(existingStudent.profile.profile_picture);
    }

    // Update profile with new profile picture path
    const profileData = {
      profile_picture: req.uploadedProfilePicture.path,
    };

    await StudentModel.updateProfile(studentId, profileData);

    // Get updated student data
    const updatedStudent = await StudentModel.getStudentWithProfile(studentId);

    logger.info('Student profile picture uploaded', {
      adminId: req.user?.id || 1,
      studentId: parseInt(studentId),
      filename: req.uploadedProfilePicture.filename,
      size: req.uploadedProfilePicture.size,
    });

    res.status(200).json({
      success: true,
      message: 'Student profile picture uploaded successfully',
      data: {
        student: updatedStudent,
        profilePicture: req.uploadedProfilePicture.path
      },
    });
  });

  // Remove student profile picture
  removeStudentProfilePicture = asyncHandler(async (req, res) => {
    const { studentId } = req.params;

    // Check if student exists
    const existingStudent = await StudentModel.getStudentWithProfile(studentId);
    if (!existingStudent) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Student not found',
        },
      });
    }

    // Delete profile picture file if it exists
    if (existingStudent.profile && existingStudent.profile.profile_picture) {
      deleteProfilePictureFile(existingStudent.profile.profile_picture);
    }

    // Update profile to remove profile picture
    const profileData = {
      profile_picture: null,
    };

    await StudentModel.updateProfile(studentId, profileData);

    // Get updated student data
    const updatedStudent = await StudentModel.getStudentWithProfile(studentId);

    logger.info('Student profile picture removed', {
      adminId: req.user?.id || 1,
      studentId: parseInt(studentId),
    });

    res.status(200).json({
      success: true,
      message: 'Student profile picture removed successfully',
      data: {
        student: updatedStudent,
      },
    });
  });

  // Bulk deactivate student accounts
  bulkDeactivate = asyncHandler(async (req, res) => {
    const { student_ids } = req.body;

    if (!student_ids || !Array.isArray(student_ids) || student_ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: { message: 'student_ids array is required' }
      });
    }

    const result = await StudentModel.bulkDeactivate(student_ids);

    logger.info('Students bulk deactivated', {
      adminId: req.user?.id || 1,
      studentIds: student_ids,
      count: result.affectedRows
    });

    res.status(200).json({
      success: true,
      message: `Successfully deactivated ${result.affectedRows} student(s)`,
      data: { affectedRows: result.affectedRows }
    });
  });
}

module.exports = new AdminController();
