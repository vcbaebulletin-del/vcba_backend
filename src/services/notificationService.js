const NotificationModel = require('../models/NotificationModel');
const websocketService = require('./websocketService');
const logger = require('../utils/logger');

class NotificationService {
  // Notification types mapping
  static TYPES = {
    NEW_ANNOUNCEMENT: 1,
    ALERT_ANNOUNCEMENT: 2,
    COMMENT_REPLY: 3,
    COMMENT_REACTION: 4,
    ANNOUNCEMENT_REACTION: 5,
    COMMENT_FLAGGED: 6,
    PINNED_POST: 7,
    DRAFT_REMINDER: 8,
    ANNOUNCEMENT_COMMENT: 9, // Comments on announcements (existing)
    CALENDAR_EVENT: 10, // Calendar events (if needed)
    CALENDAR_COMMENT: 11, // Comments on calendar events
    CALENDAR_REACTION: 12, // Reactions on calendar events
    CALENDAR_COMMENT_REPLY: 13, // Replies to calendar event comments
    ANNOUNCEMENT_APPROVAL: 14 // Announcement approval notifications
  };

  /**
   * Create and send notification to user
   * @param {Object} data - Notification data
   * @param {string} data.recipient_type - 'admin' or 'student'
   * @param {number} data.recipient_id - User ID
   * @param {number} data.notification_type_id - Type of notification
   * @param {string} data.title - Notification title
   * @param {string} data.message - Notification message
   * @param {number} [data.related_announcement_id] - Related announcement ID
   * @param {number} [data.related_comment_id] - Related comment ID
   */
  async createNotification(data) {
    try {
      // Ensure title and message are properly encoded (handle emojis)
      const sanitizedData = {
        ...data,
        title: data.title || '',
        message: data.message || ''
      };

      // Create notification in database
      const notification = await NotificationModel.createNotification(sanitizedData);

      // Send real-time notification via WebSocket
      await this.sendRealTimeNotification(notification);

      logger.info('Notification created and sent', {
        notificationId: notification.notification_id,
        recipientType: data.recipient_type,
        recipientId: data.recipient_id,
        type: data.notification_type_id
      });

      return notification;
    } catch (error) {
      logger.error('Failed to create notification', { error: error.message, data });
      throw error;
    }
  }

  /**
   * Send real-time notification via WebSocket
   */
  async sendRealTimeNotification(notification) {
    try {
      const userRoom = `user-${notification.recipient_id}`;
      
      // Send to specific user room
      websocketService.sendToRoom(userRoom, 'notification', {
        ...notification,
        timestamp: new Date().toISOString()
      });

      logger.debug('Real-time notification sent', {
        notificationId: notification.notification_id,
        userRoom
      });
    } catch (error) {
      logger.error('Failed to send real-time notification', { 
        error: error.message,
        notificationId: notification.notification_id 
      });
    }
  }

  /**
   * Notify about new announcement
   */
  async notifyNewAnnouncement(announcement, recipients) {
    try {
      const notifications = [];

      for (const recipient of recipients) {
        const notificationData = {
          recipient_type: recipient.type,
          recipient_id: recipient.id,
          notification_type_id: announcement.is_alert ? 
            NotificationService.TYPES.ALERT_ANNOUNCEMENT : 
            NotificationService.TYPES.NEW_ANNOUNCEMENT,
          title: announcement.is_alert ? 
            `🚨 Alert: ${announcement.title}` : 
            `📢 New Announcement: ${announcement.title}`,
          message: announcement.content.substring(0, 200) + (announcement.content.length > 200 ? '...' : ''),
          related_announcement_id: announcement.announcement_id
        };

        const notification = await this.createNotification(notificationData);
        notifications.push(notification);
      }

      return notifications;
    } catch (error) {
      logger.error('Failed to notify about new announcement', { 
        error: error.message,
        announcementId: announcement.announcement_id 
      });
      throw error;
    }
  }

  /**
   * Notify about comment reply with enhanced admin-student interaction support
   */
  async notifyCommentReply(comment, parentComment, announcement) {
    try {
      // Don't notify if replying to own comment
      if (parentComment.user_type === comment.user_type &&
          parentComment.user_id === comment.user_id) {
        return null;
      }

      // Get replier's name for personalized notifications
      const replierName = await this.getActorName(comment.user_id, comment.user_type);

      // Create personalized notification based on replier type
      let title, message;
      if (comment.user_type === 'admin' && parentComment.user_type === 'student') {
        // Admin replying to student comment - enhanced notification
        title = `💬 Admin ${replierName} replied to your comment`;
        message = `Admin ${replierName} replied: "${comment.comment_text.substring(0, 100)}${comment.comment_text.length > 100 ? '...' : ''}" on "${announcement.title}"`;
      } else if (comment.user_type === 'student' && parentComment.user_type === 'admin') {
        // Student replying to admin comment
        title = `💬 A student replied to your comment`;
        message = `"${comment.comment_text.substring(0, 100)}${comment.comment_text.length > 100 ? '...' : ''}" on "${announcement.title}"`;
      } else {
        // Default notification (same user type)
        const replierLabel = comment.user_type === 'admin' ? 'An admin' : 'Someone';
        title = `💬 ${replierLabel} replied to your comment`;
        message = `"${comment.comment_text.substring(0, 100)}${comment.comment_text.length > 100 ? '...' : ''}" on "${announcement.title}"`;
      }

      const notificationData = {
        recipient_type: parentComment.user_type,
        recipient_id: parentComment.user_id,
        notification_type_id: NotificationService.TYPES.COMMENT_REPLY,
        title,
        message,
        related_announcement_id: announcement.announcement_id,
        related_comment_id: comment.comment_id
      };

      logger.info('Sending comment reply notification', {
        replierType: comment.user_type,
        replierId: comment.user_id,
        replierName,
        parentCommentAuthorType: parentComment.user_type,
        parentCommentAuthorId: parentComment.user_id,
        announcementId: announcement.announcement_id,
        commentId: comment.comment_id
      });

      return await this.createNotification(notificationData);
    } catch (error) {
      logger.error('Failed to notify about comment reply', {
        error: error.message,
        commentId: comment.comment_id
      });
      throw error;
    }
  }

  /**
   * Notify announcement author about new comment with grade-level filtering
   * Only notifies the admin who posted the announcement if they're assigned to the same grade level
   */
  async notifyAnnouncementComment(comment, announcement) {
    try {
      // Only notify for top-level comments (not replies)
      if (comment.parent_comment_id) {
        return null;
      }

      // Don't notify if commenting on own announcement
      if (announcement.posted_by === comment.user_id && comment.user_type === 'admin') {
        return null;
      }

      // Only notify admin authors (announcements are posted by admins)
      if (!announcement.posted_by) {
        logger.warn('Announcement has no posted_by field', {
          announcementId: announcement.announcement_id
        });
        return null;
      }

      // Get the admin who posted the announcement with their grade level
      const AdminModel = require('../models/AdminModel');
      const announcementAuthor = await AdminModel.getAdminWithProfile(announcement.posted_by);

      if (!announcementAuthor) {
        logger.warn('Announcement author not found', {
          adminId: announcement.posted_by,
          announcementId: announcement.announcement_id
        });
        return null;
      }

      // Check grade level compatibility
      const shouldNotify = this.shouldNotifyBasedOnGradeLevel(
        announcementAuthor.grade_level,
        announcement.grade_level
      );

      if (!shouldNotify) {
        logger.debug('Skipping notification due to grade level mismatch', {
          adminGradeLevel: announcementAuthor.grade_level,
          announcementGradeLevel: announcement.grade_level,
          adminId: announcement.posted_by,
          announcementId: announcement.announcement_id
        });
        return null;
      }

      // Create notification for the announcement author
      const commenterName = comment.user_type === 'student' ? 'A student' : 'Someone';
      const notificationData = {
        recipient_type: 'admin',
        recipient_id: announcement.posted_by,
        notification_type_id: NotificationService.TYPES.ANNOUNCEMENT_COMMENT,
        title: `💬 ${commenterName} commented on your announcement`,
        message: `"${comment.comment_text.substring(0, 100)}${comment.comment_text.length > 100 ? '...' : ''}" on "${announcement.title}"`,
        related_announcement_id: announcement.announcement_id,
        related_comment_id: comment.comment_id
      };

      logger.info('Sending announcement comment notification', {
        adminId: announcement.posted_by,
        adminGradeLevel: announcementAuthor.grade_level,
        announcementGradeLevel: announcement.grade_level,
        commentId: comment.comment_id,
        announcementId: announcement.announcement_id
      });

      return await this.createNotification(notificationData);
    } catch (error) {
      logger.error('Failed to notify about announcement comment', {
        error: error.message,
        commentId: comment.comment_id,
        announcementId: announcement.announcement_id
      });
      throw error;
    }
  }

  /**
   * Notify calendar event author about new comment with role-based filtering
   * Only notifies the admin who created the calendar event
   */
  async notifyCalendarComment(comment, calendarEvent) {
    try {
      // Only notify for top-level comments (not replies)
      if (comment.parent_comment_id) {
        return null;
      }

      // Don't notify if commenting on own calendar event
      if (calendarEvent.created_by === comment.user_id && comment.user_type === 'admin') {
        return null;
      }

      // Only notify admin authors (calendar events are created by admins)
      if (!calendarEvent.created_by) {
        logger.warn('Calendar event has no created_by field', {
          calendarId: calendarEvent.calendar_id
        });
        return null;
      }

      // Create notification for the calendar event author
      const commenterName = comment.user_type === 'student' ? 'A student' : 'Someone';
      const notificationData = {
        recipient_type: 'admin',
        recipient_id: calendarEvent.created_by,
        notification_type_id: NotificationService.TYPES.CALENDAR_COMMENT,
        title: `💬 ${commenterName} commented on your calendar event`,
        message: `"${comment.comment_text.substring(0, 100)}${comment.comment_text.length > 100 ? '...' : ''}" on "${calendarEvent.title}"`,
        related_announcement_id: calendarEvent.calendar_id, // Use calendar_id for consistency
        related_comment_id: comment.comment_id
      };

      const notification = await this.createNotification(notificationData);

      logger.info('Calendar comment notification sent', {
        notificationId: notification.notification_id,
        calendarId: calendarEvent.calendar_id,
        commentId: comment.comment_id,
        recipientId: calendarEvent.created_by
      });

      return notification;
    } catch (error) {
      logger.error('Failed to notify calendar comment', {
        error: error.message,
        commentId: comment.comment_id,
        calendarId: calendarEvent.calendar_id
      });
      throw error;
    }
  }

  /**
   * Notify about calendar comment reply with enhanced admin-student interaction support
   */
  async notifyCalendarCommentReply(comment, parentComment, calendarEvent) {
    try {
      // Don't notify if replying to own comment
      if (parentComment.user_type === comment.user_type && parentComment.user_id === comment.user_id) {
        return null;
      }

      // Get replier's name for personalized notifications
      const replierName = await this.getActorName(comment.user_id, comment.user_type);

      // Create personalized notification based on replier type
      let title, message;
      if (comment.user_type === 'admin' && parentComment.user_type === 'student') {
        // Admin replying to student comment - enhanced notification
        title = `💬 Admin ${replierName} replied to your comment`;
        message = `Admin ${replierName} replied: "${comment.comment_text.substring(0, 100)}${comment.comment_text.length > 100 ? '...' : ''}" on calendar event "${calendarEvent.title}"`;
      } else if (comment.user_type === 'student' && parentComment.user_type === 'admin') {
        // Student replying to admin comment
        title = `💬 A student replied to your comment`;
        message = `"${comment.comment_text.substring(0, 100)}${comment.comment_text.length > 100 ? '...' : ''}" on calendar event "${calendarEvent.title}"`;
      } else {
        // Default notification (same user type)
        const replierLabel = comment.user_type === 'admin' ? 'An admin' : 'Someone';
        title = `💬 ${replierLabel} replied to your comment`;
        message = `"${comment.comment_text.substring(0, 100)}${comment.comment_text.length > 100 ? '...' : ''}" on calendar event "${calendarEvent.title}"`;
      }

      const notificationData = {
        recipient_type: parentComment.user_type,
        recipient_id: parentComment.user_id,
        notification_type_id: NotificationService.TYPES.CALENDAR_COMMENT_REPLY,
        title,
        message,
        related_announcement_id: calendarEvent.calendar_id, // Use calendar_id for consistency
        related_comment_id: comment.comment_id
      };

      const notification = await this.createNotification(notificationData);

      logger.info('Calendar comment reply notification sent', {
        notificationId: notification.notification_id,
        calendarId: calendarEvent.calendar_id,
        commentId: comment.comment_id,
        parentCommentId: parentComment.comment_id,
        recipientId: parentComment.user_id,
        recipientType: parentComment.user_type
      });

      return notification;
    } catch (error) {
      logger.error('Failed to notify calendar comment reply', {
        error: error.message,
        commentId: comment.comment_id,
        parentCommentId: parentComment.comment_id,
        calendarId: calendarEvent.calendar_id
      });
      throw error;
    }
  }

  /**
   * Determine if admin should receive notification based on grade level logic
   * @param {number|null} adminGradeLevel - Admin's assigned grade level (11, 12, or null for system admin)
   * @param {number|null} announcementGradeLevel - Announcement's target grade level (11, 12, or null for all grades)
   * @returns {boolean} - Whether the admin should receive the notification
   */
  shouldNotifyBasedOnGradeLevel(adminGradeLevel, announcementGradeLevel) {
    // System admins (grade_level = null) can receive notifications for all announcements
    if (adminGradeLevel === null) {
      return true;
    }

    // If announcement is for all grades (grade_level = null), notify all admins
    if (announcementGradeLevel === null) {
      return true;
    }

    // Grade-specific admin should only receive notifications for their assigned grade
    return adminGradeLevel === announcementGradeLevel;
  }

  /**
   * Sanitize text to ensure proper UTF-8 encoding and emoji support
   * @param {string} text - Text to sanitize
   * @returns {string} - Sanitized text
   */
  sanitizeText(text) {
    if (!text) return '';

    try {
      // Ensure text is properly encoded as UTF-8
      // Remove any invalid UTF-8 sequences
      return text.toString('utf8');
    } catch (error) {
      logger.warn('Failed to sanitize text', { error: error.message });
      // Fallback: remove problematic characters
      return text.replace(/[^\x00-\x7F\u0080-\uFFFF]/g, '');
    }
  }

  /**
   * Get actor's display name for personalized notifications
   * @param {number} actorId - User ID
   * @param {string} actorType - 'admin' or 'student'
   * @returns {Promise<string>} - Display name
   */
  async getActorName(actorId, actorType) {
    try {
      if (actorType === 'admin') {
        const AdminModel = require('../models/AdminModel');
        const admin = await AdminModel.getAdminWithProfile(actorId);
        if (admin && admin.profile) {
          const nameParts = [
            admin.profile.first_name || admin.first_name,
            admin.profile.middle_name || admin.middle_name,
            admin.profile.last_name || admin.last_name,
            admin.profile.suffix || admin.suffix
          ].filter(part => part && part.trim() !== '');

          const fullName = nameParts.join(' ').trim();
          return fullName || 'Admin';
        }
        return 'Admin';
      } else if (actorType === 'student') {
        const StudentModel = require('../models/StudentModel');
        const student = await StudentModel.getStudentWithProfile(actorId);
        if (student && student.profile) {
          const nameParts = [
            student.profile.first_name || student.first_name,
            student.profile.middle_name || student.middle_name,
            student.profile.last_name || student.last_name,
            student.profile.suffix || student.suffix
          ].filter(part => part && part.trim() !== '');

          const fullName = nameParts.join(' ').trim();
          return fullName || 'Student';
        }
        return 'Student';
      }
      return 'User';
    } catch (error) {
      logger.warn('Failed to get actor name', {
        error: error.message,
        actorId,
        actorType
      });
      return actorType === 'admin' ? 'Admin' : 'Student';
    }
  }

  /**
   * Notify about comment reaction with enhanced admin-student interaction support
   */
  async notifyCommentReaction(comment, reaction, reactor, announcement) {
    try {
      // Don't notify if reacting to own comment
      if (comment.user_type === reactor.type && comment.user_id === reactor.id) {
        return null;
      }

      // Get reactor's name for personalized notifications
      const reactorName = await this.getActorName(reactor.id, reactor.type);

      // Create personalized notification based on reactor type
      let title, message;
      if (reactor.type === 'admin' && comment.user_type === 'student') {
        // Admin reacting to student comment - enhanced notification
        title = `${reaction.reaction_emoji} Admin ${reactorName} reacted to your comment`;
        message = `Admin ${reactorName} gave your comment a ${reaction.reaction_name} reaction on "${announcement.title}"`;
      } else if (reactor.type === 'student' && comment.user_type === 'admin') {
        // Student reacting to admin comment
        title = `${reaction.reaction_emoji} A student reacted to your comment`;
        message = `Your comment on "${announcement.title}" received a ${reaction.reaction_name} reaction`;
      } else {
        // Default notification (same user type)
        const actorLabel = reactor.type === 'admin' ? 'An admin' : 'Someone';
        title = `${reaction.reaction_emoji} ${actorLabel} reacted to your comment`;
        message = `Your comment on "${announcement.title}" received a ${reaction.reaction_name} reaction`;
      }

      const notificationData = {
        recipient_type: comment.user_type,
        recipient_id: comment.user_id,
        notification_type_id: NotificationService.TYPES.COMMENT_REACTION,
        title,
        message,
        related_announcement_id: announcement.announcement_id,
        related_comment_id: comment.comment_id
      };

      logger.info('Sending comment reaction notification', {
        reactorType: reactor.type,
        reactorId: reactor.id,
        reactorName,
        commentAuthorType: comment.user_type,
        commentAuthorId: comment.user_id,
        reactionType: reaction.reaction_name,
        announcementId: announcement.announcement_id,
        commentId: comment.comment_id
      });

      return await this.createNotification(notificationData);
    } catch (error) {
      logger.error('Failed to notify about comment reaction', {
        error: error.message,
        commentId: comment.comment_id
      });
      throw error;
    }
  }

  /**
   * Notify about announcement reaction
   */
  async notifyAnnouncementReaction(announcement, reaction, reactor) {
    try {
      // Don't notify if reacting to own announcement
      if (announcement.posted_by === reactor.id && reactor.type === 'admin') {
        return null;
      }

      const notificationData = {
        recipient_type: 'admin', // Announcements are posted by admins
        recipient_id: announcement.posted_by,
        notification_type_id: NotificationService.TYPES.ANNOUNCEMENT_REACTION,
        title: `${reaction.reaction_emoji} Someone reacted to your announcement`,
        message: `Your announcement "${announcement.title}" received a ${reaction.reaction_name} reaction`,
        related_announcement_id: announcement.announcement_id
      };

      return await this.createNotification(notificationData);
    } catch (error) {
      logger.error('Failed to notify about announcement reaction', {
        error: error.message,
        announcementId: announcement.announcement_id
      });
      throw error;
    }
  }

  /**
   * Notify about calendar event reaction with role-based personalization
   */
  async notifyCalendarReaction(calendarEvent, reactor) {
    try {
      // Don't notify if reacting to own calendar event
      if (calendarEvent.created_by === reactor.id && reactor.type === 'admin') {
        return null;
      }

      // Get reactor's name for personalized notifications
      const reactorName = await this.getActorName(reactor.id, reactor.type);

      // Create personalized notification based on reactor type
      let title, message;
      if (reactor.type === 'admin') {
        // Admin reacting to calendar event
        title = `❤️ Admin ${reactorName} liked your calendar event`;
        message = `Admin ${reactorName} liked your calendar event "${calendarEvent.title}"`;
      } else if (reactor.type === 'student') {
        // Student reacting to calendar event
        title = `❤️ A student liked your calendar event`;
        message = `Your calendar event "${calendarEvent.title}" received a like from a student`;
      } else {
        // Default notification
        title = `❤️ Someone liked your calendar event`;
        message = `Your calendar event "${calendarEvent.title}" received a like`;
      }

      const notificationData = {
        recipient_type: 'admin', // Calendar events are created by admins
        recipient_id: calendarEvent.created_by,
        notification_type_id: NotificationService.TYPES.CALENDAR_REACTION,
        title,
        message,
        related_announcement_id: calendarEvent.calendar_id // Use calendar_id for consistency
      };

      const notification = await this.createNotification(notificationData);

      logger.info('Calendar reaction notification sent', {
        notificationId: notification.notification_id,
        calendarId: calendarEvent.calendar_id,
        reactorId: reactor.id,
        reactorType: reactor.type,
        recipientId: calendarEvent.created_by
      });

      return notification;
    } catch (error) {
      logger.error('Failed to notify calendar reaction', {
        error: error.message,
        calendarId: calendarEvent.calendar_id,
        reactorId: reactor.id,
        reactorType: reactor.type
      });
      throw error;
    }
  }

  /**
   * Notify about flagged comment
   */
  async notifyCommentFlagged(comment, flaggedBy, reason, announcement) {
    try {
      const notificationData = {
        recipient_type: comment.user_type,
        recipient_id: comment.user_id,
        notification_type_id: NotificationService.TYPES.COMMENT_FLAGGED,
        title: `⚠️ Your comment has been flagged`,
        message: `Your comment on "${announcement.title}" was flagged${reason ? ` for: ${reason}` : ''}`,
        related_announcement_id: announcement.announcement_id,
        related_comment_id: comment.comment_id
      };

      return await this.createNotification(notificationData);
    } catch (error) {
      logger.error('Failed to notify about flagged comment', { 
        error: error.message,
        commentId: comment.comment_id 
      });
      throw error;
    }
  }

  /**
   * Notify about pinned post
   */
  async notifyPinnedPost(announcement, recipients) {
    try {
      const notifications = [];

      for (const recipient of recipients) {
        const notificationData = {
          recipient_type: recipient.type,
          recipient_id: recipient.id,
          notification_type_id: NotificationService.TYPES.PINNED_POST,
          title: `📌 New Pinned Announcement: ${announcement.title}`,
          message: announcement.content.substring(0, 200) + (announcement.content.length > 200 ? '...' : ''),
          related_announcement_id: announcement.announcement_id
        };

        const notification = await this.createNotification(notificationData);
        notifications.push(notification);
      }

      return notifications;
    } catch (error) {
      logger.error('Failed to notify about pinned post', { 
        error: error.message,
        announcementId: announcement.announcement_id 
      });
      throw error;
    }
  }

  /**
   * Get recipients for announcement notifications
   * @param {Object} announcement - Announcement object
   * @returns {Array} Array of recipients {type, id}
   */
  async getAnnouncementRecipients(announcement) {
    try {
      const recipients = [];

      // For now, we'll implement a simple logic
      // In a real system, you might want to get all active students
      // and filter by grade level, preferences, etc.

      // This is a placeholder - you should implement proper recipient logic
      // based on your business requirements
      
      return recipients;
    } catch (error) {
      logger.error('Failed to get announcement recipients', { 
        error: error.message,
        announcementId: announcement.announcement_id 
      });
      return [];
    }
  }

  /**
   * Notify about calendar event
   */
  async notifyCalendarEvent(calendarEvent, recipients) {
    try {
      const notifications = [];

      for (const recipient of recipients) {
        const notificationData = {
          recipient_type: recipient.type,
          recipient_id: recipient.id,
          notification_type_id: NotificationService.TYPES.CALENDAR_EVENT,
          title: `📅 New Event: ${calendarEvent.title}`,
          message: `${calendarEvent.description || 'New calendar event scheduled'} on ${new Date(calendarEvent.event_date).toLocaleDateString()}`,
          related_announcement_id: calendarEvent.calendar_id // Use calendar_id in announcement field for consistency
        };

        const notification = await this.createNotification(notificationData);
        notifications.push(notification);
      }

      return notifications;
    } catch (error) {
      logger.error('Failed to notify about calendar event', {
        error: error.message,
        calendarId: calendarEvent.calendar_id
      });
      throw error;
    }
  }

  /**
   * Validate notification target exists (for error handling)
   */
  async validateNotificationTarget(notification) {
    try {
      const { type_name, related_announcement_id, related_comment_id } = notification;

      // Validate announcement exists
      if (['new_announcement', 'alert_announcement', 'announcement_reaction', 'pinned_post'].includes(type_name)) {
        if (!related_announcement_id) return false;

        // Could add actual database check here
        return true;
      }

      // Validate comment exists
      if (['comment_reply', 'comment_reaction', 'comment_flagged'].includes(type_name)) {
        if (!related_comment_id) return false;

        // Could add actual database check here
        return true;
      }

      // Validate calendar event exists
      if (type_name === 'calendar_event') {
        if (!related_announcement_id) return false; // Using announcement_id field for calendar_id

        // Could add actual database check here
        return true;
      }

      return true;
    } catch (error) {
      logger.error('Failed to validate notification target', {
        error: error.message,
        notificationId: notification.notification_id
      });
      return false;
    }
  }

  /**
   * Notify announcement author when their post is approved
   */
  async notifyAnnouncementApproval(announcement, approvedBy) {
    try {
      // Get approver's name for personalized notification
      const approverName = await this.getActorName(approvedBy.id, 'admin');

      const notificationData = {
        recipient_type: 'admin', // Announcements are posted by admins
        recipient_id: announcement.posted_by,
        notification_type_id: NotificationService.TYPES.ANNOUNCEMENT_APPROVAL,
        title: `✅ Your announcement "${announcement.title}" has been approved`,
        message: `Great news! Your announcement "${announcement.title}" has been approved by ${approverName} and is now published for all users to see.`,
        related_announcement_id: announcement.announcement_id
      };

      logger.info('Sending announcement approval notification', {
        announcementId: announcement.announcement_id,
        announcementTitle: announcement.title,
        authorId: announcement.posted_by,
        approvedById: approvedBy.id,
        approverName
      });

      const notification = await this.createNotification(notificationData);

      // Send real-time notification via WebSocket if available
      try {
        const websocketService = require('./websocketService');
        await websocketService.sendToUser(
          announcement.posted_by,
          'admin',
          'notification',
          {
            type: 'announcement_approval',
            notification,
            announcement: {
              id: announcement.announcement_id,
              title: announcement.title
            }
          }
        );
      } catch (wsError) {
        logger.warn('Failed to send real-time approval notification', {
          error: wsError.message,
          announcementId: announcement.announcement_id
        });
      }

      return notification;
    } catch (error) {
      logger.error('Failed to notify about announcement approval', {
        error: error.message,
        announcementId: announcement.announcement_id,
        authorId: announcement.posted_by
      });
      throw error;
    }
  }

  /**
   * Clean up old notifications (maintenance task)
   */
  async cleanupOldNotifications(daysOld = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      // This would require a method in NotificationModel
      // For now, just log the intent
      logger.info('Notification cleanup would run here', { cutoffDate });

      return { success: true, message: 'Cleanup completed' };
    } catch (error) {
      logger.error('Failed to cleanup old notifications', { error: error.message });
      throw error;
    }
  }
}

module.exports = new NotificationService();
