const { asyncHandler } = require('../middleware/errorHandler');
const CalendarModel = require('../models/CalendarModel');
const StudentModel = require('../models/StudentModel');
const SMSNotificationModel = require('../models/SMSNotificationModel');
const smsService = require('../services/smsService');
const { deleteCalendarUploadedFile, getCalendarImageUrl, validateImageSignature } = require('../middleware/calendarUpload');

class CalendarController {
  constructor() {
    this.studentModel = StudentModel;
    this.smsNotificationModel = new SMSNotificationModel();
  }

  // Get calendar events
  getEvents = asyncHandler(async (req, res) => {
    const {
      page = 1,
      limit = 50,
      start_date,
      end_date,
      category_id,
      subcategory_id,
      is_active,
      is_recurring,
      search,
      sort_by = 'event_date',
      sort_order = 'ASC'
    } = req.query;

    const filters = {
      start_date,
      end_date,
      category_id: category_id ? parseInt(category_id) : undefined,
      subcategory_id: subcategory_id ? parseInt(subcategory_id) : undefined,
      is_active: is_active !== undefined ? parseInt(is_active) : undefined,
      is_recurring: is_recurring !== undefined ? parseInt(is_recurring) : undefined,
      search
    };

    const pagination = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort_by,
      sort_order
    };

    // Pass user info for reaction status if user is authenticated
    const userId = req.user?.id || null;
    const userType = req.user?.role || null;

    const result = await CalendarModel.getEvents(filters, pagination, userId, userType);

    res.status(200).json({
      success: true,
      message: 'Calendar events retrieved successfully',
      data: result,
    });
  });

  // Get single calendar event
  getEvent = asyncHandler(async (req, res) => {
    const { eventId } = req.params;

    const event = await CalendarModel.getEventById(parseInt(eventId));

    res.status(200).json({
      success: true,
      message: 'Calendar event retrieved successfully',
      data: { event },
    });
  });

  // Create calendar event (admin only)
  createEvent = asyncHandler(async (req, res) => {
    const {
      title,
      description,
      event_date,
      end_date,
      category_id,
      subcategory_id,
      is_recurring = 0,
      recurrence_pattern,
      is_active = 1,
      is_published = 0,
      allow_comments = 1,
      is_alert = 0
    } = req.body;

    const eventData = {
      title,
      description,
      event_date,
      end_date,
      category_id: category_id ? parseInt(category_id) : null,
      subcategory_id: subcategory_id ? parseInt(subcategory_id) : null,
      is_recurring: is_recurring ? 1 : 0,
      recurrence_pattern,
      is_active: is_active ? 1 : 0,
      is_published: is_published ? 1 : 0,
      allow_comments: allow_comments ? 1 : 0,
      is_alert: is_alert ? 1 : 0,
      created_by: req.user.id
    };

    const event = await CalendarModel.createEvent(eventData);

    // Send SMS notifications if event is marked as alert
    if (is_alert) {
      try {
        console.log('📅 Calendar event is marked as alert, sending SMS notifications...');
        console.log('📅 Event details:', {
          title: event.title,
          event_date: event.event_date,
          is_alert: is_alert
        });

        // Check if SMS service is enabled
        if (!smsService.isServiceEnabled()) {
          console.log('❌ SMS service is not enabled, skipping notifications');
          // Continue with event creation but log the issue
        } else {
          console.log('✅ SMS service is enabled, proceeding with notifications');

          // Get all active students (no grade level filtering for calendar events)
          const students = await this.studentModel.getActiveStudentsForSMS();
          console.log(`📅 Found ${students.length} active students for SMS`);

          if (students.length > 0) {
            // Extract phone numbers
            const phoneNumbers = students.map(student => student.phone_number);
            console.log('📅 Phone numbers to send to:', phoneNumbers.map(p => p.substring(0, 6) + '...'));

            // Send SMS using the SMS service
            const smsResult = await smsService.sendCalendarAlert(event, phoneNumbers);
            console.log('📅 SMS sending result:', smsResult);

            // Create SMS notification records for tracking
            if (smsResult.sent > 0) {
              const smsNotifications = [];

              // Create notification records for successful sends
              for (const student of students) {
                if (smsService.validatePhoneNumber(student.phone_number)) {
                  smsNotifications.push({
                    notification_id: null, // We don't have a specific notification ID for this
                    phone_number: smsService.formatPhoneNumber(student.phone_number),
                    message: `VCBA CALENDAR ALERT: ${event.title}`,
                    status: smsResult.success ? 'sent' : 'failed',
                    error_message: smsResult.success ? null : smsResult.error
                  });
                }
              }

              if (smsNotifications.length > 0) {
                await this.smsNotificationModel.createBulkSMSNotifications(smsNotifications);
                console.log(`📅 Created ${smsNotifications.length} SMS notification records`);
              }
            }

            console.log(`📅 SMS Alert sent to ${smsResult.sent} students for calendar event: ${event.title}`);
          } else {
            console.log('📅 No active students found for SMS notifications');
          }
        }
      } catch (smsError) {
        // Log the error but don't fail the event creation process
        console.error('Failed to send SMS notifications for calendar event:', smsError);
      }
    } else {
      console.log('📅 Calendar event is not marked as alert, skipping SMS notifications');
    }

    res.status(201).json({
      success: true,
      message: 'Calendar event created successfully',
      data: { event },
    });
  });

  // Update calendar event (admin only)
  updateEvent = asyncHandler(async (req, res) => {
    const { eventId } = req.params;
    const rawData = req.body;

    // Process the update data similar to create
    const updateData = {};

    if (rawData.title !== undefined) updateData.title = rawData.title;
    if (rawData.description !== undefined) updateData.description = rawData.description;
    if (rawData.event_date !== undefined) updateData.event_date = rawData.event_date;
    if (rawData.end_date !== undefined) updateData.end_date = rawData.end_date;
    if (rawData.category_id !== undefined) updateData.category_id = parseInt(rawData.category_id);
    if (rawData.subcategory_id !== undefined) updateData.subcategory_id = rawData.subcategory_id ? parseInt(rawData.subcategory_id) : null;
    if (rawData.is_recurring !== undefined) updateData.is_recurring = rawData.is_recurring ? 1 : 0;
    if (rawData.recurrence_pattern !== undefined) updateData.recurrence_pattern = rawData.recurrence_pattern;
    if (rawData.is_active !== undefined) updateData.is_active = rawData.is_active ? 1 : 0;
    if (rawData.allow_comments !== undefined) updateData.allow_comments = rawData.allow_comments ? 1 : 0;
    if (rawData.is_alert !== undefined) updateData.is_alert = rawData.is_alert ? 1 : 0;

    const event = await CalendarModel.updateEvent(parseInt(eventId), updateData);

    res.status(200).json({
      success: true,
      message: 'Calendar event updated successfully',
      data: { event },
    });
  });

  // Delete calendar event (admin only)
  deleteEvent = asyncHandler(async (req, res) => {
    const { eventId } = req.params;

    await CalendarModel.deleteEvent(parseInt(eventId));

    res.status(200).json({
      success: true,
      message: 'Calendar event deleted successfully',
    });
  });

  // Get events by date
  getEventsByDate = asyncHandler(async (req, res) => {
    const { date } = req.params;

    const events = await CalendarModel.getEventsByDate(date);

    res.status(200).json({
      success: true,
      message: 'Events retrieved successfully',
      data: { events },
    });
  });

  // Get events by date range
  getEventsByDateRange = asyncHandler(async (req, res) => {
    const { start_date, end_date } = req.query;

    if (!start_date || !end_date) {
      return res.status(400).json({
        success: false,
        message: 'Start date and end date are required',
      });
    }

    const events = await CalendarModel.getEventsByDateRange(start_date, end_date);

    res.status(200).json({
      success: true,
      message: 'Events retrieved successfully',
      data: { events },
    });
  });

  // Get calendar view (month/year)
  getCalendarView = asyncHandler(async (req, res) => {
    const { year, month } = req.query;

    if (!year) {
      return res.status(400).json({
        success: false,
        message: 'Year is required',
      });
    }

    const events = await CalendarModel.getCalendarEvents(
      parseInt(year),
      month ? parseInt(month) : null
    );

    res.status(200).json({
      success: true,
      message: 'Calendar view retrieved successfully',
      data: { events },
    });
  });



  // Get categories with subcategories for calendar events
  getCategoriesWithSubcategories = asyncHandler(async (req, res) => {
    const categories = await CalendarModel.getCategoriesWithSubcategories();

    res.status(200).json({
      success: true,
      message: 'Categories retrieved successfully',
      data: { categories },
    });
  });

  // Get active categories with active subcategories for calendar events
  getActiveCategoriesWithSubcategories = asyncHandler(async (req, res) => {
    const categories = await CalendarModel.getActiveCategoriesWithSubcategories();

    res.status(200).json({
      success: true,
      message: 'Active categories retrieved successfully',
      data: { categories },
    });
  });

  // Get events for current month
  getCurrentMonthEvents = asyncHandler(async (req, res) => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    const events = await CalendarModel.getCalendarEvents(year, month);

    res.status(200).json({
      success: true,
      message: 'Current month events retrieved successfully',
      data: { events, year, month },
    });
  });

  // Get upcoming events
  getUpcomingEvents = asyncHandler(async (req, res) => {
    const { limit = 10 } = req.query;
    const today = new Date().toISOString().split('T')[0];
    const futureDate = new Date();
    futureDate.setMonth(futureDate.getMonth() + 3); // 3 months ahead
    const endDate = futureDate.toISOString().split('T')[0];

    const filters = {
      start_date: today,
      end_date: endDate,
      is_active: 1
    };

    const pagination = {
      page: 1,
      limit: parseInt(limit),
      sort_by: 'event_date',
      sort_order: 'ASC'
    };

    const result = await CalendarModel.getEvents(filters, pagination);

    res.status(200).json({
      success: true,
      message: 'Upcoming events retrieved successfully',
      data: { events: result.events },
    });
  });

  // Get event attachments
  getEventAttachments = asyncHandler(async (req, res) => {
    const { eventId } = req.params;
    const attachments = await CalendarModel.getAttachmentsByCalendarId(parseInt(eventId));

    res.status(200).json({
      success: true,
      message: 'Event attachments retrieved successfully',
      data: { attachments },
    });
  });

  // Upload event attachment
  uploadEventAttachment = asyncHandler(async (req, res) => {
    const { eventId } = req.params;

    // Check if files were uploaded
    if (!req.uploadedCalendarImages || req.uploadedCalendarImages.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No images were uploaded',
      });
    }

    const attachments = [];

    try {
      // Process each uploaded image
      for (const [index, uploadedImage] of req.uploadedCalendarImages.entries()) {
        // Validate image signature for security
        const fullPath = `public${uploadedImage.path}`;
        const detectedMimeType = validateImageSignature(fullPath);

        if (!detectedMimeType || detectedMimeType !== uploadedImage.mimetype) {
          // Delete the invalid file
          deleteCalendarUploadedFile(uploadedImage.filename);
          throw new Error(`Invalid image file: ${uploadedImage.originalName}`);
        }

        const attachmentData = {
          calendar_id: parseInt(eventId),
          file_name: uploadedImage.originalName,
          file_path: uploadedImage.path,
          file_type: 'image',
          file_size: uploadedImage.size,
          mime_type: uploadedImage.mimetype,
          display_order: index,
          is_primary: index === 0 ? 1 : 0 // First image is primary by default
        };

        const attachment = await CalendarModel.createAttachment(attachmentData);
        attachments.push(attachment);
      }

      res.status(201).json({
        success: true,
        message: `${attachments.length} event attachment(s) uploaded successfully`,
        data: { attachments },
      });
    } catch (error) {
      // Clean up uploaded files on error
      req.uploadedCalendarImages.forEach(image => {
        deleteCalendarUploadedFile(image.filename);
      });
      throw error;
    }
  });

  // Delete event attachment
  deleteEventAttachment = asyncHandler(async (req, res) => {
    const { attachmentId } = req.params;

    // Get attachment info before deletion for file cleanup
    const attachment = await CalendarModel.getAttachmentById(parseInt(attachmentId));

    if (!attachment) {
      return res.status(404).json({
        success: false,
        message: 'Attachment not found',
      });
    }

    // Soft delete the attachment
    await CalendarModel.deleteAttachment(parseInt(attachmentId));

    // Extract filename from path for cleanup
    const filename = attachment.file_path.split('/').pop();
    if (filename) {
      deleteCalendarUploadedFile(filename);
    }

    res.status(200).json({
      success: true,
      message: 'Event attachment deleted successfully',
    });
  });

  // Set primary attachment
  setPrimaryAttachment = asyncHandler(async (req, res) => {
    const { eventId, attachmentId } = req.params;
    await CalendarModel.setPrimaryAttachment(parseInt(eventId), parseInt(attachmentId));

    res.status(200).json({
      success: true,
      message: 'Primary attachment set successfully',
    });
  });

  // Publish event
  publishEvent = asyncHandler(async (req, res) => {
    const { eventId } = req.params;
    const event = await CalendarModel.publishEvent(parseInt(eventId));

    res.status(200).json({
      success: true,
      message: 'Event published successfully',
      data: { event },
    });
  });

  // Unpublish event
  unpublishEvent = asyncHandler(async (req, res) => {
    const { eventId } = req.params;
    const event = await CalendarModel.unpublishEvent(parseInt(eventId));

    res.status(200).json({
      success: true,
      message: 'Event unpublished successfully',
      data: { event },
    });
  });

  // Soft delete event
  softDeleteEvent = asyncHandler(async (req, res) => {
    const { eventId } = req.params;
    await CalendarModel.softDeleteEvent(parseInt(eventId));

    res.status(200).json({
      success: true,
      message: 'Event deleted successfully',
    });
  });

  // Restore event
  restoreEvent = asyncHandler(async (req, res) => {
    const { eventId } = req.params;
    await CalendarModel.restoreEvent(parseInt(eventId));

    res.status(200).json({
      success: true,
      message: 'Event restored successfully',
    });
  });

  // Add reaction to calendar event
  likeCalendarEvent = asyncHandler(async (req, res) => {
    const { eventId } = req.params;
    const userId = req.user.id;
    const userType = req.user.role;

    const result = await CalendarModel.addReaction(
      parseInt(eventId),
      userId,
      userType
    );

    // Send notification and real-time update if reaction was added
    if (result.added) {
      try {
        const notificationService = require('../services/notificationService');
        const websocketService = require('../services/websocketService');

        const calendarEvent = await CalendarModel.getEventById(parseInt(eventId));

        // Notify calendar event author (if not reacting to own event)
        if (!(calendarEvent.created_by === userId && userType === 'admin')) {
          await notificationService.notifyCalendarReaction(
            calendarEvent,
            { id: userId, type: userType }
          );
        }

        // Broadcast real-time update
        websocketService.broadcastCalendarReaction({
          calendar_id: parseInt(eventId),
          user_id: userId,
          user_type: userType,
          action: 'added'
        });
      } catch (error) {
        console.error('Failed to send calendar reaction notification:', error);
        // Don't fail the main request if notification fails
      }
    }

    res.status(200).json({
      success: true,
      message: result.message,
      data: { added: result.added },
    });
  });

  // Remove reaction from calendar event
  unlikeCalendarEvent = asyncHandler(async (req, res) => {
    const { eventId } = req.params;
    const userId = req.user.id;
    const userType = req.user.role;

    const result = await CalendarModel.removeReaction(
      parseInt(eventId),
      userId,
      userType
    );

    // Broadcast real-time update if reaction was removed
    if (result.removed) {
      try {
        const websocketService = require('../services/websocketService');

        websocketService.broadcastCalendarReaction({
          calendar_id: parseInt(eventId),
          user_id: userId,
          user_type: userType,
          action: 'removed'
        });
      } catch (error) {
        console.error('Failed to broadcast calendar reaction removal:', error);
      }
    }

    res.status(200).json({
      success: true,
      message: result.message,
      data: { removed: result.removed },
    });
  });
}

module.exports = new CalendarController();
