const Holidays = require('date-holidays');
const CalendarModel = require('../models/CalendarModel');
const logger = require('../utils/logger');

class HolidayService {
  constructor() {
    this.holidays = new Holidays();
    
    // Define additional international holidays not covered by date-holidays
    this.additionalHolidays = {
      // International holidays that should be included globally
      'valentine': {
        name: 'Valentine\'s Day',
        date: '02-14',
        type: 'observance',
        category: 'International'
      },
      'international_workers_day': {
        name: 'International Workers\' Day / Labour Day',
        date: '05-01',
        type: 'public',
        category: 'International'
      },
      'world_environment_day': {
        name: 'World Environment Day',
        date: '06-05',
        type: 'observance',
        category: 'International'
      },
      'international_womens_day': {
        name: 'International Women\'s Day',
        date: '03-08',
        type: 'observance',
        category: 'International'
      }
    };

    // Philippine-specific holidays that might need manual definition
    this.philippineHolidays = {
      'araw_ng_kagitingan': {
        name: 'Araw ng Kagitingan (Day of Valor)',
        date: '04-09',
        type: 'public',
        category: 'Philippine'
      },
      'national_heroes_day': {
        name: 'National Heroes Day',
        date: 'last monday in August',
        type: 'public',
        category: 'Philippine'
      },
      'bonifacio_day': {
        name: 'Bonifacio Day',
        date: '11-30',
        type: 'public',
        category: 'Philippine'
      },
      'rizal_day': {
        name: 'Rizal Day',
        date: '12-30',
        type: 'public',
        category: 'Philippine'
      }
    };
  }

  /**
   * Map holiday category to database enum values
   */
  mapHolidayType(category) {
    switch (category.toLowerCase()) {
      case 'philippine':
        return 'local';
      case 'international':
        return 'international';
      case 'religious':
        return 'international'; // Religious holidays are treated as international
      default:
        return 'local';
    }
  }

  /**
   * Get holidays for Philippines for a specific year
   */
  getPhilippineHolidays(year) {
    try {
      this.holidays.init('PH'); // Initialize for Philippines
      const holidays = this.holidays.getHolidays(year);
      
      return holidays.map(holiday => ({
        name: holiday.name,
        date: holiday.date.split(' ')[0], // Get just the date part
        start: holiday.start,
        end: holiday.end,
        type: holiday.type || 'public',
        category: 'Philippine',
        country_code: 'PH',
        is_fixed: !holiday.rule || holiday.rule.includes('01-01') || holiday.rule.includes('12-25'),
        api_source: 'date-holidays',
        rule: holiday.rule
      }));
    } catch (error) {
      logger.error('Error fetching Philippine holidays:', error);
      return [];
    }
  }

  /**
   * Get international holidays for a specific year
   */
  getInternationalHolidays(year) {
    const internationalHolidays = [];
    
    // Countries to include for international holidays
    const countries = ['US', 'GB', 'CN', 'IN', 'DE', 'FR', 'JP', 'AU', 'CA'];
    
    countries.forEach(countryCode => {
      try {
        this.holidays.init(countryCode);
        const holidays = this.holidays.getHolidays(year);
        
        // Filter for globally recognized holidays
        const globalHolidays = holidays.filter(holiday => {
          const name = holiday.name.toLowerCase();
          return (
            name.includes('new year') ||
            name.includes('christmas') ||
            name.includes('easter') ||
            name.includes('valentine') ||
            name.includes('mother') ||
            name.includes('father') ||
            name.includes('halloween') ||
            name.includes('labour') ||
            name.includes('labor')
          );
        });

        globalHolidays.forEach(holiday => {
          // Avoid duplicates by checking if we already have this holiday
          const exists = internationalHolidays.find(h => 
            h.name === holiday.name && h.date === holiday.date.split(' ')[0]
          );
          
          if (!exists) {
            internationalHolidays.push({
              name: holiday.name,
              date: holiday.date.split(' ')[0],
              start: holiday.start,
              end: holiday.end,
              type: holiday.type || 'observance',
              category: 'International',
              country_code: countryCode,
              is_fixed: !holiday.rule || holiday.rule.includes('01-01') || holiday.rule.includes('12-25'),
              api_source: 'date-holidays',
              rule: holiday.rule
            });
          }
        });
      } catch (error) {
        logger.warn(`Error fetching holidays for ${countryCode}:`, error.message);
      }
    });

    return internationalHolidays;
  }

  /**
   * Get additional manually defined holidays
   */
  getAdditionalHolidays(year) {
    const holidays = [];
    
    // Add additional international holidays
    Object.entries(this.additionalHolidays).forEach(([key, holiday]) => {
      holidays.push({
        name: holiday.name,
        date: `${year}-${holiday.date}`,
        type: holiday.type,
        category: holiday.category,
        country_code: null,
        is_fixed: true,
        api_source: 'manual',
        rule: holiday.date
      });
    });

    return holidays;
  }

  /**
   * Get religious holidays (Islamic, Hindu, Jewish, etc.)
   */
  getReligiousHolidays(year) {
    const religiousHolidays = [];
    
    try {
      // Get Islamic holidays (approximate dates)
      const islamicCountries = ['SA', 'AE', 'ID', 'MY'];
      
      islamicCountries.forEach(countryCode => {
        try {
          this.holidays.init(countryCode);
          const holidays = this.holidays.getHolidays(year);
          
          const islamicHolidays = holidays.filter(holiday => {
            const name = holiday.name.toLowerCase();
            return (
              name.includes('eid') ||
              name.includes('ramadan') ||
              name.includes('mawlid') ||
              name.includes('isra') ||
              name.includes('lailat')
            );
          });

          islamicHolidays.forEach(holiday => {
            const exists = religiousHolidays.find(h => 
              h.name === holiday.name && h.date === holiday.date.split(' ')[0]
            );
            
            if (!exists) {
              religiousHolidays.push({
                name: holiday.name,
                date: holiday.date.split(' ')[0],
                start: holiday.start,
                end: holiday.end,
                type: 'observance',
                category: 'Religious',
                subcategory: 'Islamic',
                country_code: countryCode,
                is_fixed: false,
                api_source: 'date-holidays',
                rule: holiday.rule
              });
            }
          });
        } catch (error) {
          logger.warn(`Error fetching Islamic holidays for ${countryCode}:`, error.message);
        }
      });

      // Get Hindu holidays
      this.holidays.init('IN');
      const indiaHolidays = this.holidays.getHolidays(year);
      
      const hinduHolidays = indiaHolidays.filter(holiday => {
        const name = holiday.name.toLowerCase();
        return (
          name.includes('diwali') ||
          name.includes('holi') ||
          name.includes('dussehra') ||
          name.includes('ganesh') ||
          name.includes('navratri')
        );
      });

      hinduHolidays.forEach(holiday => {
        religiousHolidays.push({
          name: holiday.name,
          date: holiday.date.split(' ')[0],
          start: holiday.start,
          end: holiday.end,
          type: 'observance',
          category: 'Religious',
          subcategory: 'Hindu',
          country_code: 'IN',
          is_fixed: false,
          api_source: 'date-holidays',
          rule: holiday.rule
        });
      });

      // Get Jewish holidays
      this.holidays.init('IL');
      const israelHolidays = this.holidays.getHolidays(year);
      
      const jewishHolidays = israelHolidays.filter(holiday => {
        const name = holiday.name.toLowerCase();
        return (
          name.includes('rosh hashanah') ||
          name.includes('yom kippur') ||
          name.includes('hanukkah') ||
          name.includes('passover') ||
          name.includes('sukkot')
        );
      });

      jewishHolidays.forEach(holiday => {
        religiousHolidays.push({
          name: holiday.name,
          date: holiday.date.split(' ')[0],
          start: holiday.start,
          end: holiday.end,
          type: 'observance',
          category: 'Religious',
          subcategory: 'Jewish',
          country_code: 'IL',
          is_fixed: false,
          api_source: 'date-holidays',
          rule: holiday.rule
        });
      });

    } catch (error) {
      logger.error('Error fetching religious holidays:', error);
    }

    return religiousHolidays;
  }

  /**
   * Get all holidays for a specific year
   */
  async getAllHolidays(year) {
    try {
      const philippineHolidays = this.getPhilippineHolidays(year);
      const internationalHolidays = this.getInternationalHolidays(year);
      const additionalHolidays = this.getAdditionalHolidays(year);
      const religiousHolidays = this.getReligiousHolidays(year);

      // Combine all holidays
      const allHolidays = [
        ...philippineHolidays,
        ...internationalHolidays,
        ...additionalHolidays,
        ...religiousHolidays
      ];

      // Remove duplicates based on date and name similarity
      const uniqueHolidays = this.removeDuplicateHolidays(allHolidays);

      logger.info(`Fetched ${uniqueHolidays.length} holidays for year ${year}`);
      return uniqueHolidays;
    } catch (error) {
      logger.error('Error fetching all holidays:', error);
      throw error;
    }
  }

  /**
   * Remove duplicate holidays based on date and name similarity
   */
  removeDuplicateHolidays(holidays) {
    const uniqueHolidays = [];
    const seenHolidays = new Set();

    holidays.forEach(holiday => {
      const key = `${holiday.date}-${holiday.name.toLowerCase().replace(/[^a-z0-9]/g, '')}`;

      if (!seenHolidays.has(key)) {
        seenHolidays.add(key);
        uniqueHolidays.push(holiday);
      }
    });

    return uniqueHolidays.sort((a, b) => new Date(a.date) - new Date(b.date));
  }

  /**
   * Sync holidays to database for a specific year
   */
  async syncHolidaysToDatabase(year, adminId = 1) {
    try {
      logger.info(`Starting holiday sync for year ${year}`);

      const holidays = await this.getAllHolidays(year);
      const syncResults = {
        created: 0,
        updated: 0,
        skipped: 0,
        errors: []
      };

      // Get or create holiday categories
      const categoryMap = await this.ensureHolidayCategories();

      for (const holiday of holidays) {
        try {
          // Check if holiday already exists
          const existingHoliday = await this.findExistingHoliday(holiday.date, holiday.name);

          if (existingHoliday && existingHoliday.is_auto_generated) {
            // Update existing auto-generated holiday
            await this.updateHolidayInDatabase(existingHoliday.calendar_id, holiday, categoryMap, adminId);
            syncResults.updated++;
          } else if (existingHoliday && !existingHoliday.is_holiday) {
            // Update existing non-holiday record to be a holiday (from previous incomplete sync)
            await this.updateHolidayInDatabase(existingHoliday.calendar_id, holiday, categoryMap, adminId);
            syncResults.updated++;
          } else if (!existingHoliday) {
            // Create new holiday
            await this.createHolidayInDatabase(holiday, categoryMap, adminId);
            syncResults.created++;
          } else {
            // Skip manually created holidays
            syncResults.skipped++;
          }
        } catch (error) {
          logger.error(`Error syncing holiday ${holiday.name}:`, error);
          syncResults.errors.push({
            holiday: holiday.name,
            error: error.message
          });
        }
      }

      logger.info(`Holiday sync completed for year ${year}:`, syncResults);
      return syncResults;
    } catch (error) {
      logger.error('Error syncing holidays to database:', error);
      throw error;
    }
  }

  /**
   * Ensure holiday categories exist in database
   */
  async ensureHolidayCategories() {
    const categories = {
      'Philippine': { name: 'Philippine Holidays', color: '#FF6B6B' },
      'International': { name: 'International Holidays', color: '#4ECDC4' },
      'Religious': { name: 'Religious Holidays', color: '#45B7D1' }
    };

    const categoryMap = {};

    for (const [key, category] of Object.entries(categories)) {
      try {
        // Check if category exists
        const existingCategory = await CalendarModel.db.findOne(
          'SELECT category_id FROM categories WHERE name = ?',
          [category.name]
        );

        if (existingCategory) {
          categoryMap[key] = existingCategory.category_id;
        } else {
          // Create category
          const result = await CalendarModel.db.insert('categories', {
            name: category.name,
            color_code: category.color,
            description: `${category.name} category for calendar events`,
            is_active: 1,
            created_at: new Date(),
            updated_at: new Date()
          });
          categoryMap[key] = result.insertId;
        }
      } catch (error) {
        logger.error(`Error ensuring category ${key}:`, error);
      }
    }

    return categoryMap;
  }

  /**
   * Find existing holiday in database
   */
  async findExistingHoliday(date, name) {
    try {
      return await CalendarModel.db.findOne(
        'SELECT * FROM school_calendar WHERE event_date = ? AND title = ? AND deleted_at IS NULL',
        [date, name]
      );
    } catch (error) {
      logger.error('Error finding existing holiday:', error);
      return null;
    }
  }

  /**
   * Create holiday in database
   */
  async createHolidayInDatabase(holiday, categoryMap, adminId) {
    const categoryId = categoryMap[holiday.category] || null;

    const eventData = {
      title: holiday.name,
      description: `${holiday.category} holiday${holiday.country_code ? ` (${holiday.country_code})` : ''}`,
      event_date: holiday.date,
      end_date: null,
      category_id: categoryId,
      subcategory_id: null,
      is_recurring: 0,
      recurrence_pattern: null,
      is_active: 1,
      is_published: 1,
      allow_comments: 1,
      is_alert: 0,
      is_holiday: 1,
      holiday_type: this.mapHolidayType(holiday.category),
      country_code: holiday.country_code || 'PH',
      is_auto_generated: 1,
      api_source: holiday.api_source,
      local_name: holiday.name,
      holiday_types: JSON.stringify([holiday.type]),
      is_global: holiday.category === 'International' ? 1 : 0,
      is_fixed: holiday.is_fixed ? 1 : 0,
      created_by: adminId,
      created_at: new Date(),
      updated_at: new Date()
    };

    // Use direct database insert since CalendarModel.createEvent doesn't handle holiday fields
    return await CalendarModel.db.insert('school_calendar', eventData);
  }

  /**
   * Update holiday in database
   */
  async updateHolidayInDatabase(calendarId, holiday, categoryMap, adminId) {
    const categoryId = categoryMap[holiday.category] || null;

    const updateData = {
      title: holiday.name,
      description: `${holiday.category} holiday${holiday.country_code ? ` (${holiday.country_code})` : ''}`,
      category_id: categoryId,
      holiday_type: this.mapHolidayType(holiday.category),
      country_code: holiday.country_code || 'PH',
      api_source: holiday.api_source,
      local_name: holiday.name,
      holiday_types: JSON.stringify([holiday.type]),
      is_global: holiday.category === 'International' ? 1 : 0,
      is_fixed: holiday.is_fixed ? 1 : 0,
      updated_at: new Date()
    };

    // Use direct database update since CalendarModel.updateEvent doesn't handle holiday fields
    return await CalendarModel.db.update(
      'school_calendar',
      updateData,
      'calendar_id = ?',
      [calendarId]
    );
  }

  /**
   * Get holidays from database for a specific year
   */
  async getHolidaysFromDatabase(year, filters = {}) {
    try {
      const whereConditions = ['YEAR(sc.event_date) = ?', 'sc.is_holiday = 1', 'sc.deleted_at IS NULL'];
      const params = [year];

      if (filters.category) {
        whereConditions.push('sc.holiday_type = ?');
        params.push(this.mapHolidayType(filters.category));
      }

      if (filters.country_code) {
        whereConditions.push('sc.country_code = ?');
        params.push(filters.country_code);
      }

      const sql = `
        SELECT
          sc.*,
          c.name as category_name,
          c.color_code as category_color
        FROM school_calendar sc
        LEFT JOIN categories c ON sc.category_id = c.category_id
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY sc.event_date ASC
      `;

      const result = await CalendarModel.db.query(sql, params);
      logger.info(`Successfully retrieved ${result.length} holidays from database for year ${year}`);
      return result;
    } catch (error) {
      logger.error('Error getting holidays from database:', {
        year,
        filters,
        sql: sql.replace(/\s+/g, ' ').trim(),
        params,
        error: error.message,
        stack: error.stack
      });
      throw new Error(`Database operation failed: ${error.message}`);
    }
  }

  /**
   * Delete auto-generated holidays for a specific year
   */
  async deleteAutoGeneratedHolidays(year) {
    try {
      const result = await CalendarModel.db.query(
        'UPDATE school_calendar SET deleted_at = NOW() WHERE YEAR(event_date) = ? AND is_auto_generated = 1',
        [year]
      );

      logger.info(`Deleted ${result.affectedRows} auto-generated holidays for year ${year}`);
      return result.affectedRows;
    } catch (error) {
      logger.error('Error deleting auto-generated holidays:', error);
      throw error;
    }
  }
}

module.exports = new HolidayService();
