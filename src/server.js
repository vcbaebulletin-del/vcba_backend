const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const { createServer } = require('http');
const { Server } = require('socket.io');
require('express-async-errors');
require('dotenv').config();

const config = require('./config/config');
const logger = require('./utils/logger');
const { errorHandler } = require('./middleware/errorHandler');
const notFoundHandler = require('./middleware/notFoundHandler');
const database = require('./config/database');
const websocketService = require('./services/websocketService');
const emailService = require('./utils/email');

// Import routes with error handling
console.log('🔧 Loading route modules...');

// Function to safely load routes
function safeRequire(modulePath, name) {
  try {
    const module = require(modulePath);
    console.log(`✅ ${name} loaded`);
    return module;
  } catch (error) {
    console.error(`❌ Failed to load ${name}:`, error.message);
    logger.error(`Failed to load ${name}:`, error);
    // Return a dummy router that handles all methods
    const express = require('express');
    const dummyRouter = express.Router();
    dummyRouter.all('*', (req, res) => {
      res.status(503).json({
        success: false,
        message: `${name} service temporarily unavailable`,
        error: 'Module failed to load'
      });
    });
    return dummyRouter;
  }
}

const authRoutes = safeRequire('./routes/authRoutes', 'authRoutes');
const websocketRoutes = safeRequire('./routes/websocketRoutes', 'websocketRoutes');
const adminRoutes = safeRequire('./routes/adminRoutes', 'adminRoutes');
const studentRoutes = safeRequire('./routes/studentRoutes', 'studentRoutes');
const notificationRoutes = safeRequire('./routes/notificationRoutes', 'notificationRoutes');
const smsRoutes = safeRequire('./routes/smsRoutes', 'smsRoutes');
const calendarRoutes = safeRequire('./routes/calendarRoutes', 'calendarRoutes');
const announcementRoutes = safeRequire('./routes/announcementRoutes', 'announcementRoutes');
const commentRoutes = safeRequire('./routes/commentRoutes', 'commentRoutes');
const holidayRoutes = safeRequire('./routes/holidayRoutes', 'holidayRoutes');
const timeRoutes = safeRequire('./routes/timeRoutes', 'timeRoutes');

console.log('✅ Essential route modules loaded successfully');

const app = express();

// Trust proxy for rate limiting behind reverse proxy
app.set('trust proxy', 1);

// Security middleware - Disable helmet for uploads directory
app.use((req, res, next) => {
  if (req.path.startsWith('/uploads/')) {
    // Skip helmet for uploads
    return next();
  }

  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:', 'http://localhost:*'],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: false,
  })(req, res, next);
});

// CORS configuration - more permissive for static files
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    // Allow localhost on any port for development
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return callback(null, true);
    }

    // Allow configured origins
    if (config.cors.origin.includes(origin)) {
      return callback(null, true);
    }

    return callback(null, true); // Allow all for now to fix urgent issue
  },
  credentials: config.cors.credentials,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Origin', 'Accept', 'Cache-Control', 'cache-control', 'Pragma', 'pragma', 'Expires', 'expires'],
  exposedHeaders: ['Content-Length', 'Content-Type'],
}));

// Rate limiting removed per user request

// Compression middleware
app.use(compression());

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Import image optimization middleware
const { optimizeImage, addImageCacheHeaders } = require('./middleware/imageOptimization');

// Serve static files with explicit CORS headers and image optimization
app.use('/uploads', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Cache-Control, cache-control, Pragma, pragma, Expires, expires');
  res.header('Access-Control-Max-Age', '86400');
  res.header('Cross-Origin-Resource-Policy', 'cross-origin');
  res.header('Cross-Origin-Embedder-Policy', 'unsafe-none');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }

  next();
}, addImageCacheHeaders, optimizeImage, express.static('public/uploads'));

// Serve other static files with image optimization
app.use(addImageCacheHeaders, optimizeImage, express.static('public'));

// Logging middleware
if (config.env !== 'test') {
  app.use(morgan('combined', {
    stream: {
      write: (message) => logger.info(message.trim()),
    },
  }));
}

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

// API routes with error handling
console.log('🔧 Setting up API routes...');

// Function to safely use routes
function safeUseRoute(app, path, routeModule, name) {
  try {
    app.use(path, routeModule);
    console.log(`✅ ${name} route mounted at ${path}`);
  } catch (error) {
    console.error(`❌ Failed to mount ${name} route:`, error.message);
    logger.error(`Failed to mount ${name} route:`, error);
    // Mount a fallback route
    app.use(path, (req, res) => {
      res.status(503).json({
        success: false,
        message: `${name} service temporarily unavailable`,
        error: 'Route failed to mount'
      });
    });
  }
}

// Mount essential routes
safeUseRoute(app, '/api/auth', authRoutes, 'Auth');
safeUseRoute(app, '/api/websocket', websocketRoutes, 'WebSocket');
safeUseRoute(app, '/api/admin', adminRoutes, 'Admin');
safeUseRoute(app, '/api/student', studentRoutes, 'Student');
safeUseRoute(app, '/api/notifications', notificationRoutes, 'Notifications');
safeUseRoute(app, '/api/sms', smsRoutes, 'SMS');
safeUseRoute(app, '/api/calendar', calendarRoutes, 'Calendar');
safeUseRoute(app, '/api/announcements', announcementRoutes, 'Announcements');
safeUseRoute(app, '/api/comments', commentRoutes, 'Comments');
safeUseRoute(app, '/api/holidays', holidayRoutes, 'Holidays');
safeUseRoute(app, '/api/time', timeRoutes, 'Time');

// Additional routes with safe loading
const archiveRoutes = safeRequire('./routes/archiveRoutes', 'archiveRoutes');
safeUseRoute(app, '/api/archive', archiveRoutes, 'Archive');

const categoryRoutes = safeRequire('./routes/categoryRoutes', 'categoryRoutes');
safeUseRoute(app, '/api/categories', categoryRoutes, 'Categories');

const adminManagementRoutes = safeRequire('./routes/adminManagementRoutes', 'adminManagementRoutes');
safeUseRoute(app, '/api/admin-management', adminManagementRoutes, 'Admin Management');

const welcomePageRoutes = safeRequire('./routes/welcomePageRoutes', 'welcomePageRoutes');
safeUseRoute(app, '/api/welcome-page', welcomePageRoutes, 'Welcome Page');

const auditLogRoutes = safeRequire('./routes/auditLogRoutes', 'auditLogRoutes');
safeUseRoute(app, '/api/audit-logs', auditLogRoutes, 'Audit Logs');

const reportRoutes = safeRequire('./routes/reportRoutes', 'reportRoutes');
safeUseRoute(app, '/api/reports', reportRoutes, 'Reports');

const archivalRoutes = safeRequire('./routes/archivalRoutes', 'archivalRoutes');
safeUseRoute(app, '/api/archival', archivalRoutes, 'Archival');

console.log('✅ Essential API routes set up successfully');

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  logger.info(`${signal} received, shutting down gracefully`);

  try {
    // Stop archival service
    const archivalService = require('./services/archivalService');
    await archivalService.cleanup();
    logger.info('Archival service cleaned up');
  } catch (error) {
    logger.error('Error cleaning up archival service:', error);
  }

  try {
    // Close database connection
    await database.close();
    logger.info('Database connection closed');
  } catch (error) {
    logger.error('Error closing database:', error);
  }

  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Create HTTP server and Socket.IO instance
console.log('🔧 Creating HTTP server and Socket.IO instance...');
const PORT = config.port || 3000;
const server = createServer(app);
console.log(`🔧 HTTP server created, preparing to listen on port ${PORT}`);

const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true
  },
  path: '/ws',
  serveClient: true,
  allowEIO3: true
});
console.log('✅ Socket.IO instance created');

// Socket.IO connection handling
io.on('connection', (socket) => {
  logger.info(`New WebSocket connection: ${socket.id}`);

  // Join user to their personal room for targeted notifications
  socket.on('join-user-room', (userId) => {
    if (userId) {
      socket.join(`user-${userId}`);
      logger.debug(`User ${userId} joined their personal room`);
    }
  });

  // Join admin room for admin-specific events
  socket.on('join-admin-room', () => {
    socket.join('admin-room');
    logger.debug(`Admin joined admin room: ${socket.id}`);
  });

  // Handle announcement events
  socket.on('new-announcement', (data) => {
    // Broadcast new announcement to all connected clients
    socket.broadcast.emit('announcement-created', data);
    logger.debug('New announcement broadcasted to all clients');
  });

  // Handle comment events
  socket.on('new-comment', (data) => {
    // Broadcast new comment to all clients viewing the announcement
    socket.broadcast.emit('comment-added', data);
    logger.debug(`New comment broadcasted for announcement ${data.announcementId}`);
  });

  // Handle real-time notifications
  socket.on('send-notification', (data) => {
    const { userId, notification } = data;
    if (userId) {
      // Send to specific user
      io.to(`user-${userId}`).emit('notification', notification);
      logger.debug(`Notification sent to user ${userId}`);
    } else {
      // Broadcast to all users
      socket.broadcast.emit('notification', notification);
      logger.debug('Notification broadcasted to all users');
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    logger.info(`WebSocket disconnected: ${socket.id}`);
  });

  // Handle errors
  socket.on('error', (error) => {
    logger.error('WebSocket error:', error);
  });
});

// Initialize WebSocket service
console.log('🔧 Initializing WebSocket service...');
websocketService.initialize(io);
console.log('✅ WebSocket service initialized');

// Initialize Archival service
console.log('🔧 Initializing Archival service...');
const archivalService = require('./services/archivalService');
archivalService.initialize()
  .then(() => {
    console.log('✅ Archival service initialized');
    // Start the archival service
    archivalService.start();
    console.log('🚀 Archival service started');
  })
  .catch(error => {
    console.error('❌ Failed to initialize Archival service:', error.message);
    logger.error('Failed to initialize Archival service', error);
  });

// Make io instance available to routes
console.log('🔧 Setting up io instance for routes...');
app.set('io', io);
console.log('✅ IO instance set up');

// Start server
console.log('🚀 Starting server...');
logger.info('Starting server...');

// Add server startup timeout to prevent hanging
const startupTimeout = setTimeout(() => {
  console.error('⏰ Server startup timeout - forcing startup completion');
  logger.error('Server startup timeout');
}, 30000); // 30 second timeout

server.listen(PORT, () => {
  clearTimeout(startupTimeout);
  console.log(`✅ Server running on port ${PORT} in ${config.env} mode`);
  console.log(`🔌 WebSocket server available at /ws`);
  console.log(`🌐 Health check available at http://localhost:${PORT}/health`);
  console.log(`🎯 Welcome page API at http://localhost:${PORT}/api/welcome-page/test`);
  logger.info(`Server running on port ${PORT} in ${config.env} mode`);
  logger.info(`WebSocket server available at /ws`);

  // Perform a self-health check
  setTimeout(() => {
    console.log('🔍 Performing startup health check...');
    const http = require('http');
    const healthReq = http.get(`http://localhost:${PORT}/health`, (res) => {
      if (res.statusCode === 200) {
        console.log('✅ Health check passed - server is responsive');
      } else {
        console.log(`⚠️ Health check returned status: ${res.statusCode}`);
      }
    });

    healthReq.on('error', (err) => {
      console.log('⚠️ Health check failed:', err.message);
    });

    healthReq.setTimeout(5000, () => {
      console.log('⚠️ Health check timed out');
      healthReq.destroy();
    });
  }, 1000);
});

server.on('error', (err) => {
  clearTimeout(startupTimeout);
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use`);
    logger.error(`Port ${PORT} is already in use`);
  } else {
    console.error('❌ Server error:', err.message);
    logger.error('Server error:', err);
  }
});

// Keep the process alive
setInterval(() => {
  // Heartbeat to keep the process alive
  // This prevents the process from exiting unexpectedly
}, 30000);

// Handle unhandled promise rejections - Don't exit the process
process.on('unhandledRejection', (err, promise) => {
  logger.error('Unhandled Promise Rejection at:', promise, 'reason:', err);
  // Log the error but don't crash the server
  console.error('⚠️ Unhandled Promise Rejection:', err.message);
  console.error('Stack:', err.stack);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  console.error('💥 Uncaught Exception:', err.message);
  console.error('Stack:', err.stack);

  // Try to close the server gracefully
  if (server && server.listening) {
    server.close(() => {
      console.log('🔌 Server closed due to uncaught exception');
      process.exit(1);
    });

    // Force exit after 10 seconds
    setTimeout(() => {
      console.log('⏰ Forcing exit after timeout');
      process.exit(1);
    }, 10000);
  } else {
    process.exit(1);
  }
});

module.exports = app;
