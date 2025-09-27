const express = require('express');
const { optionalAuth } = require('../middleware/auth');
const timezoneUtils = require('../utils/timezone');

const router = express.Router();

/**
 * Server Time API Routes
 * 
 * These endpoints provide secure, tamper-proof server time to prevent
 * client-side time manipulation and cheating attempts.
 * 
 * All times are returned in Asia/Manila timezone (UTC+8) for consistency.
 */

/**
 * GET /api/time/current
 * Get current server time in Asia/Manila timezone
 * 
 * Returns:
 * - timestamp: ISO string in Asia/Manila timezone
 * - unix: Unix timestamp (milliseconds)
 * - timezone: Timezone identifier
 * - offset: Timezone offset
 * - formatted: Human-readable format
 */
router.get('/current', optionalAuth, (req, res) => {
  try {
    const currentTime = timezoneUtils.now();
    
    const response = {
      timestamp: currentTime.toISOString(),
      unix: currentTime.valueOf(),
      timezone: timezoneUtils.getTimezoneName(),
      offset: timezoneUtils.getOffset(),
      formatted: timezoneUtils.formatForDisplay(currentTime),
      date: {
        year: currentTime.year(),
        month: currentTime.month() + 1, // moment.js months are 0-based
        day: currentTime.date(),
        hour: currentTime.hour(),
        minute: currentTime.minute(),
        second: currentTime.second()
      }
    };

    res.json({
      success: true,
      data: response,
      message: 'Current server time retrieved successfully'
    });
  } catch (error) {
    console.error('Error getting current server time:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get current server time',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * GET /api/time/validate
 * Validate client time against server time to detect tampering
 * 
 * Query params:
 * - client_time: Client's reported timestamp (ISO string)
 * 
 * Returns:
 * - server_time: Current server time
 * - client_time: Received client time
 * - difference: Time difference in seconds
 * - is_suspicious: Whether the difference indicates potential tampering
 * - threshold: Maximum allowed difference (seconds)
 */
router.get('/validate', optionalAuth, (req, res) => {
  try {
    const { client_time } = req.query;
    
    if (!client_time) {
      return res.status(400).json({
        success: false,
        message: 'client_time parameter is required'
      });
    }

    const serverTime = timezoneUtils.now();
    const clientTime = timezoneUtils.toPhilippinesTime(client_time);
    
    // Calculate difference in seconds
    const differenceMs = Math.abs(serverTime.valueOf() - clientTime.valueOf());
    const differenceSeconds = Math.floor(differenceMs / 1000);
    
    // Threshold for suspicious activity (5 minutes = 300 seconds)
    const suspiciousThreshold = 300;
    const isSuspicious = differenceSeconds > suspiciousThreshold;
    
    // Log suspicious activity
    if (isSuspicious && req.user) {
      console.warn(`🚨 Suspicious time difference detected for user ${req.user.user_id}: ${differenceSeconds}s`);
      // Could add audit logging here for security monitoring
    }

    const response = {
      server_time: {
        timestamp: serverTime.toISOString(),
        unix: serverTime.valueOf(),
        formatted: timezoneUtils.formatForDisplay(serverTime)
      },
      client_time: {
        timestamp: clientTime.toISOString(),
        unix: clientTime.valueOf(),
        formatted: timezoneUtils.formatForDisplay(clientTime)
      },
      difference: {
        seconds: differenceSeconds,
        minutes: Math.floor(differenceSeconds / 60),
        hours: Math.floor(differenceSeconds / 3600)
      },
      is_suspicious: isSuspicious,
      threshold: suspiciousThreshold,
      timezone: timezoneUtils.getTimezoneName()
    };

    res.json({
      success: true,
      data: response,
      message: isSuspicious 
        ? 'Suspicious time difference detected'
        : 'Time validation completed'
    });
  } catch (error) {
    console.error('Error validating time:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to validate time',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * GET /api/time/format
 * Format a given timestamp in Asia/Manila timezone
 * 
 * Query params:
 * - timestamp: Timestamp to format (ISO string or Unix timestamp)
 * - format: Optional format string (defaults to 'MMMM D, YYYY h:mm A')
 * 
 * Returns:
 * - original: Original timestamp
 * - formatted: Formatted timestamp in Asia/Manila timezone
 * - timezone: Timezone information
 */
router.get('/format', optionalAuth, (req, res) => {
  try {
    const { timestamp, format = 'MMMM D, YYYY h:mm A' } = req.query;
    
    if (!timestamp) {
      return res.status(400).json({
        success: false,
        message: 'timestamp parameter is required'
      });
    }

    const momentTime = timezoneUtils.toPhilippinesTime(timestamp);
    
    const response = {
      original: timestamp,
      formatted: timezoneUtils.formatForDisplay(momentTime, format),
      timezone: timezoneUtils.getTimezoneName(),
      offset: timezoneUtils.getOffset(),
      iso: momentTime.toISOString(),
      unix: momentTime.valueOf()
    };

    res.json({
      success: true,
      data: response,
      message: 'Timestamp formatted successfully'
    });
  } catch (error) {
    console.error('Error formatting timestamp:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to format timestamp',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * GET /api/time/range
 * Check if current server time is within a specified range
 * 
 * Query params:
 * - start_time: Start of time range (ISO string)
 * - end_time: End of time range (ISO string)
 * 
 * Returns:
 * - current_time: Current server time
 * - start_time: Range start time
 * - end_time: Range end time
 * - is_within_range: Whether current time is within the range
 * - time_until_start: Seconds until range starts (if not started)
 * - time_until_end: Seconds until range ends (if within range)
 */
router.get('/range', optionalAuth, (req, res) => {
  try {
    const { start_time, end_time } = req.query;
    
    if (!start_time || !end_time) {
      return res.status(400).json({
        success: false,
        message: 'start_time and end_time parameters are required'
      });
    }

    const currentTime = timezoneUtils.now();
    const startTime = timezoneUtils.toPhilippinesTime(start_time);
    const endTime = timezoneUtils.toPhilippinesTime(end_time);
    
    const isWithinRange = currentTime.isBetween(startTime, endTime, null, '[]');
    const timeUntilStart = startTime.isAfter(currentTime) 
      ? startTime.diff(currentTime, 'seconds') 
      : 0;
    const timeUntilEnd = endTime.isAfter(currentTime) 
      ? endTime.diff(currentTime, 'seconds') 
      : 0;

    const response = {
      current_time: {
        timestamp: currentTime.toISOString(),
        formatted: timezoneUtils.formatForDisplay(currentTime)
      },
      start_time: {
        timestamp: startTime.toISOString(),
        formatted: timezoneUtils.formatForDisplay(startTime)
      },
      end_time: {
        timestamp: endTime.toISOString(),
        formatted: timezoneUtils.formatForDisplay(endTime)
      },
      is_within_range: isWithinRange,
      time_until_start: timeUntilStart,
      time_until_end: timeUntilEnd,
      timezone: timezoneUtils.getTimezoneName()
    };

    res.json({
      success: true,
      data: response,
      message: 'Time range check completed'
    });
  } catch (error) {
    console.error('Error checking time range:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check time range',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

module.exports = router;
