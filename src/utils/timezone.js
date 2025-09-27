const moment = require('moment-timezone');
const config = require('../config/config');

/**
 * Timezone utility functions for Philippines (Asia/Manila) timezone
 */
class TimezoneUtils {
  constructor() {
    this.timezone = config.app.timezone || 'Asia/Manila';
    
    // Set default timezone for moment
    moment.tz.setDefault(this.timezone);
  }

  /**
   * Get current date/time in Philippines timezone
   * @returns {moment.Moment} Current moment in Philippines timezone
   */
  now() {
    return moment.tz(this.timezone);
  }

  /**
   * Convert UTC date to Philippines timezone
   * @param {Date|string|moment.Moment} date - Date to convert
   * @returns {moment.Moment} Date in Philippines timezone
   */
  toPhilippinesTime(date) {
    return moment.tz(date, this.timezone);
  }

  /**
   * Convert Philippines time to UTC
   * @param {Date|string|moment.Moment} date - Date to convert
   * @returns {moment.Moment} Date in UTC
   */
  toUTC(date) {
    return moment.tz(date, this.timezone).utc();
  }

  /**
   * Format date for database storage (MySQL DATETIME format in Philippines timezone)
   * @param {Date|string|moment.Moment} date - Date to format
   * @returns {string} Formatted date string (YYYY-MM-DD HH:mm:ss)
   */
  formatForDatabase(date = null) {
    const momentDate = date ? moment.tz(date, this.timezone) : this.now();
    return momentDate.format('YYYY-MM-DD HH:mm:ss');
  }

  /**
   * Format date for display (Philippines timezone)
   * @param {Date|string|moment.Moment} date - Date to format
   * @param {string} format - Moment.js format string
   * @returns {string} Formatted date string
   */
  formatForDisplay(date, format = 'MMMM D, YYYY h:mm A') {
    return moment.tz(date, this.timezone).format(format);
  }

  /**
   * Format date for API response (ISO string in Philippines timezone)
   * @param {Date|string|moment.Moment} date - Date to format
   * @returns {string} ISO formatted date string
   */
  formatForAPI(date) {
    return moment.tz(date, this.timezone).toISOString();
  }

  /**
   * Get start of day in Philippines timezone
   * @param {Date|string|moment.Moment} date - Date to get start of day for
   * @returns {moment.Moment} Start of day in Philippines timezone
   */
  startOfDay(date = null) {
    const momentDate = date ? moment.tz(date, this.timezone) : this.now();
    return momentDate.startOf('day');
  }

  /**
   * Get end of day in Philippines timezone
   * @param {Date|string|moment.Moment} date - Date to get end of day for
   * @returns {moment.Moment} End of day in Philippines timezone
   */
  endOfDay(date = null) {
    const momentDate = date ? moment.tz(date, this.timezone) : this.now();
    return momentDate.endOf('day');
  }

  /**
   * Check if a date is today in Philippines timezone
   * @param {Date|string|moment.Moment} date - Date to check
   * @returns {boolean} True if date is today
   */
  isToday(date) {
    return moment.tz(date, this.timezone).isSame(this.now(), 'day');
  }

  /**
   * Get timezone offset for Philippines
   * @returns {string} Timezone offset (+08:00)
   */
  getOffset() {
    return this.now().format('Z');
  }

  /**
   * Get timezone name
   * @returns {string} Timezone name (Asia/Manila)
   */
  getTimezoneName() {
    return this.timezone;
  }

  /**
   * Parse datetime-local input (from HTML forms) in Philippines timezone
   * @param {string} datetimeLocal - Datetime-local string (YYYY-MM-DDTHH:mm)
   * @returns {moment.Moment} Parsed moment in Philippines timezone
   */
  parseDatetimeLocal(datetimeLocal) {
    return moment.tz(datetimeLocal, 'YYYY-MM-DDTHH:mm', this.timezone);
  }

  /**
   * Format date for datetime-local input (HTML forms)
   * @param {Date|string|moment.Moment} date - Date to format
   * @returns {string} Formatted string for datetime-local input (YYYY-MM-DDTHH:mm)
   */
  formatForDatetimeLocal(date = null) {
    const momentDate = date ? moment.tz(date, this.timezone) : this.now();
    return momentDate.format('YYYY-MM-DDTHH:mm');
  }
}

// Create singleton instance
const timezoneUtils = new TimezoneUtils();

module.exports = timezoneUtils;
