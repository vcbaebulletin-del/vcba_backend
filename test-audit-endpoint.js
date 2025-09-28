const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
require('dotenv').config();

// Create a simple test server
const app = express();

// Basic middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002'],
  credentials: true
}));
app.use(express.json());

// Database connection
let dbConnection;

async function initDatabase() {
  try {
    dbConnection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'db_ebulletin_system',
      port: process.env.DB_PORT || 3306
    });
    console.log('✅ Database connected successfully');
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
}

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Test audit logs endpoint without authentication
app.get('/api/audit-logs', async (req, res) => {
  try {
    console.log('📋 Testing audit logs endpoint...');
    console.log('Query params:', req.query);

    if (!dbConnection) {
      throw new Error('Database not connected');
    }

    const { page = 1, limit = 20 } = req.query;

    // Simple query to test database connection
    const sql = `
      SELECT
        log_id,
        user_type,
        user_id,
        action_type,
        target_table,
        performed_at,
        description
      FROM audit_logs
      ORDER BY performed_at DESC
      LIMIT ? OFFSET ?
    `;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const [logs] = await dbConnection.execute(sql, [parseInt(limit), offset]);

    // Get total count
    const countSql = 'SELECT COUNT(*) as total FROM audit_logs';
    const [countResult] = await dbConnection.execute(countSql);
    const total = countResult[0]?.total || 0;

    console.log(`✅ Found ${logs.length} audit logs (total: ${total})`);

    res.json({
      success: true,
      data: logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: total,
        total_pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('❌ Error in audit logs endpoint:', error);
    res.status(500).json({
      success: false,
      message: error.message,
      error: 'Internal server error'
    });
  }
});

// Start server
const PORT = 5001; // Use different port to avoid conflicts

async function startServer() {
  const dbConnected = await initDatabase();
  if (!dbConnected) {
    console.error('❌ Cannot start server without database connection');
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`🚀 Test server running on port ${PORT}`);
    console.log(`🔍 Test audit logs at: http://localhost:${PORT}/api/audit-logs?page=1&limit=20`);
    console.log(`🌐 Health check at: http://localhost:${PORT}/health`);
  });
}

startServer();
