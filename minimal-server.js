const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
require('express-async-errors');
require('dotenv').config();

const config = require('./src/config/config');
const logger = require('./src/utils/logger');
const { errorHandler } = require('./src/middleware/errorHandler');
const notFoundHandler = require('./src/middleware/notFoundHandler');

// Don't import routes that require database - create mock endpoints instead

const app = express();

// Trust proxy for rate limiting behind reverse proxy
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// CORS configuration
app.use(cors({
  origin: config.cors.origin,
  credentials: config.cors.credentials,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

// Compression middleware
app.use(compression());

// Logging middleware
app.use(morgan('combined', {
  stream: {
    write: (message) => logger.info(message.trim())
  }
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.env,
    version: process.env.npm_package_version || '1.0.0',
  });
});

// Test endpoint to verify server is working
app.get('/api/test', (req, res) => {
  console.log('[TEST] Test endpoint hit');
  res.json({ success: true, message: 'Minimal server is working', timestamp: new Date().toISOString() });
});

console.log('[SETUP] Setting up mock API routes...');

// Mock API endpoints to avoid database dependency
app.get('/api/notifications/unread-count', (req, res) => {
  res.json({
    success: true,
    data: { unread_count: 0 }
  });
});

app.get('/api/notifications', (req, res) => {
  res.json({
    success: true,
    data: [],
    pagination: {
      page: 1,
      limit: 10,
      total: 0,
      totalPages: 0
    }
  });
});



app.get('/api/calendar/view', (req, res) => {
  const { year = new Date().getFullYear(), month = new Date().getMonth() + 1 } = req.query;
  const eventDate = `${year}-${String(month).padStart(2, '0')}-15`;

  res.json({
    success: true,
    data: {
      events: {
        [eventDate]: [
          {
            event_id: 1,
            title: 'Sample Event',
            description: 'This is a sample calendar event',
            event_date: eventDate,
            end_date: eventDate,
            category_id: 1,
            subcategory_id: 1,
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        ]
      },
      year: parseInt(year),
      month: parseInt(month)
    }
  });
});

// IMPORTANT: Specific routes must come before parameterized routes
// Mock categories with subcategories endpoint (must come before /:categoryId routes)
app.get('/api/announcements/categories/with-subcategories', (req, res) => {
  console.log('[API] Categories with subcategories endpoint hit');
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.json({
    success: true,
    data: {
      categories: [
        {
          category_id: 1,
          name: 'General',
          description: 'General announcements',
          color_code: '#007bff',
          is_active: true,
          subcategories: [
            { subcategory_id: 13, name: 'Campus Updates', color_code: '#007bff', display_order: 1 },
            { subcategory_id: 14, name: 'Students Reminders', color_code: '#007bff', display_order: 2 },
            { subcategory_id: 15, name: 'Holidays', color_code: '#007bff', display_order: 3 },
            { subcategory_id: 16, name: 'Election', color_code: '#007bff', display_order: 4 }
          ]
        },
        {
          category_id: 2,
          name: 'Academic',
          description: 'Academic announcements',
          color_code: '#28a745',
          is_active: true,
          subcategories: [
            { subcategory_id: 1, name: 'Exam Schedules', color_code: '#28a745', display_order: 1 },
            { subcategory_id: 2, name: 'Grade Release', color_code: '#28a745', display_order: 2 },
            { subcategory_id: 3, name: 'Seminar', color_code: '#28a745', display_order: 3 }
          ]
        },
        {
          category_id: 3,
          name: 'Events',
          description: 'Event announcements',
          color_code: '#ffc107',
          is_active: true,
          subcategories: [
            { subcategory_id: 4, name: 'Cultural Events', color_code: '#ffc107', display_order: 1 },
            { subcategory_id: 5, name: 'Workshop', color_code: '#ffc107', display_order: 2 },
            { subcategory_id: 6, name: 'Sports', color_code: '#ffc107', display_order: 3 }
          ]
        },
        {
          category_id: 4,
          name: 'Emergency Notices',
          description: 'Emergency notifications',
          color_code: '#dc3545',
          is_active: true,
          subcategories: [
            { subcategory_id: 7, name: 'Typhoon Warning', color_code: '#dc3545', display_order: 1 },
            { subcategory_id: 8, name: 'Health Advisory', color_code: '#dc3545', display_order: 2 },
            { subcategory_id: 9, name: 'Earthquake Drill', color_code: '#dc3545', display_order: 3 },
            { subcategory_id: 10, name: 'Class Suspension', color_code: '#dc3545', display_order: 4 }
          ]
        },
        {
          category_id: 5,
          name: 'Deadlines',
          description: 'Important deadlines',
          color_code: '#fd7e14',
          is_active: true,
          subcategories: [
            { subcategory_id: 17, name: 'Payment Deadlines', color_code: '#fd7e14', display_order: 1 },
            { subcategory_id: 18, name: 'Scholarship Applications', color_code: '#fd7e14', display_order: 2 },
            { subcategory_id: 19, name: 'Clearance Signing', color_code: '#fd7e14', display_order: 3 }
          ]
        },
        {
          category_id: 6,
          name: 'Club Activities',
          description: 'Student club activities',
          color_code: '#000000',
          is_active: true,
          subcategories: [
            { subcategory_id: 20, name: 'Club Recruitment', color_code: '#000000', display_order: 1 },
            { subcategory_id: 21, name: 'Outreach Activities', color_code: '#000000', display_order: 2 },
            { subcategory_id: 22, name: 'Lost & Found', color_code: '#000000', display_order: 3 }
          ]
        }
      ]
    }
  });
});

// Mock categories endpoint (basic categories without subcategories)
app.get('/api/announcements/categories', (req, res) => {
  res.json({
    success: true,
    data: {
      categories: [
        { category_id: 1, name: 'General', description: 'General announcements', color_code: '#007bff', is_active: true },
        { category_id: 2, name: 'Academic', description: 'Academic announcements', color_code: '#28a745', is_active: true },
        { category_id: 3, name: 'Events', description: 'Event announcements', color_code: '#ffc107', is_active: true },
        { category_id: 4, name: 'Emergency Notices', description: 'Emergency notifications', color_code: '#dc3545', is_active: true },
        { category_id: 5, name: 'Deadlines', description: 'Important deadlines', color_code: '#fd7e14', is_active: true },
        { category_id: 6, name: 'Club Activities', description: 'Student club activities', color_code: '#000000', is_active: true }
      ]
    }
  });
});

// Mock subcategories endpoint
app.get('/api/announcements/subcategories', (req, res) => {
  res.json({
    success: true,
    data: {
      subcategories: [
        { subcategory_id: 1, category_id: 2, name: 'Exam Schedules', color_code: '#28a745', display_order: 1 },
        { subcategory_id: 2, category_id: 2, name: 'Grade Release', color_code: '#28a745', display_order: 2 },
        { subcategory_id: 3, category_id: 2, name: 'Seminar', color_code: '#28a745', display_order: 3 },
        { subcategory_id: 4, category_id: 3, name: 'Cultural Events', color_code: '#ffc107', display_order: 1 },
        { subcategory_id: 5, category_id: 3, name: 'Workshop', color_code: '#ffc107', display_order: 2 },
        { subcategory_id: 6, category_id: 3, name: 'Sports', color_code: '#ffc107', display_order: 3 }
      ]
    }
  });
});

// Mock subcategories by category endpoint (parameterized route - must come after specific routes)
app.get('/api/announcements/categories/:categoryId/subcategories', (req, res) => {
  const categoryId = parseInt(req.params.categoryId);
  const subcategoriesMap = {
    1: [
      { subcategory_id: 13, name: 'Campus Updates', color_code: '#007bff', display_order: 1 },
      { subcategory_id: 14, name: 'Students Reminders', color_code: '#007bff', display_order: 2 },
      { subcategory_id: 15, name: 'Holidays', color_code: '#007bff', display_order: 3 },
      { subcategory_id: 16, name: 'Election', color_code: '#007bff', display_order: 4 }
    ],
    2: [
      { subcategory_id: 1, name: 'Exam Schedules', color_code: '#28a745', display_order: 1 },
      { subcategory_id: 2, name: 'Grade Release', color_code: '#28a745', display_order: 2 },
      { subcategory_id: 3, name: 'Seminar', color_code: '#28a745', display_order: 3 }
    ],
    3: [
      { subcategory_id: 4, name: 'Cultural Events', color_code: '#ffc107', display_order: 1 },
      { subcategory_id: 5, name: 'Workshop', color_code: '#ffc107', display_order: 2 },
      { subcategory_id: 6, name: 'Sports', color_code: '#ffc107', display_order: 3 }
    ]
  };

  res.json({
    success: true,
    data: {
      subcategories: subcategoriesMap[categoryId] || []
    }
  });
});

app.get('/api/announcements', (req, res) => {
  res.json({
    success: true,
    data: [],
    pagination: {
      page: 1,
      limit: 10,
      total: 0,
      totalPages: 0
    }
  });
});

console.log('[SETUP] Mock API routes set up');

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

// Start server
const PORT = config.port || 5000;
console.log('[SERVER] Starting minimal server...');
logger.info('Starting minimal server...');

app.listen(PORT, () => {
  console.log(`[SERVER] Minimal server running on port ${PORT} in ${config.env} mode`);
  logger.info(`Minimal server running on port ${PORT} in ${config.env} mode`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Promise Rejection:', err);
  process.exit(1);
});

module.exports = app;
