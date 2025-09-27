const { asyncHandler } = require('../middleware/errorHandler');
const CommentModel = require('../models/CommentModel');
const AnnouncementModel = require('../models/AnnouncementModel');
const ReactionModel = require('../models/ReactionModel');
const notificationService = require('../services/notificationService');
const websocketService = require('../services/websocketService');

class CommentController {
  // Get comments for an announcement or calendar event
  getComments = asyncHandler(async (req, res) => {
    const {
      announcement_id,
      calendar_id,
      page = 1,
      limit = 20,
      sort_by = 'created_at',
      sort_order = 'ASC'
    } = req.query;

    // Convert string parameters to integers if they exist
    const parsedAnnouncementId = announcement_id ? parseInt(announcement_id) : null;
    const parsedCalendarId = calendar_id ? parseInt(calendar_id) : null;

    if (!parsedAnnouncementId && !parsedCalendarId) {
      return res.status(400).json({
        success: false,
        message: 'Either Announcement ID or Calendar ID is required',
      });
    }

    if (parsedAnnouncementId && parsedCalendarId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot specify both Announcement ID and Calendar ID',
      });
    }

    // Validate that the IDs are positive integers
    if (parsedAnnouncementId && (isNaN(parsedAnnouncementId) || parsedAnnouncementId <= 0)) {
      return res.status(400).json({
        success: false,
        message: 'Announcement ID must be a positive integer',
      });
    }

    if (parsedCalendarId && (isNaN(parsedCalendarId) || parsedCalendarId <= 0)) {
      return res.status(400).json({
        success: false,
        message: 'Calendar ID must be a positive integer',
      });
    }

    const pagination = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort_by,
      sort_order
    };

    const options = {
      userId: req.user?.id,
      userType: req.user?.role
    };

    let result;
    if (parsedAnnouncementId) {
      result = await CommentModel.getCommentsByAnnouncement(
        parsedAnnouncementId,
        pagination,
        options
      );
    } else if (parsedCalendarId) {
      result = await CommentModel.getCommentsByCalendar(
        parsedCalendarId,
        pagination,
        options
      );
    }

    res.status(200).json({
      success: true,
      message: 'Comments retrieved successfully',
      data: result,
    });
  });

  // Get single comment
  getComment = asyncHandler(async (req, res) => {
    const { commentId } = req.params;
    const userId = req.user?.id;
    const userType = req.user?.role;

    const comment = await CommentModel.getCommentById(
      parseInt(commentId),
      userId,
      userType
    );

    res.status(200).json({
      success: true,
      message: 'Comment retrieved successfully',
      data: { comment },
    });
  });

  // Get comments for a calendar event (dedicated route)
  getCalendarComments = asyncHandler(async (req, res) => {
    const { calendarId } = req.params;
    const {
      page = 1,
      limit = 20,
      sort_by = 'created_at',
      sort_order = 'ASC'
    } = req.query;

    const parsedCalendarId = parseInt(calendarId);

    if (isNaN(parsedCalendarId) || parsedCalendarId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Calendar ID must be a positive integer',
      });
    }

    const pagination = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort_by,
      sort_order
    };

    const options = {
      userId: req.user?.id,
      userType: req.user?.role
    };

    const result = await CommentModel.getCommentsByCalendar(
      parsedCalendarId,
      pagination,
      options
    );

    res.status(200).json({
      success: true,
      message: 'Calendar comments retrieved successfully',
      data: result
    });
  });

  // Create calendar comment (dedicated route)
  createCalendarComment = asyncHandler(async (req, res) => {
    const { calendarId } = req.params;
    const {
      parent_comment_id,
      comment_text,
      is_anonymous = 0
    } = req.body;

    // Debug logging for anonymous comment functionality
    console.log('🔍 CommentController.createCalendarComment - Request data:', {
      is_anonymous_raw: is_anonymous,
      is_anonymous_type: typeof is_anonymous,
      req_body: req.body,
      user: { id: req.user.id, role: req.user.role }
    });

    const parsedCalendarId = parseInt(calendarId);

    if (isNaN(parsedCalendarId) || parsedCalendarId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Calendar ID must be a positive integer',
      });
    }

    if (!comment_text || comment_text.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Comment text is required',
      });
    }

    const commentData = {
      announcement_id: null, // Explicitly set to null for calendar comments
      calendar_id: parsedCalendarId,
      parent_comment_id: parent_comment_id ? parseInt(parent_comment_id) : null,
      user_type: req.user.role,
      user_id: req.user.id,
      comment_text: comment_text.trim(),
      is_anonymous: is_anonymous === true || is_anonymous === 'true' || is_anonymous === 1 || is_anonymous === '1' ? 1 : 0
    };

    // Debug the conversion result
    console.log('🔍 CommentController.createCalendarComment - Processed data:', {
      original_is_anonymous: is_anonymous,
      processed_is_anonymous: commentData.is_anonymous,
      conversion_result: is_anonymous === true || is_anonymous === 'true' || is_anonymous === 1 || is_anonymous === '1' ? 1 : 0
    });

    const comment = await CommentModel.createComment(commentData);

    // Send notifications and broadcast updates for calendar events
    try {
      const CalendarModel = require('../models/CalendarModel');
      const notificationService = require('../services/notificationService');

      const calendarEvent = await CalendarModel.getEventById(parsedCalendarId);

      if (parent_comment_id) {
        // This is a reply to another comment - notify the parent comment author
        const parentComment = await CommentModel.getCommentById(parseInt(parent_comment_id));
        await notificationService.notifyCalendarCommentReply(
          comment,
          parentComment,
          calendarEvent
        );
      } else {
        // This is a top-level comment - notify the calendar event author
        await notificationService.notifyCalendarComment(
          comment,
          calendarEvent
        );
      }

      // Broadcast real-time comment update
      websocketService.getIO()?.emit('new-calendar-comment', {
        calendarId: parsedCalendarId,
        comment: comment,
        parentCommentId: parent_comment_id
      });
    } catch (notificationError) {
      console.error('Failed to send calendar comment notification:', notificationError);
      // Don't fail the main request if notification fails
    }

    res.status(201).json({
      success: true,
      message: 'Calendar comment created successfully',
      data: { comment }
    });
  });

  // Create comment
  createComment = asyncHandler(async (req, res) => {
    const {
      announcement_id,
      calendar_id,
      parent_comment_id,
      comment_text,
      is_anonymous = 0
    } = req.body;

    // Debug logging for anonymous comment functionality
    console.log('🔍 CommentController.createComment - Request data:', {
      is_anonymous_raw: is_anonymous,
      is_anonymous_type: typeof is_anonymous,
      req_body: req.body,
      user: { id: req.user.id, role: req.user.role }
    });

    if (!announcement_id && !calendar_id) {
      return res.status(400).json({
        success: false,
        message: 'Either Announcement ID or Calendar ID is required',
      });
    }

    if (announcement_id && calendar_id) {
      return res.status(400).json({
        success: false,
        message: 'Cannot specify both Announcement ID and Calendar ID',
      });
    }

    const commentData = {
      announcement_id: announcement_id ? parseInt(announcement_id) : null,
      calendar_id: calendar_id ? parseInt(calendar_id) : null,
      parent_comment_id: parent_comment_id ? parseInt(parent_comment_id) : null,
      user_type: req.user.role,
      user_id: req.user.id,
      comment_text,
      is_anonymous: is_anonymous === true || is_anonymous === 'true' || is_anonymous === 1 || is_anonymous === '1' ? 1 : 0
    };

    // Debug the conversion result
    console.log('🔍 CommentController.createComment - Processed data:', {
      original_is_anonymous: is_anonymous,
      processed_is_anonymous: commentData.is_anonymous,
      conversion_result: is_anonymous === true || is_anonymous === 'true' || is_anonymous === 1 || is_anonymous === '1' ? 1 : 0
    });

    const comment = await CommentModel.createComment(commentData);

    // Send notifications for comments
    try {
      if (announcement_id) {
        const announcement = await AnnouncementModel.getAnnouncementById(parseInt(announcement_id));

        if (parent_comment_id) {
          // This is a reply to another comment - notify the parent comment author
          const parentComment = await CommentModel.getCommentById(parseInt(parent_comment_id));
          await notificationService.notifyCommentReply(
            comment,
            parentComment,
            announcement
          );
        } else {
          // This is a top-level comment - notify the announcement author with grade-level filtering
          await notificationService.notifyAnnouncementComment(
            comment,
            announcement
          );
        }

        // Broadcast real-time comment update
        websocketService.getIO()?.emit('new-comment', {
          announcementId: parseInt(announcement_id),
          comment: comment,
          parentCommentId: parent_comment_id
        });
      } else if (calendar_id) {
        // Handle calendar comment notifications
        const CalendarModel = require('../models/CalendarModel');
        const calendarEvent = await CalendarModel.getEventById(parseInt(calendar_id));

        if (parent_comment_id) {
          // This is a reply to another comment - notify the parent comment author
          const parentComment = await CommentModel.getCommentById(parseInt(parent_comment_id));
          await notificationService.notifyCalendarCommentReply(
            comment,
            parentComment,
            calendarEvent
          );
        } else {
          // This is a top-level comment - notify the calendar event author
          await notificationService.notifyCalendarComment(
            comment,
            calendarEvent
          );
        }

        // Broadcast real-time comment update
        websocketService.getIO()?.emit('new-calendar-comment', {
          calendarId: parseInt(calendar_id),
          comment: comment,
          parentCommentId: parent_comment_id
        });
      }
    } catch (notificationError) {
      console.error('Failed to send comment notification:', notificationError);
      // Don't fail the main request if notification fails
    }

    res.status(201).json({
      success: true,
      message: 'Comment created successfully',
      data: { comment },
    });
  });

  // Update comment
  updateComment = asyncHandler(async (req, res) => {
    const { commentId } = req.params;
    const updateData = req.body;
    const userId = req.user.id;
    const userType = req.user.role;

    const comment = await CommentModel.updateComment(
      parseInt(commentId),
      updateData,
      userId,
      userType
    );

    res.status(200).json({
      success: true,
      message: 'Comment updated successfully',
      data: { comment },
    });
  });

  // Delete comment
  deleteComment = asyncHandler(async (req, res) => {
    const { commentId } = req.params;
    const userId = req.user.id;
    const userType = req.user.role;

    await CommentModel.deleteComment(
      parseInt(commentId),
      userId,
      userType
    );

    res.status(200).json({
      success: true,
      message: 'Comment deleted successfully',
    });
  });

  // Add reaction to comment
  likeComment = asyncHandler(async (req, res) => {
    const { commentId } = req.params;
    const { reaction_id = 1 } = req.body; // Default to 'like' reaction
    const userId = req.user.id;
    const userType = req.user.role;

    await CommentModel.addReaction(
      parseInt(commentId),
      userId,
      userType,
      parseInt(reaction_id)
    );

    // Send notification and real-time update
    try {
      const comment = await CommentModel.getCommentById(parseInt(commentId));
      const reactionType = await ReactionModel.findById(parseInt(reaction_id));

      // Notify comment author (if not reacting to own comment)
      if (!(comment.user_type === userType && comment.user_id === userId)) {
        if (comment.announcement_id) {
          // This is an announcement comment
          const announcement = await AnnouncementModel.getAnnouncementById(comment.announcement_id);
          await notificationService.notifyCommentReaction(
            comment,
            reactionType,
            { id: userId, type: userType },
            announcement
          );
        } else if (comment.calendar_id) {
          // This is a calendar comment - create a simplified notification
          const CalendarModel = require('../models/CalendarModel');
          const calendarEvent = await CalendarModel.getEventById(comment.calendar_id);

          // Use the existing comment reaction notification but with calendar context
          await notificationService.notifyCommentReaction(
            comment,
            reactionType,
            { id: userId, type: userType },
            { title: calendarEvent.title, announcement_id: calendarEvent.calendar_id } // Mock announcement structure
          );
        }
      }

      // Broadcast real-time update
      websocketService.broadcastCommentReaction({
        comment_id: parseInt(commentId),
        reaction_id: parseInt(reaction_id),
        user_id: userId,
        user_type: userType,
        action: 'added'
      });
    } catch (notificationError) {
      console.error('Failed to send comment reaction notification:', notificationError);
      // Don't fail the main request if notification fails
    }

    res.status(200).json({
      success: true,
      message: 'Reaction added successfully',
    });
  });

  // Remove reaction from comment
  unlikeComment = asyncHandler(async (req, res) => {
    const { commentId } = req.params;
    const userId = req.user.id;
    const userType = req.user.role;

    const result = await CommentModel.removeReaction(
      parseInt(commentId),
      userId,
      userType
    );

    // Broadcast real-time update if reaction was removed
    if (result.removed) {
      try {
        websocketService.broadcastCommentReaction({
          comment_id: parseInt(commentId),
          reaction_id: null,
          user_id: userId,
          user_type: userType,
          action: 'removed'
        });
      } catch (error) {
        console.error('Failed to broadcast comment reaction removal:', error);
      }
    }

    res.status(200).json({
      success: true,
      message: result.removed ? 'Reaction removed successfully' : 'No reaction to remove',
      data: { removed: result.removed },
    });
  });

  // Flag comment
  flagComment = asyncHandler(async (req, res) => {
    const { commentId } = req.params;
    const { reason } = req.body;
    const flaggedBy = req.user.id;

    await CommentModel.flagComment(
      parseInt(commentId),
      flaggedBy,
      reason
    );

    res.status(200).json({
      success: true,
      message: 'Comment flagged successfully',
    });
  });

  // Get flagged comments (admin only)
  getFlaggedComments = asyncHandler(async (req, res) => {
    const {
      page = 1,
      limit = 20,
      sort_by = 'flagged_at',
      sort_order = 'DESC'
    } = req.query;

    const pagination = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort_by,
      sort_order
    };

    const result = await CommentModel.getFlaggedComments(pagination);

    res.status(200).json({
      success: true,
      message: 'Flagged comments retrieved successfully',
      data: result,
    });
  });

  // Approve comment (admin only)
  approveComment = asyncHandler(async (req, res) => {
    const { commentId } = req.params;

    await CommentModel.approveComment(parseInt(commentId));

    res.status(200).json({
      success: true,
      message: 'Comment approved successfully',
    });
  });

  // Reject comment (admin only)
  rejectComment = asyncHandler(async (req, res) => {
    const { commentId } = req.params;

    await CommentModel.rejectComment(parseInt(commentId));

    res.status(200).json({
      success: true,
      message: 'Comment rejected successfully',
    });
  });

  // Get comment reaction statistics
  getCommentReactionStats = asyncHandler(async (req, res) => {
    const { commentId } = req.params;

    const stats = await ReactionModel.getCommentReactionStats(
      commentId ? parseInt(commentId) : null
    );

    res.status(200).json({
      success: true,
      message: 'Comment reaction statistics retrieved successfully',
      data: { stats },
    });
  });
}

module.exports = new CommentController();
