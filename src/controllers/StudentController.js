const StudentModel = require('../models/StudentModel');
const { asyncHandler } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

class StudentController {
  // Get student profile
  getProfile = asyncHandler(async (req, res) => {
    const student = await StudentModel.getStudentWithProfile(req.user.id);

    if (!student) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Student profile not found',
        },
      });
    }

    // Remove sensitive data
    const { password, ...studentData } = student;

    res.status(200).json({
      success: true,
      message: 'Student profile retrieved successfully',
      data: { student: studentData },
    });
  });

  // Update student profile
  updateProfile = asyncHandler(async (req, res) => {
    const {
      first_name,
      last_name,
      middle_name,
      date_of_birth,
      gender,
      phone,
      address,
      city,
      state,
      postal_code,
      country,
      emergency_contact_name,
      emergency_contact_phone,
      emergency_contact_relationship,
      avatar_url,
      bio,
    } = req.body;

    const profileData = {
      first_name,
      last_name,
      middle_name,
      date_of_birth,
      gender,
      phone,
      address,
      city,
      state,
      postal_code,
      country,
      emergency_contact_name,
      emergency_contact_phone,
      emergency_contact_relationship,
      avatar_url,
      bio,
    };

    const updatedStudent = await StudentModel.updateProfile(req.user.id, profileData);

    logger.info('Student profile updated', {
      studentId: req.user.id,
      updatedFields: Object.keys(profileData).filter(key => profileData[key] !== undefined),
    });

    // Remove sensitive data
    const { password, ...studentData } = updatedStudent;

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: { student: studentData },
    });
  });

  // Change student password
  changePassword = asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const studentId = req.user?.id;

    if (!studentId) {
      return res.status(401).json({
        success: false,
        error: {
          message: 'Authentication required',
        },
      });
    }

    // Get student with password for verification
    const student = await StudentModel.findByIdWithPassword(studentId);
    if (!student) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Student not found',
        },
      });
    }

    // Verify current password
    const bcrypt = require('bcrypt');
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, student.password);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Current password is incorrect',
        },
      });
    }

    // Check if new password is different from current
    const isSamePassword = await bcrypt.compare(newPassword, student.password);
    if (isSamePassword) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'New password must be different from current password',
        },
      });
    }

    // Update password (StudentModel.updateAccount will handle hashing)
    await StudentModel.updateAccount(studentId, { password: newPassword });

    logger.info('Student password changed successfully', {
      studentId,
      studentEmail: student.email,
    });

    res.status(200).json({
      success: true,
      message: 'Password changed successfully',
    });
  });
}

module.exports = new StudentController();
