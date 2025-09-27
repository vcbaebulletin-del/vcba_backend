const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = 5000;

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002'],
  credentials: true
}));
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  console.log('Health check requested');
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Simple audit logs endpoint (no auth for testing)
app.get('/api/audit-logs', (req, res) => {
  console.log('Audit logs endpoint called with params:', req.query);
  
  // Mock response for testing
  res.json({
    success: true,
    data: [
      {
        log_id: 1,
        user_type: 'admin',
        user_id: 1,
        action_type: 'LOGIN',
        target_table: 'admin_accounts',
        performed_at: new Date().toISOString(),
        description: 'Admin login'
      }
    ],
    pagination: {
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20,
      total: 1,
      total_pages: 1
    }
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Simple server running on port ${PORT}`);
  console.log(`🔍 Test audit logs at: http://localhost:${PORT}/api/audit-logs?page=1&limit=20`);
  console.log(`🌐 Health check at: http://localhost:${PORT}/health`);
});

// Error handling
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
});
