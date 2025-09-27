const express = require('express');
const router = express.Router();
const websocketService = require('../services/websocketService');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * @route   GET /api/websocket/status
 * @desc    Get WebSocket server status
 * @access  Public
 */
router.get('/status', asyncHandler(async (req, res) => {
  const connectedClients = websocketService.getConnectedClientsCount();
  
  res.json({
    success: true,
    data: {
      status: 'active',
      connectedClients,
      endpoint: '/ws',
      timestamp: new Date().toISOString()
    }
  });
}));

/**
 * @route   POST /api/websocket/test-broadcast
 * @desc    Test broadcast message to all connected clients
 * @access  Public (should be protected in production)
 */
router.post('/test-broadcast', asyncHandler(async (req, res) => {
  const { message, type = 'test' } = req.body;
  
  if (!message) {
    return res.status(400).json({
      success: false,
      error: {
        message: 'Message is required'
      }
    });
  }
  
  const notification = {
    id: Date.now(),
    title: 'Test Notification',
    message,
    type,
    created_at: new Date().toISOString()
  };
  
  websocketService.broadcastNotification(notification);
  
  res.json({
    success: true,
    data: {
      message: 'Test broadcast sent successfully',
      notification,
      connectedClients: websocketService.getConnectedClientsCount()
    }
  });
}));

/**
 * @route   POST /api/websocket/test-announcement
 * @desc    Test announcement broadcast
 * @access  Public (should be protected in production)
 */
router.post('/test-announcement', asyncHandler(async (req, res) => {
  const { title, content, author = 'Test Admin' } = req.body;
  
  if (!title || !content) {
    return res.status(400).json({
      success: false,
      error: {
        message: 'Title and content are required'
      }
    });
  }
  
  const announcement = {
    id: Date.now(),
    title,
    content,
    author,
    created_at: new Date().toISOString(),
    priority: 'normal',
    category: 'general'
  };
  
  websocketService.broadcastNewAnnouncement(announcement);
  
  res.json({
    success: true,
    data: {
      message: 'Test announcement broadcast sent successfully',
      announcement,
      connectedClients: websocketService.getConnectedClientsCount()
    }
  });
}));

module.exports = router;
