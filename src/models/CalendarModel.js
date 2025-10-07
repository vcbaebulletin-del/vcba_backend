const BaseModel = require('./BaseModel');
const { ValidationError, NotFoundError, ConflictError } = require('../middleware/errorHandler');

class CalendarModel extends BaseModel {
  constructor() {
    super('school_calendar', 'calendar_id');
  }

  // Helper function to format dates consistently
  // IMPORTANT: Extract date components directly from Date object to avoid timezone conversion issues
  // Philippine Time (UTC+8) midnight becomes previous day in UTC, so we must use local date components
  formatEventDates(event) {
    if (!event) return event;

    const formatDateWithoutTimezone = (dateValue) => {
      if (!dateValue) return null;

      if (dateValue instanceof Date) {
        // Extract date components directly from the Date object (local time)
        // This avoids timezone conversion issues where midnight PHT becomes previous day in UTC
        const year = dateValue.getFullYear();
        const month = String(dateValue.getMonth() + 1).padStart(2, '0');
        const day = String(dateValue.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      } else if (typeof dateValue === 'string') {
        // For string dates, extract the date part
        return dateValue.split('T')[0];
      }
      return null;
    };

    return {
      ...event,
      event_date: formatDateWithoutTimezone(event.event_date),
      end_date: formatDateWithoutTimezone(event.end_date)
    };
  }

  // Create calendar event
  async createEvent(data) {
    try {
      // Validate required fields - now using category_id 
      this.validateRequired(data, ['title', 'event_date', 'category_id', 'created_by']);

      // Prepare event data
      const eventData = {
        title: data.title,
        description: data.description || null,
        event_date: data.event_date,
        end_date: data.end_date || null,
        category_id: data.category_id,
        subcategory_id: data.subcategory_id || null,
        is_recurring: data.is_recurring || 0,
        recurrence_pattern: data.recurrence_pattern || null,
        is_active: data.is_active !== undefined ? data.is_active : 1,
        is_published: data.is_published !== undefined ? data.is_published : 0,
        allow_comments: data.allow_comments !== undefined ? data.allow_comments : 1,
        is_alert: data.is_alert !== undefined ? data.is_alert : 0,
        created_by: data.created_by,
        created_at: new Date(),
        updated_at: new Date()
      };

      const result = await this.db.insert(this.tableName, eventData);
      // Use getEventById to ensure dates are properly formatted
      return await this.getEventById(result.insertId);
    } catch (error) {
      throw new ValidationError(`Failed to create calendar event: ${error.message}`);
    }
  }

  // Get calendar events with filters
  async getEvents(filters = {}, pagination = {}, userId = null, userType = null) {
    try {
      const {
        start_date,
        end_date,
        category_id,
        subcategory_id,
        is_active,
        is_recurring,
        search
      } = filters;

      const {
        page = 1,
        limit = 50,
        sort_by = 'event_date',
        sort_order = 'ASC'
      } = pagination;

      let whereConditions = [];
      let params = [];

      // Always exclude soft deleted records
      whereConditions.push('sc.deleted_at IS NULL');

      // Only filter by is_active if explicitly provided (matching OLD working version)
      if (is_active !== undefined) {
        whereConditions.push('sc.is_active = ?');
        params.push(is_active);
      }

      // Build WHERE conditions
      if (start_date) {
        whereConditions.push('sc.event_date >= ?');
        params.push(start_date);
      }

      if (end_date) {
        whereConditions.push('sc.event_date <= ?');
        params.push(end_date);
      }

      if (category_id) {
        whereConditions.push('sc.category_id = ?');
        params.push(category_id);
      }

      if (subcategory_id) {
        whereConditions.push('sc.subcategory_id = ?');
        params.push(subcategory_id);
      }

      if (is_recurring !== undefined) {
        whereConditions.push('sc.is_recurring = ?');
        params.push(is_recurring);
      }

      if (search) {
        whereConditions.push('(sc.title LIKE ? OR sc.description LIKE ?)');
        params.push(`%${search}%`, `%${search}%`);
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

      // Calculate offset
      const offset = (page - 1) * limit;

      // Get total count
      const countSql = `
        SELECT COUNT(*) as total
        FROM school_calendar sc
        ${whereClause}
      `;
      const countResult = await this.db.findOne(countSql, params);
      const total = countResult.total;

      // Get events with related data including categories, reactions, and comments
      let sql = `
        SELECT
          sc.*,
          c.name as category_name,
          c.color_code as category_color,
          s.name as subcategory_name,
          s.color_code as subcategory_color,
          CONCAT(IFNULL(ap.first_name, ''), ' ', IFNULL(ap.last_name, '')) as created_by_name,
          COALESCE(ap.profile_picture, '') as created_by_picture,
          COALESCE(reaction_counts.reaction_count, 0) as reaction_count,
          COALESCE(comment_counts.comment_count, 0) as comment_count
      `;

      // Add user reaction status if user is provided
      if (userId && userType) {
        sql += `,
          CASE WHEN user_reactions.reaction_log_id IS NOT NULL THEN 1 ELSE 0 END as user_has_reacted
        `;
      }

      sql += `
        FROM school_calendar sc
        LEFT JOIN categories c ON sc.category_id = c.category_id
        LEFT JOIN subcategories s ON sc.subcategory_id = s.subcategory_id
        LEFT JOIN admin_profiles ap ON sc.created_by = ap.admin_id
        LEFT JOIN (
          SELECT calendar_id, COUNT(*) as reaction_count
          FROM calendar_reactions
          GROUP BY calendar_id
        ) reaction_counts ON sc.calendar_id = reaction_counts.calendar_id
        LEFT JOIN (
          SELECT calendar_id, COUNT(*) as comment_count
          FROM comments
          WHERE calendar_id IS NOT NULL
          GROUP BY calendar_id
        ) comment_counts ON sc.calendar_id = comment_counts.calendar_id
      `;

      // Add user reaction join if user is provided
      if (userId && userType) {
        sql += `
        LEFT JOIN calendar_reactions user_reactions ON sc.calendar_id = user_reactions.calendar_id
          AND user_reactions.user_id = ? AND user_reactions.user_type = ?
        `;
        params.push(userId, userType);
      }

      sql += `
        ${whereClause}
        ORDER BY sc.${sort_by} ${sort_order}
        LIMIT ? OFFSET ?
      `;

      params.push(limit, offset);
      const events = await this.db.query(sql, params);

      // Get attachments for each event and format dates (similar to AnnouncementModel)
      for (let event of events) {
        const attachmentsSql = `
          SELECT
            attachment_id,
            file_name,
            file_path,
            file_type,
            file_size,
            mime_type,
            display_order,
            is_primary,
            uploaded_at
          FROM calendar_attachments
          WHERE calendar_id = ? AND deleted_at IS NULL
          ORDER BY display_order ASC, uploaded_at ASC
        `;
        const attachments = await this.db.query(attachmentsSql, [event.calendar_id]);
        event.attachments = attachments;
        event.images = attachments; // For backward compatibility and consistency with announcements
      }

      // Format dates for all events to avoid timezone conversion issues
      const formattedEvents = events.map(event => this.formatEventDates(event));

      // Calculate pagination info
      const totalPages = Math.ceil(total / limit);
      const hasNext = page < totalPages;
      const hasPrev = page > 1;

      return {
        events: formattedEvents,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext,
          hasPrev
        }
      };
    } catch (error) {
      throw new ValidationError(`Failed to get calendar events: ${error.message}`);
    }
  }

  // Get single event with details
  async getEventById(id) {
    try {
      const sql = `
        SELECT
          sc.*,
          c.name as category_name,
          c.color_code as category_color,
          s.name as subcategory_name,
          s.color_code as subcategory_color,
          CONCAT(IFNULL(ap.first_name, ''), ' ', IFNULL(ap.last_name, '')) as created_by_name,
          COALESCE(ap.profile_picture, '') as created_by_picture
        FROM school_calendar sc
        LEFT JOIN categories c ON sc.category_id = c.category_id
        LEFT JOIN subcategories s ON sc.subcategory_id = s.subcategory_id
        LEFT JOIN admin_profiles ap ON sc.created_by = ap.admin_id
        WHERE sc.calendar_id = ?
      `;

      const event = await this.db.findOne(sql, [id]);
      if (!event) {
        throw new NotFoundError('Calendar event not found');
      }

      // Get attachments for this event
      const attachmentsSql = `
        SELECT
          attachment_id,
          file_name,
          file_path,
          file_type,
          file_size,
          mime_type,
          display_order,
          is_primary,
          uploaded_at
        FROM calendar_attachments
        WHERE calendar_id = ? AND deleted_at IS NULL
        ORDER BY display_order ASC, uploaded_at ASC
      `;
      const attachments = await this.db.query(attachmentsSql, [event.calendar_id]);
      event.attachments = attachments;
      event.images = attachments; // For backward compatibility and consistency with announcements

      return this.formatEventDates(event);
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      throw new ValidationError(`Failed to get calendar event: ${error.message}`);
    }
  }

  // Update calendar event
  async updateEvent(id, data) {
    try {
      const allowedFields = [
        'title', 'description', 'event_date', 'end_date',
        'category_id', 'subcategory_id', 'is_recurring', 'recurrence_pattern', 'is_active',
        'allow_comments', 'is_alert'
      ];

      const updateData = {};
      allowedFields.forEach(field => {
        if (data[field] !== undefined) {
          updateData[field] = data[field];
        }
      });



      if (Object.keys(updateData).length === 0) {
        throw new ValidationError('No valid fields to update');
      }

      updateData.updated_at = new Date();

      const result = await this.db.update(
        this.tableName,
        updateData,
        `${this.primaryKey} = ?`,
        [id]
      );

      if (result.affectedRows === 0) {
        throw new NotFoundError('Calendar event not found');
      }

      return await this.getEventById(id);
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      throw new ValidationError(`Failed to update calendar event: ${error.message}`);
    }
  }

  // Delete calendar event
  async deleteEvent(id) {
    try {
      const result = await this.db.delete(
        this.tableName,
        `${this.primaryKey} = ?`,
        [id]
      );

      if (result.affectedRows === 0) {
        throw new NotFoundError('Calendar event not found');
      }

      return { success: true, message: 'Calendar event deleted successfully' };
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      throw new ValidationError(`Failed to delete calendar event: ${error.message}`);
    }
  }

  // Get events for a specific date
  async getEventsByDate(date) {
    try {
      const sql = `
        SELECT
          sc.*,
          c.name as category_name,
          c.color_code as category_color,
          s.name as subcategory_name,
          s.color_code as subcategory_color,
          CONCAT(IFNULL(ap.first_name, ''), ' ', IFNULL(ap.last_name, '')) as created_by_name
        FROM school_calendar sc
        LEFT JOIN categories c ON sc.category_id = c.category_id
        LEFT JOIN subcategories s ON sc.subcategory_id = s.subcategory_id
        LEFT JOIN admin_profiles ap ON sc.created_by = ap.admin_id
        WHERE sc.event_date = ? AND sc.is_active = 1 AND sc.deleted_at IS NULL
        ORDER BY sc.event_date ASC
      `;

      const events = await this.db.query(sql, [date]);

      // Get attachments for each event
      for (let event of events) {
        const attachmentsSql = `
          SELECT
            attachment_id,
            file_name,
            file_path,
            file_type,
            file_size,
            mime_type,
            display_order,
            is_primary,
            uploaded_at
          FROM calendar_attachments
          WHERE calendar_id = ? AND deleted_at IS NULL
          ORDER BY display_order ASC, uploaded_at ASC
        `;
        const attachments = await this.db.query(attachmentsSql, [event.calendar_id]);
        event.attachments = attachments;
        event.images = attachments;
      }

      // Format dates for all events to avoid timezone conversion issues
      const formattedEvents = events.map(event => this.formatEventDates(event));

      return formattedEvents;
    } catch (error) {
      throw new ValidationError(`Failed to get events by date: ${error.message}`);
    }
  }

  // Get events for a date range
  async getEventsByDateRange(startDate, endDate) {
    try {
      const sql = `
        SELECT
          sc.*,
          c.name as category_name,
          c.color_code as category_color,
          s.name as subcategory_name,
          s.color_code as subcategory_color,
          CONCAT(IFNULL(ap.first_name, ''), ' ', IFNULL(ap.last_name, '')) as created_by_name
        FROM school_calendar sc
        LEFT JOIN categories c ON sc.category_id = c.category_id
        LEFT JOIN subcategories s ON sc.subcategory_id = s.subcategory_id
        LEFT JOIN admin_profiles ap ON sc.created_by = ap.admin_id
        WHERE sc.event_date BETWEEN ? AND ? AND sc.is_active = 1 AND sc.deleted_at IS NULL
        ORDER BY sc.event_date ASC
      `;

      const events = await this.db.query(sql, [startDate, endDate]);

      // Get attachments for each event
      for (let event of events) {
        const attachmentsSql = `
          SELECT
            attachment_id,
            file_name,
            file_path,
            file_type,
            file_size,
            mime_type,
            display_order,
            is_primary,
            uploaded_at
          FROM calendar_attachments
          WHERE calendar_id = ? AND deleted_at IS NULL
          ORDER BY display_order ASC, uploaded_at ASC
        `;
        const attachments = await this.db.query(attachmentsSql, [event.calendar_id]);
        event.attachments = attachments;
        event.images = attachments;
      }

      // Format dates for all events to avoid timezone conversion issues
      const formattedEvents = events.map(event => this.formatEventDates(event));

      return formattedEvents;
    } catch (error) {
      throw new ValidationError(`Failed to get events by date range: ${error.message}`);
    }
  }



  // Get categories with subcategories for calendar events
  async getCategoriesWithSubcategories() {
    try {
      const sql = `
        SELECT
          c.category_id,
          c.name as category_name,
          c.description as category_description,
          c.color_code as category_color,
          c.is_active as category_active,
          s.subcategory_id,
          s.name as subcategory_name,
          s.description as subcategory_description,
          s.color_code as subcategory_color,
          s.is_active as subcategory_active,
          s.display_order
        FROM categories c
        LEFT JOIN subcategories s ON c.category_id = s.category_id AND s.is_active = 1
        WHERE c.is_active = 1
        ORDER BY c.name, s.display_order, s.name
      `;

      const results = await this.db.query(sql);

      // Group subcategories under their parent categories
      const categoriesMap = new Map();

      results.forEach(row => {
        if (!categoriesMap.has(row.category_id)) {
          categoriesMap.set(row.category_id, {
            category_id: row.category_id,
            name: row.category_name,
            description: row.category_description,
            color_code: row.category_color,
            is_active: row.category_active,
            subcategories: []
          });
        }

        if (row.subcategory_id) {
          categoriesMap.get(row.category_id).subcategories.push({
            subcategory_id: row.subcategory_id,
            name: row.subcategory_name,
            description: row.subcategory_description,
            color_code: row.subcategory_color,
            is_active: row.subcategory_active,
            display_order: row.display_order
          });
        }
      });

      return Array.from(categoriesMap.values());
    } catch (error) {
      throw new ValidationError(`Failed to get categories with subcategories: ${error.message}`);
    }
  }

  // Get active categories with active subcategories for calendar events (excludes soft-deleted)
  async getActiveCategoriesWithSubcategories() {
    try {
      const sql = `
        SELECT
          c.category_id,
          c.name as category_name,
          c.description as category_description,
          c.color_code as category_color,
          c.is_active as category_active,
          s.subcategory_id,
          s.name as subcategory_name,
          s.description as subcategory_description,
          s.color_code as subcategory_color,
          s.is_active as subcategory_active,
          s.display_order
        FROM categories c
        LEFT JOIN subcategories s ON c.category_id = s.category_id
          AND s.is_active = 1 AND s.deleted_at IS NULL
        WHERE c.is_active = 1 AND c.deleted_at IS NULL
        ORDER BY c.name, s.display_order, s.name
      `;

      const results = await this.db.query(sql);

      // Group subcategories under their parent categories
      const categoriesMap = new Map();

      results.forEach(row => {
        if (!categoriesMap.has(row.category_id)) {
          categoriesMap.set(row.category_id, {
            category_id: row.category_id,
            name: row.category_name,
            description: row.category_description,
            color_code: row.category_color,
            is_active: row.category_active,
            subcategories: []
          });
        }

        if (row.subcategory_id) {
          categoriesMap.get(row.category_id).subcategories.push({
            subcategory_id: row.subcategory_id,
            name: row.subcategory_name,
            description: row.subcategory_description,
            color_code: row.subcategory_color,
            is_active: row.subcategory_active,
            display_order: row.display_order
          });
        }
      });

      return Array.from(categoriesMap.values());
    } catch (error) {
      throw new ValidationError(`Failed to get active categories with subcategories: ${error.message}`);
    }
  }

  // Helper method to generate recurring event instances
  generateRecurringEvents(baseEvent, targetYear, targetMonth = null) {
    const recurringEvents = [];

    if (!baseEvent.is_recurring || !baseEvent.recurrence_pattern) {
      return [baseEvent]; // Return original event if not recurring
    }

    const originalDate = new Date(baseEvent.event_date);
    const originalEndDate = baseEvent.end_date ? new Date(baseEvent.end_date) : null;
    const eventDuration = originalEndDate ?
      (originalEndDate.getTime() - originalDate.getTime()) / (1000 * 60 * 60 * 24) : 0;

    // Define the range for generating events
    let startDate, endDate;
    if (targetMonth) {
      // For specific month
      startDate = new Date(targetYear, targetMonth - 1, 1);
      endDate = new Date(targetYear, targetMonth, 0); // Last day of month
    } else {
      // For entire year
      startDate = new Date(targetYear, 0, 1);
      endDate = new Date(targetYear, 11, 31);
    }

    // Generate recurring instances based on pattern
    switch (baseEvent.recurrence_pattern) {
      case 'yearly':
        // Generate yearly recurrence
        for (let year = startDate.getFullYear(); year <= endDate.getFullYear(); year++) {
          const recurringDate = new Date(year, originalDate.getMonth(), originalDate.getDate());

          // Check if this instance falls within our target range
          if (recurringDate >= startDate && recurringDate <= endDate) {
            const recurringEndDate = eventDuration > 0 ?
              new Date(recurringDate.getTime() + (eventDuration * 24 * 60 * 60 * 1000)) : null;

            recurringEvents.push({
              ...baseEvent,
              event_date: recurringDate,
              end_date: recurringEndDate,
              is_recurring_instance: true,
              original_event_id: baseEvent.calendar_id
            });
          }
        }
        break;

      case 'monthly':
        // Generate monthly recurrence
        const currentDate = new Date(startDate);
        while (currentDate <= endDate) {
          // Set to the same day of month as original
          const recurringDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), originalDate.getDate());

          // Handle cases where the day doesn't exist in the month (e.g., Feb 30)
          if (recurringDate.getMonth() !== currentDate.getMonth()) {
            // Use last day of the month instead
            recurringDate.setDate(0);
          }

          if (recurringDate >= startDate && recurringDate <= endDate) {
            const recurringEndDate = eventDuration > 0 ?
              new Date(recurringDate.getTime() + (eventDuration * 24 * 60 * 60 * 1000)) : null;

            recurringEvents.push({
              ...baseEvent,
              event_date: recurringDate,
              end_date: recurringEndDate,
              is_recurring_instance: true,
              original_event_id: baseEvent.calendar_id
            });
          }

          // Move to next month
          currentDate.setMonth(currentDate.getMonth() + 1);
        }
        break;

      case 'weekly':
        // Generate weekly recurrence
        const weeklyStartDate = new Date(startDate);
        // Find the first occurrence of the same weekday as original event
        const targetWeekday = originalDate.getDay();
        const daysToAdd = (targetWeekday - weeklyStartDate.getDay() + 7) % 7;
        weeklyStartDate.setDate(weeklyStartDate.getDate() + daysToAdd);

        const currentWeeklyDate = new Date(weeklyStartDate);
        while (currentWeeklyDate <= endDate) {
          if (currentWeeklyDate >= startDate) {
            const recurringEndDate = eventDuration > 0 ?
              new Date(currentWeeklyDate.getTime() + (eventDuration * 24 * 60 * 60 * 1000)) : null;

            recurringEvents.push({
              ...baseEvent,
              event_date: new Date(currentWeeklyDate),
              end_date: recurringEndDate,
              is_recurring_instance: true,
              original_event_id: baseEvent.calendar_id
            });
          }

          // Move to next week
          currentWeeklyDate.setDate(currentWeeklyDate.getDate() + 7);
        }
        break;

      default:
        // Unknown pattern, return original event
        return [baseEvent];
    }

    return recurringEvents;
  }

  // Get events for calendar view (month/year)
  async getCalendarEvents(year, month = null) {
    try {
      // First, get all base events (including recurring ones)
      const sql = `
        SELECT
          sc.*,
          c.name as category_name,
          c.color_code as category_color,
          s.name as subcategory_name,
          s.color_code as subcategory_color
        FROM school_calendar sc
        LEFT JOIN categories c ON sc.category_id = c.category_id
        LEFT JOIN subcategories s ON sc.subcategory_id = s.subcategory_id
        WHERE sc.is_active = 1 AND sc.deleted_at IS NULL
        ORDER BY sc.event_date ASC
      `;

      const baseEvents = await this.db.query(sql);

      // Get attachments for each base event (CRITICAL FIX for TV Display)
      for (let event of baseEvents) {
        const attachmentsSql = `
          SELECT
            attachment_id,
            file_name,
            file_path,
            file_type,
            file_size,
            mime_type,
            display_order,
            is_primary,
            uploaded_at
          FROM calendar_attachments
          WHERE calendar_id = ? AND deleted_at IS NULL
          ORDER BY display_order ASC, uploaded_at ASC
        `;
        const attachments = await this.db.query(attachmentsSql, [event.calendar_id]);
        event.attachments = attachments;
        event.images = attachments; // For backward compatibility and TV Display
      }

      // Generate all events including recurring instances
      const allEvents = [];

      baseEvents.forEach(baseEvent => {
        if (baseEvent.is_recurring) {
          // Generate recurring instances for this event
          const recurringInstances = this.generateRecurringEvents(baseEvent, year, month);
          allEvents.push(...recurringInstances);
        } else {
          // Check if non-recurring event falls within our target range
          const eventDate = new Date(baseEvent.event_date);
          const eventYear = eventDate.getFullYear();
          const eventMonth = eventDate.getMonth() + 1;

          if (month) {
            // For specific month, only include events in that month
            if (eventYear === year && eventMonth === month) {
              allEvents.push(baseEvent);
            }
          } else {
            // For entire year, only include events in that year
            if (eventYear === year) {
              allEvents.push(baseEvent);
            }
          }
        }
      });

      // Group events by date for easier frontend consumption
      // Handle events that span multiple days (start_date to end_date)
      const groupedEvents = {};

      allEvents.forEach(event => {
        // Extract date strings to avoid timezone issues
        // Handle MySQL date objects properly to avoid timezone conversion
        const extractDateString = (dateValue) => {
          if (!dateValue) return null;

          if (dateValue instanceof Date) {
            // For Date objects from MySQL, use the original date without timezone conversion
            // Extract the date components directly from the Date object as stored
            const year = dateValue.getFullYear();
            const month = String(dateValue.getMonth() + 1).padStart(2, '0');
            const day = String(dateValue.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
          } else if (typeof dateValue === 'string') {
            // For string dates, extract the date part
            return dateValue.split('T')[0];
          }
          return null;
        };

        const startDateStr = extractDateString(event.event_date);
        const endDateStr = event.end_date ? extractDateString(event.end_date) : startDateStr;

        // Debug logging to track date processing
        console.log(`[CALENDAR] Processing event "${event.title}":`, {
          originalEventDate: event.event_date,
          originalEndDate: event.end_date,
          extractedStartDate: startDateStr,
          extractedEndDate: endDateStr,
          eventDateType: typeof event.event_date,
          endDateType: typeof event.end_date,
          timezoneOffset: event.event_date instanceof Date ? event.event_date.getTimezoneOffset() : 'N/A'
        });

        // Create dates using explicit date parts to avoid timezone conversion issues
        // Parse the date string manually to avoid timezone interpretation
        const parseLocalDate = (dateStr) => {
          const [year, month, day] = dateStr.split('-').map(Number);
          return new Date(year, month - 1, day); // month is 0-indexed in JavaScript
        };

        const startDate = parseLocalDate(startDateStr);
        const endDate = parseLocalDate(endDateStr);

        // Add event to all dates between start and end (inclusive)
        const currentDate = new Date(startDate);
        while (currentDate <= endDate) {
          // Format date key manually to avoid timezone issues
          const year = currentDate.getFullYear();
          const month = String(currentDate.getMonth() + 1).padStart(2, '0');
          const day = String(currentDate.getDate()).padStart(2, '0');
          const dateKey = `${year}-${month}-${day}`;

          if (!groupedEvents[dateKey]) {
            groupedEvents[dateKey] = [];
          }

          // Add additional properties to indicate if this is start, middle, or end of multi-day event
          const eventCopy = {
            ...event,
            // Ensure dates are returned as YYYY-MM-DD strings to avoid timezone issues
            event_date: startDateStr,
            end_date: event.end_date ? endDateStr : null,
            isMultiDay: startDateStr !== endDateStr,
            isEventStart: dateKey === startDateStr,
            isEventEnd: dateKey === endDateStr,
            originalStartDate: startDateStr,
            originalEndDate: endDateStr
          };

          groupedEvents[dateKey].push(eventCopy);

          // Move to next day using setDate to avoid timezone issues
          currentDate.setDate(currentDate.getDate() + 1);
        }
      });

      return groupedEvents;
    } catch (error) {
      throw new ValidationError(`Failed to get calendar events: ${error.message}`);
    }
  }

  // Calendar attachment methods
  async createAttachment(data) {
    try {
      this.validateRequired(data, ['calendar_id', 'file_name', 'file_path', 'file_size', 'mime_type']);

      const attachmentData = {
        calendar_id: data.calendar_id,
        file_name: data.file_name,
        file_path: data.file_path,
        file_type: data.file_type || 'image',
        file_size: data.file_size,
        mime_type: data.mime_type,
        display_order: data.display_order || 0,
        is_primary: data.is_primary || 0,
        uploaded_at: new Date()
      };

      const result = await this.db.query(
        'INSERT INTO calendar_attachments SET ?',
        [attachmentData]
      );

      return await this.getAttachmentById(result.insertId);
    } catch (error) {
      throw new ValidationError(`Failed to create calendar attachment: ${error.message}`);
    }
  }

  async getAttachmentById(attachmentId) {
    try {
      const sql = `
        SELECT * FROM calendar_attachments
        WHERE attachment_id = ? AND deleted_at IS NULL
      `;
      const attachments = await this.db.query(sql, [attachmentId]);
      return attachments[0] || null;
    } catch (error) {
      throw new ValidationError(`Failed to get calendar attachment: ${error.message}`);
    }
  }

  async getAttachmentsByCalendarId(calendarId) {
    try {
      const sql = `
        SELECT * FROM calendar_attachments
        WHERE calendar_id = ? AND deleted_at IS NULL
        ORDER BY display_order ASC, uploaded_at ASC
      `;
      return await this.db.query(sql, [calendarId]);
    } catch (error) {
      throw new ValidationError(`Failed to get calendar attachments: ${error.message}`);
    }
  }

  async updateAttachment(attachmentId, data) {
    try {
      const updateData = {
        ...data,
        updated_at: new Date()
      };

      await this.db.query(
        'UPDATE calendar_attachments SET ? WHERE attachment_id = ? AND deleted_at IS NULL',
        [updateData, attachmentId]
      );

      return await this.getAttachmentById(attachmentId);
    } catch (error) {
      throw new ValidationError(`Failed to update calendar attachment: ${error.message}`);
    }
  }

  async deleteAttachment(attachmentId) {
    try {
      await this.db.query(
        'UPDATE calendar_attachments SET deleted_at = NOW() WHERE attachment_id = ?',
        [attachmentId]
      );
      return true;
    } catch (error) {
      throw new ValidationError(`Failed to delete calendar attachment: ${error.message}`);
    }
  }

  async setPrimaryAttachment(calendarId, attachmentId) {
    try {
      // Start transaction
      await this.db.query('START TRANSACTION');

      // Remove primary flag from all attachments for this calendar
      await this.db.query(
        'UPDATE calendar_attachments SET is_primary = 0 WHERE calendar_id = ? AND deleted_at IS NULL',
        [calendarId]
      );

      // Set the specified attachment as primary
      await this.db.query(
        'UPDATE calendar_attachments SET is_primary = 1 WHERE attachment_id = ? AND calendar_id = ? AND deleted_at IS NULL',
        [attachmentId, calendarId]
      );

      await this.db.query('COMMIT');
      return true;
    } catch (error) {
      await this.db.query('ROLLBACK');
      throw new ValidationError(`Failed to set primary attachment: ${error.message}`);
    }
  }

  // Soft delete calendar event
  async softDeleteEvent(eventId) {
    try {
      await this.db.query(
        'UPDATE school_calendar SET deleted_at = NOW() WHERE calendar_id = ?',
        [eventId]
      );
      return true;
    } catch (error) {
      throw new ValidationError(`Failed to soft delete calendar event: ${error.message}`);
    }
  }

  // Restore soft deleted event
  async restoreEvent(eventId) {
    try {
      await this.db.query(
        'UPDATE school_calendar SET deleted_at = NULL WHERE calendar_id = ?',
        [eventId]
      );
      return true;
    } catch (error) {
      throw new ValidationError(`Failed to restore calendar event: ${error.message}`);
    }
  }

  // Get archived calendar events (is_active = 0 and not soft deleted)
  async getArchivedEvents(filters = {}, pagination = {}) {
    try {
      const {
        search,
        category_id,
        subcategory_id,
        created_by,
        start_date,
        end_date
      } = filters;

      const {
        page = 1,
        limit = 20,
        sort_by = 'updated_at',
        sort_order = 'DESC'
      } = pagination;

      // Include both inactive (archived) events and soft deleted events
      let whereConditions = ['(sc.is_active = 0 OR sc.deleted_at IS NOT NULL)'];
      let queryParams = [];

      // Add search filter
      if (search) {
        whereConditions.push('(sc.title LIKE ? OR sc.description LIKE ?)');
        queryParams.push(`%${search}%`, `%${search}%`);
      }

      // Add category filter
      if (category_id) {
        whereConditions.push('sc.category_id = ?');
        queryParams.push(category_id);
      }

      // Add subcategory filter
      if (subcategory_id) {
        whereConditions.push('sc.subcategory_id = ?');
        queryParams.push(subcategory_id);
      }

      // Add creator filter
      if (created_by) {
        whereConditions.push('sc.created_by = ?');
        queryParams.push(created_by);
      }

      // Add date range filter
      if (start_date) {
        whereConditions.push('DATE(sc.deleted_at) >= ?');
        queryParams.push(start_date);
      }

      if (end_date) {
        whereConditions.push('DATE(sc.deleted_at) <= ?');
        queryParams.push(end_date);
      }

      const whereClause = whereConditions.join(' AND ');

      // Get total count
      const countSql = `
        SELECT COUNT(*) as total
        FROM school_calendar sc
        WHERE ${whereClause}
      `;
      const countResult = await this.db.findOne(countSql, queryParams);
      const total = countResult.total;

      // Calculate pagination
      const offset = (page - 1) * limit;
      const totalPages = Math.ceil(total / limit);

      // Get archived events with full details
      const sql = `
        SELECT
          sc.*,
          c.name as category_name,
          c.color_code as category_color,
          s.name as subcategory_name,
          s.color_code as subcategory_color,
          COALESCE(
            CASE
              WHEN ap.first_name IS NOT NULL OR ap.last_name IS NOT NULL
              THEN TRIM(CONCAT(COALESCE(ap.first_name, ''), ' ', COALESCE(ap.last_name, '')))
              WHEN aa.email IS NOT NULL
              THEN aa.email
              ELSE 'Unknown Creator'
            END,
            'Unknown Creator'
          ) as created_by_name
        FROM school_calendar sc
        LEFT JOIN categories c ON sc.category_id = c.category_id
        LEFT JOIN subcategories s ON sc.subcategory_id = s.subcategory_id
        LEFT JOIN admin_accounts aa ON sc.created_by = aa.admin_id
        LEFT JOIN admin_profiles ap ON aa.admin_id = ap.admin_id
        WHERE ${whereClause}
        ORDER BY sc.${sort_by} ${sort_order}
        LIMIT ? OFFSET ?
      `;

      queryParams.push(limit, offset);
      const events = await this.db.query(sql, queryParams);

      // Format dates for each event
      const formattedEvents = events.map(event => this.formatEventDates(event));

      return {
        data: formattedEvents,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      };
    } catch (error) {
      throw new ValidationError(`Failed to get archived calendar events: ${error.message}`);
    }
  }

  // Publish/unpublish event
  async publishEvent(eventId) {
    try {
      await this.db.query(
        'UPDATE school_calendar SET is_published = 1 WHERE calendar_id = ?',
        [eventId]
      );
      return await this.getEventById(eventId);
    } catch (error) {
      throw new ValidationError(`Failed to publish calendar event: ${error.message}`);
    }
  }

  async unpublishEvent(eventId) {
    try {
      await this.db.query(
        'UPDATE school_calendar SET is_published = 0 WHERE calendar_id = ?',
        [eventId]
      );
      return await this.getEventById(eventId);
    } catch (error) {
      throw new ValidationError(`Failed to unpublish calendar event: ${error.message}`);
    }
  }

  // Add reaction to calendar event (following announcement pattern)
  async addReaction(calendarId, userId, userType) {
    try {
      console.log(`[DEBUG] CalendarModel.addReaction - Calendar: ${calendarId}, User: ${userType} ${userId}`);

      // Check if user already reacted
      const existingReaction = await this.db.findOne(
        'SELECT reaction_log_id FROM calendar_reactions WHERE calendar_id = ? AND user_id = ? AND user_type = ?',
        [calendarId, userId, userType]
      );

      console.log(`[DEBUG] Existing reaction found:`, existingReaction);

      if (existingReaction) {
        // Update existing reaction timestamp (like announcements do)
        console.log(`[DEBUG] Updating existing reaction timestamp`);
        await this.db.update(
          'calendar_reactions',
          { created_at: new Date() },
          'reaction_log_id = ?',
          [existingReaction.reaction_log_id]
        );
        return { added: true, message: 'Reaction updated successfully' };
      } else {
        // Create new reaction
        console.log(`[DEBUG] Creating new reaction for ${userType} ${userId} on calendar ${calendarId}`);
        const insertResult = await this.db.insert('calendar_reactions', {
          calendar_id: calendarId,
          user_type: userType,
          user_id: userId,
          created_at: new Date()
        });
        console.log(`[DEBUG] Insert result:`, insertResult);
        return { added: true, message: 'Reaction added successfully' };
      }
    } catch (error) {
      throw new ValidationError(`Failed to add calendar reaction: ${error.message}`);
    }
  }

  // Remove reaction from calendar event
  async removeReaction(calendarId, userId, userType) {
    try {
      const result = await this.db.delete(
        'calendar_reactions',
        'calendar_id = ? AND user_id = ? AND user_type = ?',
        [calendarId, userId, userType]
      );

      return {
        removed: result.affectedRows > 0,
        message: result.affectedRows > 0 ? 'Reaction removed successfully' : 'No reaction to remove'
      };
    } catch (error) {
      throw new ValidationError(`Failed to remove calendar reaction: ${error.message}`);
    }
  }

  // Check if user has reacted to a calendar event
  async hasUserReacted(calendarId, userId, userType) {
    try {
      const reaction = await this.db.findOne(
        'SELECT reaction_log_id FROM calendar_reactions WHERE calendar_id = ? AND user_id = ? AND user_type = ?',
        [calendarId, userId, userType]
      );
      return !!reaction;
    } catch (error) {
      throw new ValidationError(`Failed to check user reaction: ${error.message}`);
    }
  }

  // Get archive statistics
  async getArchiveStats() {
    try {
      const sql = `
        SELECT
          COUNT(CASE WHEN is_active = 0 AND deleted_at IS NULL THEN 1 END) as archived,
          COUNT(CASE WHEN deleted_at IS NOT NULL THEN 1 END) as soft_deleted,
          COUNT(CASE WHEN end_date IS NOT NULL AND end_date <= CURDATE() AND is_active = 1 AND deleted_at IS NULL THEN 1 END) as expired_not_archived
        FROM school_calendar;
      `;

      const [stats] = await this.db.query(sql);
      return stats[0];
    } catch (error) {
      throw new ValidationError(`Failed to get archive statistics: ${error.message}`);
    }
  }
}

module.exports = new CalendarModel();
// Updated to include author profile pictures
