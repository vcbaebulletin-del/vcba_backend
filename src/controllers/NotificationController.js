const { asyncHandler } = require('../middleware/errorHandler');
const NotificationModel = require('../models/NotificationModel');

class NotificationController {
  // Get user notifications
  getNotifications = asyncHandler(async (req, res) => {
    const {
      page = 1,
      limit = 20,
      is_read,
      notification_type_id,
      sort_by = 'created_at',
      sort_order = 'DESC'
    } = req.query;

    const userId = req.user.id;
    const userType = req.user.role;

    const pagination = {
      page: parseInt(page),
      limit: parseInt(limit),
      is_read: is_read !== undefined ? parseInt(is_read) : null,
      notification_type_id: notification_type_id ? parseInt(notification_type_id) : null,
      sort_by,
      sort_order
    };

    const result = await NotificationModel.getNotificationsByUser(
      userType,
      userId,
      pagination
    );

    res.status(200).json({
      success: true,
      message: 'Notifications retrieved successfully',
      data: result,
    });
  });

  // Get unread notification count
  getUnreadCount = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const userType = req.user.role;

    const unreadCount = await NotificationModel.getUnreadCount(userType, userId);

    res.status(200).json({
      success: true,
      message: 'Unread count retrieved successfully',
      data: { unreadCount },
    });
  });

  // Mark notification as read
  markAsRead = asyncHandler(async (req, res) => {
    const { notificationId } = req.params;
    const userId = req.user.id;
    const userType = req.user.role;

    const notification = await NotificationModel.markAsRead(
      parseInt(notificationId),
      userId,
      userType
    );

    res.status(200).json({
      success: true,
      message: 'Notification marked as read',
      data: { notification },
    });
  });

  // Mark all notifications as read
  markAllAsRead = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const userType = req.user.role;

    const result = await NotificationModel.markAllAsRead(userType, userId);

    res.status(200).json({
      success: true,
      message: 'All notifications marked as read',
      data: result,
    });
  });

  // Delete notification
  deleteNotification = asyncHandler(async (req, res) => {
    const { notificationId } = req.params;
    const userId = req.user.id;
    const userType = req.user.role;

    await NotificationModel.deleteNotification(
      parseInt(notificationId),
      userId,
      userType
    );

    res.status(200).json({
      success: true,
      message: 'Notification deleted successfully',
    });
  });

  // Get notification statistics (admin only)
  getNotificationStats = asyncHandler(async (req, res) => {
    const stats = await NotificationModel.getNotificationStats();

    res.status(200).json({
      success: true,
      message: 'Notification statistics retrieved successfully',
      data: stats,
    });
  });

  // Get notification types
  getNotificationTypes = asyncHandler(async (req, res) => {
    const types = await NotificationModel.getNotificationTypes();

    res.status(200).json({
      success: true,
      message: 'Notification types retrieved successfully',
      data: { types },
    });
  });

  // Create notification (internal use)
  createNotification = asyncHandler(async (req, res) => {
    const notificationData = req.body;
    const notification = await NotificationModel.createNotification(notificationData);

    res.status(201).json({
      success: true,
      message: 'Notification created successfully',
      data: { notification },
    });
  });
}

module.exports = new NotificationController();
