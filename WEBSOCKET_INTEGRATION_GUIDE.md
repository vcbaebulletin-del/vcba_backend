# WebSocket Integration Guide - Zaira E-Bulletin Board System

## Overview

This guide explains how to use the WebSocket functionality implemented in the Zaira E-Bulletin Board System for real-time communication between the frontend and backend.

## Backend Implementation

### 1. WebSocket Server Setup

The WebSocket server is implemented using Socket.IO and is integrated with the Express.js server:

- **Endpoint**: `/ws`
- **Port**: 3000 (same as the main server)
- **Protocol**: Socket.IO v4.8.1

### 2. WebSocket Service

The `WebSocketService` class (`src/services/websocketService.js`) provides methods for:

- Broadcasting announcements
- Sending notifications
- Managing user rooms
- Admin-specific messaging
- System status updates

### 3. Available Events

#### Server-to-Client Events:
- `announcement-created` - New announcement broadcast
- `announcement-updated` - Announcement update
- `announcement-deleted` - Announcement deletion
- `comment-added` - New comment on announcement
- `notification` - General notification
- `admin-notification` - Admin-only notification
- `system-status` - System status update

#### Client-to-Server Events:
- `join-user-room` - Join user-specific room
- `join-admin-room` - Join admin room
- `new-announcement` - Broadcast new announcement
- `new-comment` - Broadcast new comment
- `send-notification` - Send notification

### 4. API Endpoints

- `GET /api/websocket/status` - Check WebSocket server status
- `POST /api/websocket/test-broadcast` - Send test notification
- `POST /api/websocket/test-announcement` - Send test announcement

## Frontend Implementation

### 1. WebSocket Hook

The `useWebSocket` hook (`src/hooks/useWebSocket.js`) provides:

```javascript
const {
  isConnected,
  connectionError,
  notifications,
  announcements,
  comments,
  connect,
  disconnect,
  joinAdminRoom,
  emit,
  markNotificationAsRead,
  clearNotifications
} = useWebSocket();
```

### 2. Basic Usage

```javascript
import useWebSocket from '../hooks/useWebSocket';

function MyComponent() {
  const { isConnected, notifications, connect } = useWebSocket();
  
  useEffect(() => {
    connect('user-123'); // Connect with user ID
  }, []);
  
  return (
    <div>
      <p>Status: {isConnected ? 'Connected' : 'Disconnected'}</p>
      <p>Notifications: {notifications.length}</p>
    </div>
  );
}
```

### 3. Advanced Usage

```javascript
// Join admin room (for admin users)
joinAdminRoom();

// Send custom event
emit('custom-event', { data: 'example' });

// Mark notification as read
markNotificationAsRead(notificationId);
```

## Testing

### 1. HTML Test Page

Access the test page at: `http://localhost:3000/websocket-test.html`

Features:
- Real-time connection testing
- Send test notifications
- Send test announcements
- View connection logs

### 2. React Demo Component

Access the React demo at: `http://localhost:3001/websocket-demo`

Features:
- Interactive WebSocket connection management
- Real-time data display
- Test message broadcasting
- Notification management

## Integration Examples

### 1. Real-time Announcements

```javascript
// In your announcement component
const { announcements } = useWebSocket();

useEffect(() => {
  // Announcements will automatically update when new ones are broadcast
  console.log('New announcements:', announcements);
}, [announcements]);
```

### 2. Live Notifications

```javascript
// In your notification component
const { notifications, markNotificationAsRead } = useWebSocket();

const handleNotificationClick = (notification) => {
  markNotificationAsRead(notification.id);
  // Handle notification action
};
```

### 3. Admin Features

```javascript
// In admin components
const { joinAdminRoom, emit } = useWebSocket();

useEffect(() => {
  joinAdminRoom(); // Join admin-only room
}, []);

const broadcastAnnouncement = (announcement) => {
  emit('new-announcement', announcement);
};
```

## Configuration

### Backend Configuration

In `src/server.js`, the WebSocket server is configured with:

```javascript
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
```

### Frontend Configuration

The WebSocket hook accepts configuration options:

```javascript
const websocket = useWebSocket('http://localhost:3000', {
  path: '/ws',
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000
});
```

## Error Handling

### Connection Errors

The hook provides error handling:

```javascript
const { connectionError } = useWebSocket();

if (connectionError) {
  console.error('WebSocket error:', connectionError);
}
```

### Reconnection

Automatic reconnection is handled by the hook:
- Attempts to reconnect on unexpected disconnections
- Configurable retry attempts and delays
- Manual reconnection methods available

## Security Considerations

1. **CORS Configuration**: Properly configured for your domain
2. **Room-based Access**: Users can only join appropriate rooms
3. **Admin Verification**: Admin rooms should verify user permissions
4. **Rate Limiting**: Consider implementing rate limiting for WebSocket events

## Troubleshooting

### Common Issues

1. **Connection Failed**: Check if backend server is running on port 3000
2. **CORS Errors**: Verify CORS configuration in server setup
3. **Client Library Not Found**: Ensure Socket.IO client is properly installed
4. **Events Not Received**: Check if client is connected and listening to correct events

### Debug Mode

Enable debug logging:

```javascript
// In browser console
localStorage.debug = 'socket.io-client:socket';
```

## Next Steps

1. Integrate WebSocket functionality into existing components
2. Add authentication to WebSocket connections
3. Implement user-specific notification preferences
4. Add real-time typing indicators for comments
5. Create admin dashboard with live system monitoring

## Support

For issues or questions about WebSocket implementation:
1. Check the server logs for connection errors
2. Use the test pages to verify functionality
3. Review the WebSocket service logs for debugging
4. Test with the React demo component
