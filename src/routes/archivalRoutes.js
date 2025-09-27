const express = require('express');
const router = express.Router();
const ArchivalController = require('../controllers/ArchivalController');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');

/**
 * Archival Routes
 * Provides API endpoints for monitoring and managing the automatic archival system
 */

// Public health check endpoint (no authentication required)
router.get('/health', ArchivalController.healthCheck);

// Public status endpoint (basic info only)
router.get('/status', ArchivalController.getStatus);

// Statistics endpoint (authenticated users can view stats)
router.get('/statistics', authenticateToken, ArchivalController.getStatistics);

// Logs endpoint (authenticated users can view logs)
router.get('/logs', authenticateToken, ArchivalController.getLogs);

// Manual archival run (admin only)
router.post('/run', authenticateToken, requireRole(['admin', 'super_admin']), ArchivalController.manualRun);

// Service control endpoints (admin only)
router.post('/start', authenticateToken, requireRole(['admin', 'super_admin']), ArchivalController.startService);
router.post('/stop', authenticateToken, requireRole(['admin', 'super_admin']), ArchivalController.stopService);

module.exports = router;
