const logger = require('../utils/logger');

class WebSocketService {
  constructor() {
    this.io = null;
  }

  /**
   * Initialize the WebSocket service with Socket.IO instance
   * @param {Object} io - Socket.IO server instance
   */
  initialize(io) {
    this.io = io;
    logger.info('WebSocket service initialized');
  }

  /**
   * Broadcast new announcement to all connected clients
   * @param {Object} announcement - Announcement data
   */
  broadcastNewAnnouncement(announcement) {
    if (!this.io) {
      logger.warn('WebSocket service not initialized');
      return;
    }

    this.io.emit('announcement-created', {
      id: announcement.id,
      title: announcement.title,
      content: announcement.content,
      author: announcement.author,
      createdAt: announcement.created_at,
      priority: announcement.priority,
      category: announcement.category
    });

    logger.debug(`Broadcasted new announcement: ${announcement.title}`);
  }

  /**
   * Broadcast announcement update to all connected clients
   * @param {Object} announcement - Updated announcement data
   */
  broadcastAnnouncementUpdate(announcement) {
    if (!this.io) {
      logger.warn('WebSocket service not initialized');
      return;
    }

    this.io.emit('announcement-updated', {
      id: announcement.id,
      title: announcement.title,
      content: announcement.content,
      updatedAt: announcement.updated_at,
      priority: announcement.priority,
      category: announcement.category
    });

    logger.debug(`Broadcasted announcement update: ${announcement.title}`);
  }

  /**
   * Broadcast announcement deletion to all connected clients
   * @param {number} announcementId - ID of deleted announcement
   */
  broadcastAnnouncementDeletion(announcementId) {
    if (!this.io) {
      logger.warn('WebSocket service not initialized');
      return;
    }

    this.io.emit('announcement-deleted', { id: announcementId });
    logger.debug(`Broadcasted announcement deletion: ${announcementId}`);
  }

  /**
   * Broadcast new comment to all connected clients
   * @param {Object} comment - Comment data
   */
  broadcastNewComment(comment) {
    if (!this.io) {
      logger.warn('WebSocket service not initialized');
      return;
    }

    this.io.emit('comment-added', {
      id: comment.id,
      announcementId: comment.announcement_id,
      content: comment.content,
      author: comment.author,
      createdAt: comment.created_at
    });

    logger.debug(`Broadcasted new comment for announcement: ${comment.announcement_id}`);
  }

  /**
   * Send notification to specific user
   * @param {number} userId - Target user ID
   * @param {Object} notification - Notification data
   */
  sendNotificationToUser(userId, notification) {
    if (!this.io) {
      logger.warn('WebSocket service not initialized');
      return;
    }

    this.io.to(`user-${userId}`).emit('notification', {
      id: notification.id,
      title: notification.title,
      message: notification.message,
      type: notification.type,
      createdAt: notification.created_at,
      read: notification.read
    });

    logger.debug(`Sent notification to user ${userId}: ${notification.title}`);
  }

  /**
   * Broadcast notification to all users
   * @param {Object} notification - Notification data
   */
  broadcastNotification(notification) {
    if (!this.io) {
      logger.warn('WebSocket service not initialized');
      return;
    }

    this.io.emit('notification', {
      id: notification.id,
      title: notification.title,
      message: notification.message,
      type: notification.type,
      createdAt: notification.created_at
    });

    logger.debug(`Broadcasted notification to all users: ${notification.title}`);
  }

  /**
   * Send notification to admin users only
   * @param {Object} notification - Notification data
   */
  sendNotificationToAdmins(notification) {
    if (!this.io) {
      logger.warn('WebSocket service not initialized');
      return;
    }

    this.io.to('admin-room').emit('admin-notification', {
      id: notification.id,
      title: notification.title,
      message: notification.message,
      type: notification.type,
      createdAt: notification.created_at
    });

    logger.debug(`Sent admin notification: ${notification.title}`);
  }

  /**
   * Broadcast system status update
   * @param {Object} status - System status data
   */
  broadcastSystemStatus(status) {
    if (!this.io) {
      logger.warn('WebSocket service not initialized');
      return;
    }

    this.io.emit('system-status', {
      status: status.status,
      message: status.message,
      timestamp: new Date().toISOString()
    });

    logger.debug(`Broadcasted system status: ${status.status}`);
  }

  /**
   * Get connected clients count
   * @returns {number} Number of connected clients
   */
  getConnectedClientsCount() {
    if (!this.io) {
      return 0;
    }
    return this.io.engine.clientsCount;
  }

  /**
   * Send message to specific room
   * @param {string} room - Room name
   * @param {string} event - Event name
   * @param {Object} data - Data to send
   */
  sendToRoom(room, event, data) {
    if (!this.io) {
      logger.warn('WebSocket service not initialized');
      return;
    }

    this.io.to(room).emit(event, data);
    logger.debug(`Sent ${event} to room ${room}`);
  }

  /**
   * Send message to specific socket
   * @param {string} socketId - Socket ID
   * @param {string} event - Event name
   * @param {Object} data - Data to send
   */
  sendToSocket(socketId, event, data) {
    if (!this.io) {
      logger.warn('WebSocket service not initialized');
      return;
    }

    this.io.to(socketId).emit(event, data);
    logger.debug(`Sent ${event} to socket ${socketId}`);
  }

  /**
   * Broadcast comment reaction update
   * @param {Object} reaction - Reaction data
   */
  broadcastCommentReaction(reaction) {
    if (!this.io) {
      logger.warn('WebSocket service not initialized');
      return;
    }

    this.io.emit('comment-reaction-updated', {
      commentId: reaction.comment_id,
      reactionId: reaction.reaction_id,
      userId: reaction.user_id,
      userType: reaction.user_type,
      action: reaction.action // 'added' or 'removed'
    });

    logger.debug(`Broadcasted comment reaction update for comment: ${reaction.comment_id}`);
  }

  /**
   * Broadcast announcement reaction update
   * @param {Object} reaction - Reaction data
   */
  broadcastAnnouncementReaction(reaction) {
    if (!this.io) {
      logger.warn('WebSocket service not initialized');
      return;
    }

    this.io.emit('announcement-reaction-updated', {
      announcementId: reaction.announcement_id,
      reactionId: reaction.reaction_id,
      userId: reaction.user_id,
      userType: reaction.user_type,
      action: reaction.action // 'added' or 'removed'
    });

    logger.debug(`Broadcasted announcement reaction update for announcement: ${reaction.announcement_id}`);
  }

  /**
   * Broadcast calendar reaction update
   * @param {Object} reaction - Reaction data
   */
  broadcastCalendarReaction(reaction) {
    if (!this.io) {
      logger.warn('WebSocket service not initialized');
      return;
    }

    this.io.emit('calendar-reaction-updated', {
      calendarId: reaction.calendar_id,
      userId: reaction.user_id,
      userType: reaction.user_type,
      action: reaction.action // 'added' or 'removed'
    });

    logger.debug(`Broadcasted calendar reaction update for event: ${reaction.calendar_id}`);
  }

  /**
   * Get Socket.IO instance
   * @returns {Object} Socket.IO instance
   */
  getIO() {
    return this.io;
  }
}

// Export singleton instance
module.exports = new WebSocketService();
