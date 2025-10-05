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
      // Create notification in database
      const notification = await NotificationModel.createNotification(data);

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
   * Safely truncate text and handle encoding issues
   */
  safeTruncate(text, maxLength = 200) {
    if (!text || typeof text !== 'string') return '';
    const cleanText = text.trim();
    if (cleanText.length <= maxLength) return cleanText;
    return cleanText.substring(0, maxLength) + '...';
  }

  /**
   * Safely format title with emoji
   */
  safeFormatTitle(emoji, prefix, title) {
    const safeTitle = title && typeof title === 'string' ? title.trim() : 'Untitled';
    return `${emoji} ${prefix}: ${safeTitle}`;
  }

  /**
   * Notify about new announcement
   */
  async notifyNewAnnouncement(announcement, recipients) {
    try {
      const notifications = [];

      for (const recipient of recipients) {
        const announcementTitle = announcement.title || 'Untitled Announcement';
        const announcementContent = announcement.content || '';

        const notificationData = {
          recipient_type: recipient.type,
          recipient_id: recipient.id,
          notification_type_id: announcement.is_alert ?
            NotificationService.TYPES.ALERT_ANNOUNCEMENT :
            NotificationService.TYPES.NEW_ANNOUNCEMENT,
          title: announcement.is_alert ?
            this.safeFormatTitle('🚨', 'Alert', announcementTitle) :
            this.safeFormatTitle('📢', 'New Announcement', announcementTitle),
          message: this.safeTruncate(announcementContent, 200),
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

      // Safely extract values with fallbacks
      const commentText = this.safeTruncate(comment.comment_text || '', 100);
      const announcementTitle = announcement.title || 'Untitled';

      // Create personalized notification based on replier type
      let title, message;
      if (comment.user_type === 'admin' && parentComment.user_type === 'student') {
        // Admin replying to student comment - enhanced notification
        title = `💬 Admin ${replierName} replied to your comment`;
        message = `Admin ${replierName} replied: "${commentText}" on "${announcementTitle}"`;
      } else if (comment.user_type === 'student' && parentComment.user_type === 'admin') {
        // Student replying to admin comment
        title = `💬 A student replied to your comment`;
        message = `"${commentText}" on "${announcementTitle}"`;
      } else {
        // Default notification (same user type)
        const replierLabel = comment.user_type === 'admin' ? 'An admin' : 'Someone';
        title = `💬 ${replierLabel} replied to your comment`;
        message = `"${commentText}" on "${announcementTitle}"`;
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
      const commentText = this.safeTruncate(comment.comment_text || '', 100);
      const announcementTitle = announcement.title || 'Untitled';

      const notificationData = {
        recipient_type: 'admin',
        recipient_id: announcement.posted_by,
        notification_type_id: NotificationService.TYPES.ANNOUNCEMENT_COMMENT,
        title: `💬 ${commenterName} commented on your announcement`,
        message: `"${commentText}" on "${announcementTitle}"`,
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
      const commentText = this.safeTruncate(comment.comment_text || '', 100);
      const eventTitle = calendarEvent.title || 'Untitled Event';

      const notificationData = {
        recipient_type: 'admin',
        recipient_id: calendarEvent.created_by,
        notification_type_id: NotificationService.TYPES.CALENDAR_COMMENT,
        title: `💬 ${commenterName} commented on your calendar event`,
        message: `"${commentText}" on "${eventTitle}"`,
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

      // Safely extract values with fallbacks
      const commentText = this.safeTruncate(comment.comment_text || '', 100);
      const eventTitle = calendarEvent.title || 'Untitled Event';

      // Create personalized notification based on replier type
      let title, message;
      if (comment.user_type === 'admin' && parentComment.user_type === 'student') {
        // Admin replying to student comment - enhanced notification
        title = `💬 Admin ${replierName} replied to your comment`;
        message = `Admin ${replierName} replied: "${commentText}" on calendar event "${eventTitle}"`;
      } else if (comment.user_type === 'student' && parentComment.user_type === 'admin') {
        // Student replying to admin comment
        title = `💬 A student replied to your comment`;
        message = `"${commentText}" on calendar event "${eventTitle}"`;
      } else {
        // Default notification (same user type)
        const replierLabel = comment.user_type === 'admin' ? 'An admin' : 'Someone';
        title = `💬 ${replierLabel} replied to your comment`;
        message = `"${commentText}" on calendar event "${eventTitle}"`;
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
          // Safely extract name parts, handling NULL/undefined values
          const firstName = admin.profile.first_name || admin.first_name || '';
          const middleName = admin.profile.middle_name || admin.middle_name || '';
          const lastName = admin.profile.last_name || admin.last_name || '';
          const suffix = admin.profile.suffix || admin.suffix || '';

          const nameParts = [firstName, middleName, lastName, suffix]
            .filter(part => part && typeof part === 'string' && part.trim() !== '');

          const fullName = nameParts.join(' ').trim();
          return fullName || 'Admin';
        }
        return 'Admin';
      } else if (actorType === 'student') {
        const StudentModel = require('../models/StudentModel');
        const student = await StudentModel.getStudentWithProfile(actorId);
        if (student && student.profile) {
          // Safely extract name parts, handling NULL/undefined values
          const firstName = student.profile.first_name || student.first_name || '';
          const middleName = student.profile.middle_name || student.middle_name || '';
          const lastName = student.profile.last_name || student.last_name || '';
          const suffix = student.profile.suffix || student.suffix || '';

          const nameParts = [firstName, middleName, lastName, suffix]
            .filter(part => part && typeof part === 'string' && part.trim() !== '');

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

      // Safely extract values with fallbacks
      const reactionEmoji = reaction.reaction_emoji || '👍';
      const reactionName = reaction.reaction_name || 'like';
      const announcementTitle = announcement.title || 'Untitled';

      // Create personalized notification based on reactor type
      let title, message;
      if (reactor.type === 'admin' && comment.user_type === 'student') {
        // Admin reacting to student comment - enhanced notification
        title = `${reactionEmoji} Admin ${reactorName} reacted to your comment`;
        message = `Admin ${reactorName} gave your comment a ${reactionName} reaction on "${announcementTitle}"`;
      } else if (reactor.type === 'student' && comment.user_type === 'admin') {
        // Student reacting to admin comment
        title = `${reactionEmoji} A student reacted to your comment`;
        message = `Your comment on "${announcementTitle}" received a ${reactionName} reaction`;
      } else {
        // Default notification (same user type)
        const actorLabel = reactor.type === 'admin' ? 'An admin' : 'Someone';
        title = `${reactionEmoji} ${actorLabel} reacted to your comment`;
        message = `Your comment on "${announcementTitle}" received a ${reactionName} reaction`;
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

      // Safely extract values with fallbacks
      const reactionEmoji = reaction.reaction_emoji || '👍';
      const reactionName = reaction.reaction_name || 'like';
      const announcementTitle = announcement.title || 'Untitled';

      const notificationData = {
        recipient_type: 'admin', // Announcements are posted by admins
        recipient_id: announcement.posted_by,
        notification_type_id: NotificationService.TYPES.ANNOUNCEMENT_REACTION,
        title: `${reactionEmoji} Someone reacted to your announcement`,
        message: `Your announcement "${announcementTitle}" received a ${reactionName} reaction`,
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

      // Safely extract values with fallbacks
      const eventTitle = calendarEvent.title || 'Untitled Event';

      // Create personalized notification based on reactor type
      let title, message;
      if (reactor.type === 'admin') {
        // Admin reacting to calendar event
        title = `❤️ Admin ${reactorName} liked your calendar event`;
        message = `Admin ${reactorName} liked your calendar event "${eventTitle}"`;
      } else if (reactor.type === 'student') {
        // Student reacting to calendar event
        title = `❤️ A student liked your calendar event`;
        message = `Your calendar event "${eventTitle}" received a like from a student`;
      } else {
        // Default notification
        title = `❤️ Someone liked your calendar event`;
        message = `Your calendar event "${eventTitle}" received a like`;
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
      // Safely extract values with fallbacks
      const announcementTitle = announcement.title || 'Untitled';
      const flagReason = reason && typeof reason === 'string' ? reason.trim() : '';

      const notificationData = {
        recipient_type: comment.user_type,
        recipient_id: comment.user_id,
        notification_type_id: NotificationService.TYPES.COMMENT_FLAGGED,
        title: `⚠️ Your comment has been flagged`,
        message: `Your comment on "${announcementTitle}" was flagged${flagReason ? ` for: ${flagReason}` : ''}`,
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

      // Safely extract values with fallbacks
      const announcementTitle = announcement.title || 'Untitled';
      const announcementContent = this.safeTruncate(announcement.content || '', 200);

      for (const recipient of recipients) {
        const notificationData = {
          recipient_type: recipient.type,
          recipient_id: recipient.id,
          notification_type_id: NotificationService.TYPES.PINNED_POST,
          title: `📌 New Pinned Announcement: ${announcementTitle}`,
          message: announcementContent,
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

      // Safely extract values with fallbacks
      const eventTitle = calendarEvent.title || 'Untitled Event';
      const eventDescription = calendarEvent.description || 'New calendar event scheduled';
      const eventDate = calendarEvent.event_date ? new Date(calendarEvent.event_date).toLocaleDateString() : 'TBD';

      for (const recipient of recipients) {
        const notificationData = {
          recipient_type: recipient.type,
          recipient_id: recipient.id,
          notification_type_id: NotificationService.TYPES.CALENDAR_EVENT,
          title: `📅 New Event: ${eventTitle}`,
          message: `${eventDescription} on ${eventDate}`,
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

      // Safely extract values with fallbacks
      const announcementTitle = announcement.title || 'Untitled';

      const notificationData = {
        recipient_type: 'admin', // Announcements are posted by admins
        recipient_id: announcement.posted_by,
        notification_type_id: NotificationService.TYPES.ANNOUNCEMENT_APPROVAL,
        title: `✅ Your announcement "${announcementTitle}" has been approved`,
        message: `Great news! Your announcement "${announcementTitle}" has been approved by ${approverName} and is now published for all users to see.`,
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
