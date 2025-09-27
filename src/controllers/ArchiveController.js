const { asyncHandler } = require('../middleware/errorHandler');
const AnnouncementModel = require('../models/AnnouncementModel');
const CalendarModel = require('../models/CalendarModel');
const StudentModel = require('../models/StudentModel');
const logger = require('../utils/logger');

class ArchiveController {
  // Get archived announcements
  getArchivedAnnouncements = asyncHandler(async (req, res) => {
    const {
      page = 1,
      limit = 20,
      search,
      category_id: categoryId,
      subcategory_id: subcategoryId,
      posted_by: postedBy,
      start_date: startDate,
      end_date: endDate,
      sort_by: sortBy = 'archived_at',
      sort_order: sortOrder = 'DESC'
    } = req.query;

    const filters = {
      search,
      category_id: categoryId ? parseInt(categoryId) : undefined,
      subcategory_id: subcategoryId ? parseInt(subcategoryId) : undefined,
      posted_by: postedBy ? parseInt(postedBy) : undefined,
      start_date: startDate,
      end_date: endDate
    };

    const pagination = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort_by: sortBy,
      sort_order: sortOrder.toUpperCase()
    };

    const result = await AnnouncementModel.getArchivedAnnouncements(filters, pagination);

    res.status(200).json({
      success: true,
      message: 'Archived announcements retrieved successfully',
      data: {
        data: result.data,
        pagination: result.pagination
      }
    });
  });

  // Get archived calendar events
  getArchivedCalendarEvents = asyncHandler(async (req, res) => {
    const {
      page = 1,
      limit = 20,
      search,
      category_id: categoryId,
      subcategory_id: subcategoryId,
      created_by: createdBy,
      start_date: startDate,
      end_date: endDate,
      sort_by: sortBy = 'updated_at',
      sort_order: sortOrder = 'DESC'
    } = req.query;

    const filters = {
      search,
      category_id: categoryId ? parseInt(categoryId) : undefined,
      subcategory_id: subcategoryId ? parseInt(subcategoryId) : undefined,
      created_by: createdBy ? parseInt(createdBy) : undefined,
      start_date: startDate,
      end_date: endDate
    };

    const pagination = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort_by: sortBy,
      sort_order: sortOrder.toUpperCase()
    };

    const result = await CalendarModel.getArchivedEvents(filters, pagination);

    res.status(200).json({
      success: true,
      message: 'Archived calendar events retrieved successfully',
      data: {
        data: result.data,
        pagination: result.pagination
      }
    });
  });

  // Get archived students
  getArchivedStudents = asyncHandler(async (req, res) => {
    const {
      page = 1,
      limit = 20,
      search,
      grade_level: gradeLevel,
      created_by: createdBy,
      start_date: startDate,
      end_date: endDate,
      sort_by: sortBy = 'updated_at',
      sort_order: sortOrder = 'DESC'
    } = req.query;

    const filters = {
      search,
      grade_level: gradeLevel ? parseInt(gradeLevel) : undefined,
      created_by: createdBy ? parseInt(createdBy) : undefined,
      start_date: startDate,
      end_date: endDate
    };

    const pagination = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort_by: sortBy,
      sort_order: sortOrder.toUpperCase()
    };

    const result = await StudentModel.getArchivedStudents(filters, pagination);

    res.status(200).json({
      success: true,
      message: 'Archived students retrieved successfully',
      data: {
        data: result.data,
        pagination: result.pagination
      }
    });
  });

  // Restore archived announcement
  restoreAnnouncement = asyncHandler(async (req, res) => {
    const { announcementId } = req.params;

    const announcement = await AnnouncementModel.restoreAnnouncement(parseInt(announcementId));

    logger.info('Announcement restored from archive', {
      adminId: req.user?.id || 1,
      announcementId,
      announcementTitle: announcement.title
    });

    res.status(200).json({
      success: true,
      message: 'Announcement restored successfully',
      data: { announcement }
    });
  });

  // Restore archived calendar event
  restoreCalendarEvent = asyncHandler(async (req, res) => {
    const { eventId } = req.params;

    await CalendarModel.restoreEvent(parseInt(eventId));

    logger.info('Calendar event restored from archive', {
      adminId: req.user?.id || 1,
      eventId
    });

    res.status(200).json({
      success: true,
      message: 'Calendar event restored successfully'
    });
  });

  // Restore archived student
  restoreStudent = asyncHandler(async (req, res) => {
    const { studentId } = req.params;

    const student = await StudentModel.restoreStudent(parseInt(studentId));

    logger.info('Student account restored from archive', {
      adminId: req.user?.id || 1,
      studentId,
      studentEmail: student.email
    });

    res.status(200).json({
      success: true,
      message: 'Student account restored successfully',
      data: { student }
    });
  });

  // Get archived content statistics
  getArchiveStats = asyncHandler(async (req, res) => {
    const announcementStats = await AnnouncementModel.getArchiveStats();
    const calendarStats = await CalendarModel.getArchiveStats();

    res.status(200).json({
      success: true,
      message: 'Archive statistics retrieved successfully',
      data: {
        announcements: announcementStats,
        calendar: calendarStats,
        total: {
          archived: announcementStats.archived + calendarStats.archived,
          softDeleted: announcementStats.softDeleted + calendarStats.softDeleted
        }
      }
    });
  });

  // Permanently delete announcement
  permanentlyDeleteAnnouncement = asyncHandler(async (req, res) => {
    const { announcementId } = req.params;

    await AnnouncementModel.permanentlyDeleteAnnouncement(parseInt(announcementId));

    logger.warn('Announcement permanently deleted', {
      adminId: req.user?.id || 1,
      announcementId
    });

    res.status(200).json({
      success: true,
      message: 'Announcement permanently deleted'
    });
  });

  // Get archive statistics
  getArchiveStatistics = asyncHandler(async (req, res) => {
    try {
      // Get counts for each archive type
      const [announcementsResult, eventsResult, studentsResult] = await Promise.all([
        AnnouncementModel.getArchivedAnnouncements({}, { page: 1, limit: 1 }),
        CalendarModel.getArchivedEvents({}, { page: 1, limit: 1 }),
        StudentModel.getArchivedStudents({}, { page: 1, limit: 1 })
      ]);

      const statistics = {
        announcements: announcementsResult.pagination.total,
        calendar_events: eventsResult.pagination.total,
        students: studentsResult.pagination.total,
        admins: 0, // TODO: Implement archived admins functionality
        total: announcementsResult.pagination.total +
               eventsResult.pagination.total +
               studentsResult.pagination.total
      };

      res.status(200).json({
        success: true,
        message: 'Archive statistics retrieved successfully',
        data: statistics
      });
    } catch (error) {
      logger.error('Failed to get archive statistics:', error);
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to retrieve archive statistics'
        }
      });
    }
  });
}

module.exports = new ArchiveController();
