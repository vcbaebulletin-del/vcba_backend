const BaseModel = require('./BaseModel');
const logger = require('../utils/logger');

class ReportModel extends BaseModel {
  constructor() {
    super('audit_logs', 'log_id');
  }

  /**
   * Generate weekly/monthly report data from audit logs
   * @param {Object} options - Report options
   * @param {string} options.period - 'weekly' or 'monthly'
   * @param {string} options.start_date - Start date (ISO format)
   * @param {string} options.end_date - End date (ISO format)
   * @param {Object} options.filters - Content filters
   * @param {Object} options.pagination - Pagination options
   * @returns {Promise<Object>} Report data
   */
  async generateContentReport(options = {}) {
    const {
      period = 'weekly',
      start_date,
      end_date,
      filters = {},
      pagination = {}
    } = options;

    try {
      let announcementData = null;
      let calendarData = null;

      // Get data based on content type filter
      if (filters.content_type === 'all' || filters.content_type === 'announcements') {
        announcementData = await this.getAnnouncementActivity(start_date, end_date, filters, pagination);
      }

      if (filters.content_type === 'all' || filters.content_type === 'calendar') {
        calendarData = await this.getCalendarActivity(start_date, end_date, filters, pagination);
      }

      // Get user activity summary
      const userActivity = await this.getUserActivitySummary(start_date, end_date, filters);

      // Get system activity overview
      const systemActivity = await this.getSystemActivityOverview(start_date, end_date, filters);

      // Calculate total items for pagination
      const totalItems = (announcementData?.total_items || 0) + (calendarData?.total_items || 0);
      const totalPages = Math.ceil(totalItems / (pagination.limit || 25));

      return {
        period,
        date_range: {
          start_date,
          end_date
        },
        announcements: announcementData,
        calendar_events: calendarData,
        user_activity: userActivity,
        system_activity: systemActivity,
        total_items: totalItems,
        current_page: pagination.page || 1,
        total_pages: totalPages,
        generated_at: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Error generating content report:', error);
      throw error;
    }
  }

  /**
   * Get announcement activity data categorized by alert vs regular posts
   */
  async getAnnouncementActivity(start_date, end_date, filters = {}, pagination = {}) {
    try {
      // Build dynamic WHERE conditions
      let whereConditions = [
        "al.target_table = 'announcements'",
        "al.action_type IN ('CREATE', 'UPDATE', 'DELETE')",
        "al.performed_at BETWEEN ? AND ?"
      ];
      let queryParams = [start_date, end_date];

      // Add user filter
      if (filters.user_id) {
        whereConditions.push("al.user_id = ?");
        queryParams.push(filters.user_id);
      }

      // Add category filter (if needed, would require joining with announcements table)
      if (filters.category_id) {
        whereConditions.push(`
          al.target_id IN (
            SELECT announcement_id FROM announcements
            WHERE category_id = ?
          )
        `);
        queryParams.push(filters.category_id);
      }

      const whereClause = whereConditions.join(' AND ');

      const query = `
        SELECT
          al.action_type,
          al.target_id,
          al.description,
          al.performed_at,
          al.user_type,
          al.user_id,
          COALESCE(
            JSON_UNQUOTE(JSON_EXTRACT(al.new_values, '$.is_alert')),
            JSON_UNQUOTE(JSON_EXTRACT(al.old_values, '$.is_alert')),
            '0'
          ) as is_alert,
          COALESCE(
            JSON_UNQUOTE(JSON_EXTRACT(al.new_values, '$.title')),
            JSON_UNQUOTE(JSON_EXTRACT(al.old_values, '$.title')),
            'Unknown Title'
          ) as title,
          COALESCE(
            JSON_UNQUOTE(JSON_EXTRACT(al.new_values, '$.grade_level')),
            JSON_UNQUOTE(JSON_EXTRACT(al.old_values, '$.grade_level')),
            NULL
          ) as grade_level,
          COALESCE(
            JSON_UNQUOTE(JSON_EXTRACT(al.new_values, '$.status')),
            JSON_UNQUOTE(JSON_EXTRACT(al.old_values, '$.status')),
            'unknown'
          ) as status
        FROM audit_logs al
        WHERE ${whereClause}
        ORDER BY al.performed_at DESC
      `;

      const logs = await this.db.query(query, queryParams);

      // Apply alert posts filter if specified
      let filteredLogs = logs;
      if (filters.alert_posts_only) {
        filteredLogs = logs.filter(log => log.is_alert === '1' || log.is_alert === 1);
      }

      // Categorize by alert vs regular posts
      const alertPosts = filteredLogs.filter(log => log.is_alert === '1' || log.is_alert === 1);
      const regularPosts = filteredLogs.filter(log => log.is_alert === '0' || log.is_alert === 0);

      // Apply pagination
      const page = pagination.page || 1;
      const limit = pagination.limit || 25;
      const offset = (page - 1) * limit;

      const paginatedAlertPosts = alertPosts.slice(offset, offset + limit);
      const paginatedRegularPosts = regularPosts.slice(offset, offset + limit);

      // Count activities by type
      const alertStats = this.categorizeActivities(alertPosts);
      const regularStats = this.categorizeActivities(regularPosts);

      return {
        alert_posts: {
          total_activities: alertPosts.length,
          activities: alertStats,
          posts: paginatedAlertPosts.map(log => ({
            id: log.target_id,
            title: log.title,
            action: log.action_type,
            status: log.status,
            grade_level: log.grade_level,
            performed_at: log.performed_at,
            user_type: log.user_type,
            user_id: log.user_id
          }))
        },
        regular_posts: {
          total_activities: regularPosts.length,
          activities: regularStats,
          posts: paginatedRegularPosts.map(log => ({
            id: log.target_id,
            title: log.title,
            action: log.action_type,
            status: log.status,
            grade_level: log.grade_level,
            performed_at: log.performed_at,
            user_type: log.user_type,
            user_id: log.user_id
          }))
        },
        total_items: alertPosts.length + regularPosts.length,
        summary: {
          total_alert_posts: alertPosts.length,
          total_regular_posts: regularPosts.length,
          total_activities: logs.length,
          alert_percentage: logs.length > 0 ? ((alertPosts.length / logs.length) * 100).toFixed(1) : 0
        }
      };
    } catch (error) {
      logger.error('Error getting announcement activity:', error);
      throw error;
    }
  }

  /**
   * Get calendar event activity data categorized by alert vs regular events
   */
  async getCalendarActivity(start_date, end_date, filters = {}, pagination = {}) {
    try {
      // Build dynamic WHERE conditions
      let whereConditions = [
        "al.target_table = 'school_calendar'",
        "al.action_type IN ('CREATE', 'UPDATE', 'DELETE')",
        "al.performed_at BETWEEN ? AND ?"
      ];
      let queryParams = [start_date, end_date];

      // Add user filter
      if (filters.user_id) {
        whereConditions.push("al.user_id = ?");
        queryParams.push(filters.user_id);
      }

      // Include ALL calendar events regardless of holiday status
      // Removed holiday exclusion filter to ensure comprehensive reporting

      const whereClause = whereConditions.join(' AND ');

      const query = `
        SELECT
          al.action_type,
          al.target_id,
          al.description,
          al.performed_at,
          al.user_type,
          al.user_id,
          COALESCE(
            JSON_UNQUOTE(JSON_EXTRACT(al.new_values, '$.is_alert')),
            JSON_UNQUOTE(JSON_EXTRACT(al.old_values, '$.is_alert')),
            '0'
          ) as is_alert,
          COALESCE(
            JSON_UNQUOTE(JSON_EXTRACT(al.new_values, '$.title')),
            JSON_UNQUOTE(JSON_EXTRACT(al.old_values, '$.title')),
            'Unknown Event'
          ) as title,
          COALESCE(
            JSON_UNQUOTE(JSON_EXTRACT(al.new_values, '$.event_date')),
            JSON_UNQUOTE(JSON_EXTRACT(al.old_values, '$.event_date')),
            NULL
          ) as event_date
        FROM audit_logs al
        WHERE ${whereClause}
        ORDER BY al.performed_at DESC
      `;

      const logs = await this.db.query(query, queryParams);

      // Apply alert posts filter if specified
      let filteredLogs = logs;
      if (filters.alert_posts_only) {
        filteredLogs = logs.filter(log => log.is_alert === '1' || log.is_alert === 1);
      }

      // Categorize by alert vs regular events
      const alertEvents = filteredLogs.filter(log => log.is_alert === '1' || log.is_alert === 1);
      const regularEvents = filteredLogs.filter(log => log.is_alert === '0' || log.is_alert === 0);

      // Apply pagination
      const page = pagination.page || 1;
      const limit = pagination.limit || 25;
      const offset = (page - 1) * limit;

      const paginatedAlertEvents = alertEvents.slice(offset, offset + limit);
      const paginatedRegularEvents = regularEvents.slice(offset, offset + limit);

      // Count activities by type
      const alertStats = this.categorizeActivities(alertEvents);
      const regularStats = this.categorizeActivities(regularEvents);

      return {
        alert_events: {
          total_activities: alertEvents.length,
          activities: alertStats,
          events: paginatedAlertEvents.map(log => ({
            id: log.target_id,
            title: log.title,
            action: log.action_type,
            event_date: log.event_date,
            performed_at: log.performed_at,
            user_type: log.user_type,
            user_id: log.user_id
          }))
        },
        regular_events: {
          total_activities: regularEvents.length,
          activities: regularStats,
          events: paginatedRegularEvents.map(log => ({
            id: log.target_id,
            title: log.title,
            action: log.action_type,
            event_date: log.event_date,
            performed_at: log.performed_at,
            user_type: log.user_type,
            user_id: log.user_id
          }))
        },
        total_items: alertEvents.length + regularEvents.length,
        summary: {
          total_alert_events: alertEvents.length,
          total_regular_events: regularEvents.length,
          total_activities: logs.length,
          alert_percentage: logs.length > 0 ? ((alertEvents.length / logs.length) * 100).toFixed(1) : 0
        }
      };
    } catch (error) {
      logger.error('Error getting calendar activity:', error);
      throw error;
    }
  }

  /**
   * Get user activity summary
   */
  async getUserActivitySummary(start_date, end_date, filters = {}) {
    try {
      const query = `
        SELECT 
          al.user_type,
          al.user_id,
          COUNT(*) as total_actions,
          COUNT(CASE WHEN al.action_type = 'CREATE' THEN 1 END) as creates,
          COUNT(CASE WHEN al.action_type = 'UPDATE' THEN 1 END) as updates,
          COUNT(CASE WHEN al.action_type = 'DELETE' THEN 1 END) as deletes,
          MIN(al.performed_at) as first_activity,
          MAX(al.performed_at) as last_activity
        FROM audit_logs al
        WHERE al.target_table IN ('announcements', 'school_calendar')
          AND al.performed_at BETWEEN ? AND ?
        GROUP BY al.user_type, al.user_id
        ORDER BY total_actions DESC
      `;

      const userStats = await this.db.query(query, [start_date, end_date]);

      return {
        most_active_users: userStats.slice(0, 10),
        user_type_summary: this.summarizeByUserType(userStats),
        total_unique_users: userStats.length
      };
    } catch (error) {
      logger.error('Error getting user activity summary:', error);
      throw error;
    }
  }

  /**
   * Get system activity overview
   */
  async getSystemActivityOverview(start_date, end_date, filters = {}) {
    try {
      const query = `
        SELECT 
          DATE(al.performed_at) as activity_date,
          al.action_type,
          COUNT(*) as count
        FROM audit_logs al
        WHERE al.target_table IN ('announcements', 'school_calendar')
          AND al.performed_at BETWEEN ? AND ?
        GROUP BY DATE(al.performed_at), al.action_type
        ORDER BY activity_date DESC, al.action_type
      `;

      const dailyStats = await this.db.query(query, [start_date, end_date]);

      return {
        daily_activity: this.groupDailyActivity(dailyStats),
        activity_trends: this.calculateActivityTrends(dailyStats)
      };
    } catch (error) {
      logger.error('Error getting system activity overview:', error);
      throw error;
    }
  }

  /**
   * Helper method to categorize activities by type
   */
  categorizeActivities(logs) {
    return {
      created: logs.filter(log => log.action_type === 'CREATE').length,
      updated: logs.filter(log => log.action_type === 'UPDATE').length,
      deleted: logs.filter(log => log.action_type === 'DELETE').length
    };
  }

  /**
   * Helper method to summarize by user type
   */
  summarizeByUserType(userStats) {
    const summary = {};
    userStats.forEach(stat => {
      if (!summary[stat.user_type]) {
        summary[stat.user_type] = {
          total_users: 0,
          total_actions: 0,
          creates: 0,
          updates: 0,
          deletes: 0
        };
      }
      summary[stat.user_type].total_users++;
      summary[stat.user_type].total_actions += stat.total_actions;
      summary[stat.user_type].creates += stat.creates;
      summary[stat.user_type].updates += stat.updates;
      summary[stat.user_type].deletes += stat.deletes;
    });
    return summary;
  }

  /**
   * Helper method to group daily activity
   */
  groupDailyActivity(dailyStats) {
    const grouped = {};
    dailyStats.forEach(stat => {
      if (!grouped[stat.activity_date]) {
        grouped[stat.activity_date] = {
          date: stat.activity_date,
          CREATE: 0,
          UPDATE: 0,
          DELETE: 0,
          total: 0
        };
      }
      grouped[stat.activity_date][stat.action_type] = stat.count;
      grouped[stat.activity_date].total += stat.count;
    });
    return Object.values(grouped).sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  /**
   * Helper method to calculate activity trends
   */
  calculateActivityTrends(dailyStats) {
    const totalByType = {
      CREATE: 0,
      UPDATE: 0,
      DELETE: 0
    };

    dailyStats.forEach(stat => {
      totalByType[stat.action_type] += stat.count;
    });

    const total = Object.values(totalByType).reduce((sum, count) => sum + count, 0);

    return {
      total_activities: total,
      activity_breakdown: totalByType,
      activity_percentages: {
        CREATE: total > 0 ? ((totalByType.CREATE / total) * 100).toFixed(1) : 0,
        UPDATE: total > 0 ? ((totalByType.UPDATE / total) * 100).toFixed(1) : 0,
        DELETE: total > 0 ? ((totalByType.DELETE / total) * 100).toFixed(1) : 0
      }
    };
  }

  /**
   * Generate monthly content report with actual content data
   * @param {Object} options - Report options
   * @param {string} options.month - Month in YYYY-MM format
   * @param {string} options.start_date - Start date (ISO format)
   * @param {string} options.end_date - End date (ISO format)
   * @param {Array} options.fields - Fields to include ['Announcements', 'SchoolCalendar']
   * @param {string} options.generated_by - Admin who generated the report
   * @returns {Promise<Object>} Report data with content items
   */
  async generateMonthlyContentReport(options = {}) {
    const {
      month,
      start_date,
      end_date,
      fields = [],
      generated_by = 'Unknown Admin'
    } = options;

    try {
      const reportItems = [];
      const tallies = {
        announcements: { regular: 0, alert: 0, total: 0 },
        school_calendar: { regular: 0, alert: 0, total: 0 }
      };

      // Get announcements if requested
      if (fields.includes('Announcements')) {
        const announcements = await this.getAnnouncementsForReport(start_date, end_date);

        announcements.forEach((announcement, index) => {
          const category = announcement.is_alert ? 'alert' : 'regular';
          tallies.announcements[category]++;
          tallies.announcements.total++;

          const item = {
            id: `announcement_${announcement.announcement_id}`,
            type: 'Announcement',
            title: announcement.title,
            content: announcement.content,
            date: announcement.created_at,
            category,
            images: announcement.images || [],
            posted_by: announcement.posted_by,
            posted_by_name: announcement.posted_by_name,
            posted_by_department: announcement.posted_by_department,
            posted_by_position: announcement.posted_by_position,
            announcement_id: announcement.announcement_id,
            created_at: announcement.created_at,
            status: announcement.status,
            visibility_end_at: announcement.visibility_end_at
          };

          // Debug: Log first item being added to reportItems
          if (index === 0) {
            console.log('📊 [DEBUG] First Announcement Item for Report:', {
              title: item.title,
              status: item.status,
              visibility_end_at: item.visibility_end_at
            });
          }

          reportItems.push(item);
        });
      }

      // Get calendar events if requested
      if (fields.includes('SchoolCalendar')) {
        const calendarEvents = await this.getCalendarEventsForReport(start_date, end_date);

        calendarEvents.forEach((event, index) => {
          const category = event.is_alert ? 'alert' : 'regular';
          tallies.school_calendar[category]++;
          tallies.school_calendar.total++;

          const item = {
            id: `calendar_${event.calendar_id}`,
            type: 'Calendar',
            title: event.title,
            content: event.description || '',
            date: event.created_at, // Use created_at for consistency with announcements
            category,
            images: event.images || [],
            created_by: event.created_by,
            created_by_name: event.created_by_name,
            created_by_department: event.created_by_department,
            created_by_position: event.created_by_position,
            calendar_id: event.calendar_id,
            created_at: event.created_at,
            event_date: event.event_date, // Keep event_date as additional field
            end_date: event.end_date,
            is_active: event.is_active // Pass is_active directly (0 or 1)
          };

          // Debug: Log first item being added to reportItems
          if (index === 0) {
            console.log('📊 [DEBUG] First Calendar Event Item for Report:', {
              title: item.title,
              is_active: item.is_active,
              end_date: item.end_date,
              event_date: item.event_date
            });
          }

          reportItems.push(item);
        });
      }

      // Sort items by date (newest first)
      reportItems.sort((a, b) => new Date(b.date) - new Date(a.date));

      // Format month for display
      const monthDate = new Date(start_date);
      const monthName = monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

      return {
        report: {
          title: `Monthly Report - ${monthName}`,
          description: `Generated report for ${fields.join(' and ')}`,
          tallies,
          items: reportItems,
          meta: {
            generatedAt: new Date().toISOString(),
            generatedBy: generated_by
          }
        }
      };

    } catch (error) {
      logger.error('Error generating monthly content report:', error);
      throw error;
    }
  }

  /**
   * Get announcements for monthly report - INCLUDES ALL RECORDS (active, archived, deleted)
   * @param {string} start_date - Start date (ISO format)
   * @param {string} end_date - End date (ISO format)
   * @returns {Promise<Array>} Announcements with images and admin names
   */
  async getAnnouncementsForReport(start_date, end_date) {
    try {
      const query = `
        SELECT
          a.announcement_id,
          a.title,
          a.content,
          a.is_alert,
          a.created_at,
          a.posted_by,
          a.status,
          a.visibility_end_at,
          a.deleted_at,
          a.archived_at,
          COALESCE(
            CONCAT(
              TRIM(COALESCE(ap.first_name, '')),
              CASE
                WHEN ap.first_name IS NOT NULL AND ap.last_name IS NOT NULL
                THEN ' '
                ELSE ''
              END,
              TRIM(COALESCE(ap.last_name, ''))
            ),
            COALESCE(aa.email, 'Unknown Admin')
          ) as posted_by_name,
          COALESCE(ap.department, 'Unknown Department') as posted_by_department,
          COALESCE(ap.position, 'Unknown Position') as posted_by_position,
          GROUP_CONCAT(DISTINCT att.file_path) as image_paths
        FROM announcements a
        LEFT JOIN admin_accounts aa ON a.posted_by = aa.admin_id
        LEFT JOIN admin_profiles ap ON aa.admin_id = ap.admin_id
        LEFT JOIN announcement_attachments att ON a.announcement_id = att.announcement_id
        WHERE a.created_at >= ?
          AND a.created_at <= ?
        GROUP BY 
          a.announcement_id,
          a.title,
          a.content,
          a.is_alert,
          a.created_at,
          a.posted_by,
          a.status,
          a.visibility_end_at,
          a.deleted_at,
          a.archived_at,
          aa.email,
          ap.first_name,
          ap.last_name,
          ap.department,
          ap.position
        ORDER BY a.created_at DESC
      `;

      const results = await this.query(query, [start_date, end_date]);

      // Debug: Log first announcement to verify ALL fields
      if (results.length > 0) {
        console.log('📊 [DEBUG] Sample Announcement from DB - ALL FIELDS:', results[0]);
        console.log('📊 [DEBUG] Specific fields check:', {
          announcement_id: results[0].announcement_id,
          title: results[0].title,
          status: results[0].status,
          visibility_end_at: results[0].visibility_end_at,
          created_at: results[0].created_at,
          has_status: 'status' in results[0],
          has_visibility_end_at: 'visibility_end_at' in results[0]
        });
      }

      // Process image paths and ensure all fields are preserved
      const processed = results.map(announcement => {
        const result = {
          ...announcement,
          images: announcement.image_paths ? announcement.image_paths.split(',').filter(Boolean) : []
        };
        // Remove image_paths as it's now converted to images array
        delete result.image_paths;
        return result;
      });

      // Debug: Log first processed announcement
      if (processed.length > 0) {
        console.log('📊 [DEBUG] First processed announcement:', {
          announcement_id: processed[0].announcement_id,
          title: processed[0].title,
          status: processed[0].status,
          visibility_end_at: processed[0].visibility_end_at,
          has_status: 'status' in processed[0],
          has_visibility_end_at: 'visibility_end_at' in processed[0]
        });
      }

      return processed;

    } catch (error) {
      logger.error('Error getting announcements for report:', error);
      throw error;
    }
  }

  /**
   * Get calendar events for monthly report - INCLUDES ALL RECORDS (active, inactive, deleted)
   * @param {string} start_date - Start date (ISO format)
   * @param {string} end_date - End date (ISO format)
   * @returns {Promise<Array>} Calendar events with images and admin names
   */
  async getCalendarEventsForReport(start_date, end_date) {
    try {
      const query = `
        SELECT
          sc.calendar_id,
          sc.title,
          sc.description,
          sc.is_alert,
          sc.event_date,
          sc.end_date,
          sc.created_at,
          sc.created_by,
          sc.is_active,
          sc.is_published,
          sc.deleted_at,
          COALESCE(
            CONCAT(
              TRIM(COALESCE(ap.first_name, '')),
              CASE
                WHEN ap.first_name IS NOT NULL AND ap.last_name IS NOT NULL
                THEN ' '
                ELSE ''
              END,
              TRIM(COALESCE(ap.last_name, ''))
            ),
            COALESCE(aa.email, 'Unknown Admin')
          ) as created_by_name,
          COALESCE(ap.department, 'Unknown Department') as created_by_department,
          COALESCE(ap.position, 'Unknown Position') as created_by_position,
          GROUP_CONCAT(DISTINCT ca.file_path) as image_paths
        FROM school_calendar sc
        LEFT JOIN admin_accounts aa ON sc.created_by = aa.admin_id
        LEFT JOIN admin_profiles ap ON aa.admin_id = ap.admin_id
        LEFT JOIN calendar_attachments ca ON sc.calendar_id = ca.calendar_id
        WHERE sc.created_at >= ?
          AND sc.created_at <= ?
        GROUP BY 
          sc.calendar_id,
          sc.title,
          sc.description,
          sc.is_alert,
          sc.event_date,
          sc.end_date,
          sc.created_at,
          sc.created_by,
          sc.is_active,
          sc.is_published,
          sc.deleted_at,
          aa.email,
          ap.first_name,
          ap.last_name,
          ap.department,
          ap.position
        ORDER BY sc.created_at DESC
      `;

      const results = await this.query(query, [start_date, end_date]);

      // Debug: Log first calendar event to verify ALL fields
      if (results.length > 0) {
        console.log('📊 [DEBUG] Sample Calendar Event from DB - ALL FIELDS:', results[0]);
        console.log('📊 [DEBUG] Specific fields check:', {
          calendar_id: results[0].calendar_id,
          title: results[0].title,
          is_active: results[0].is_active,
          end_date: results[0].end_date,
          event_date: results[0].event_date,
          created_at: results[0].created_at,
          has_is_active: 'is_active' in results[0],
          has_end_date: 'end_date' in results[0]
        });
      }

      // Process image paths and ensure all fields are preserved
      const processed = results.map(event => {
        const result = {
          ...event,
          images: event.image_paths ? event.image_paths.split(',').filter(Boolean) : []
        };
        // Remove image_paths as it's now converted to images array
        delete result.image_paths;
        return result;
      });

      // Debug: Log first processed calendar event
      if (processed.length > 0) {
        console.log('📊 [DEBUG] First processed calendar event:', {
          calendar_id: processed[0].calendar_id,
          title: processed[0].title,
          is_active: processed[0].is_active,
          end_date: processed[0].end_date,
          has_is_active: 'is_active' in processed[0],
          has_end_date: 'end_date' in processed[0]
        });
      }

      return processed;

    } catch (error) {
      logger.error('Error getting calendar events for report:', error);
      throw error;
    }
  }
}

module.exports = ReportModel;
