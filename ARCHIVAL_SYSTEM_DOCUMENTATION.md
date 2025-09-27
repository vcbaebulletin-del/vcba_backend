# VCBA E-Bulletin Board - Automatic Content Archival System

## Overview

The Automatic Content Archival System automatically archives expired announcement posts and school calendar events based on their timeline/date. This system ensures that outdated content is moved to the archive while maintaining data integrity and providing admin access to archived content.

## Features

- ✅ **Automatic Archival**: Archives content when expiration dates are reached
- ✅ **Timezone-Safe**: Uses Asia/Manila timezone for all date comparisons
- ✅ **Soft Archival**: Content is marked as archived, not deleted
- ✅ **API Integration**: Archived content is excluded from public APIs by default
- ✅ **Admin Management**: Admins can view and restore archived content
- ✅ **Comprehensive Logging**: All archival actions are logged for auditability
- ✅ **Automated Scheduling**: Runs every 5 minutes via cron/Windows Task Scheduler

## Architecture

### Database Schema

#### Announcements Table
- `status` enum includes 'archived' option
- `visibility_end_at` TIMESTAMP for expiration date
- `archived_at` TIMESTAMP for archival timestamp
- `deleted_at` TIMESTAMP for soft deletion

#### School Calendar Table
- `is_active` TINYINT(1) for active/archived status (0 = archived)
- `end_date` DATE for event expiration
- `deleted_at` TIMESTAMP for soft deletion

### Archival Logic

#### Announcements
- **Criteria**: `visibility_end_at <= current Asia/Manila time AND status != 'archived' AND deleted_at IS NULL`
- **Action**: Set `status = 'archived'` and `archived_at = NOW()`

#### Calendar Events
- **Criteria**: `end_date <= current Asia/Manila date AND is_active = 1 AND deleted_at IS NULL`
- **Action**: Set `is_active = 0` and `updated_at = NOW()`

## File Structure

```
BACK-VCBA-E-BULLETIN-BOARD/
├── scripts/
│   ├── auto-archive-expired-content.js     # Main archival script
│   ├── inspect-database-schema.js          # Database inspection utility
│   ├── test-archival-system.js             # Comprehensive test suite
│   ├── setup-archival-cron.sh              # Linux/macOS cron setup
│   ├── setup-archival-task.bat             # Windows Task Scheduler setup
│   └── monitor-archival.sh                 # Monitoring script (created by setup)
├── src/
│   ├── controllers/ArchiveController.js     # Archive API endpoints
│   ├── models/AnnouncementModel.js         # Updated with archive filtering
│   ├── models/CalendarModel.js             # Updated with archive filtering
│   ├── routes/archiveRoutes.js             # Archive API routes
│   └── utils/timezone.js                   # Timezone utilities
└── ARCHIVAL_SYSTEM_DOCUMENTATION.md        # This file
```

## Installation & Setup

### 1. Database Schema Verification

Run the database inspection script to verify schema:

```bash
cd BACK-VCBA-E-BULLETIN-BOARD
node scripts/inspect-database-schema.js
```

### 2. Test the System

Run the comprehensive test suite:

```bash
node scripts/test-archival-system.js
```

### 3. Manual Archival Test

Test the archival script manually:

```bash
node scripts/auto-archive-expired-content.js
```

### 4. Setup Automated Scheduling

#### For Linux/macOS (Cron):
```bash
chmod +x scripts/setup-archival-cron.sh
./scripts/setup-archival-cron.sh
```

#### For Windows (Task Scheduler):
```batch
REM Run as Administrator
scripts\setup-archival-task.bat
```

## API Endpoints

### Archive Management (Admin Only)

- `GET /api/archive/stats` - Get archive statistics
- `GET /api/archive/announcements` - Get archived announcements
- `GET /api/archive/calendar-events` - Get archived calendar events
- `PUT /api/archive/announcements/:id/restore` - Restore archived announcement
- `PUT /api/archive/calendar-events/:id/restore` - Restore archived calendar event

### Content Filtering (Automatic)

- `GET /api/announcements` - Excludes archived announcements by default
- `GET /api/calendar` - Excludes inactive (archived) events by default

## Configuration

### Environment Variables

```env
DB_HOST=localhost
DB_USER=root
DB_PASS=your_password
DB_NAME=vcba_e_bulletin_board
```

### Timezone Configuration

The system is configured for **Asia/Manila** timezone:
- Database session timezone: `+08:00`
- Application timezone: `Asia/Manila`
- All date comparisons use Philippines time

## Monitoring & Maintenance

### Log Files

- **Linux/macOS**: `logs/archival-cron.log`
- **Windows**: `logs/archival-task.log`

### Monitoring Commands

#### Linux/macOS:
```bash
# Check cron job status
crontab -l | grep auto-archive

# Monitor logs
tail -f logs/archival-cron.log

# Run monitoring script
./scripts/monitor-archival.sh
```

#### Windows:
```batch
REM Check task status
schtasks /query /tn "VCBA-Content-Archival"

REM View logs
type logs\archival-task.log

REM Run monitoring script
scripts\monitor-archival.bat
```

### Manual Operations

#### Run Archival Manually:
```bash
node scripts/auto-archive-expired-content.js
```

#### Check Archive Statistics:
```bash
curl -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
     http://localhost:5000/api/archive/stats
```

## Troubleshooting

### Common Issues

1. **Database Connection Errors**
   - Verify database credentials in `.env`
   - Check database server is running
   - Ensure timezone is set correctly

2. **Permission Errors**
   - Ensure script has execute permissions (Linux/macOS)
   - Run Windows setup as Administrator
   - Check database user permissions

3. **Timezone Issues**
   - Verify database timezone: `SELECT @@session.time_zone;`
   - Check system timezone configuration
   - Ensure moment-timezone is installed

4. **Cron/Task Not Running**
   - Check cron service status: `systemctl status cron`
   - Verify Windows Task Scheduler service
   - Check log files for errors

### Debug Mode

Enable debug logging by setting environment variable:
```bash
export DEBUG=archival:*
node scripts/auto-archive-expired-content.js
```

## Security Considerations

- Archive operations require admin authentication
- Database user should have minimal required permissions
- Log files may contain sensitive information - secure appropriately
- Archived content is soft-deleted, not permanently removed

## Performance

- Archival process typically completes in < 1 second
- Uses database transactions for consistency
- Includes SELECT ... FOR UPDATE to prevent race conditions
- Optimized queries with proper indexing

## Backup & Recovery

### Before Deployment
1. Backup database: `mysqldump vcba_e_bulletin_board > backup.sql`
2. Test archival on staging environment
3. Verify restore functionality

### Recovery
1. Restore from backup if needed
2. Use admin interface to restore individual items
3. Check logs for archival history

## Support

For issues or questions:
1. Check logs first: `logs/archival-*.log`
2. Run test suite: `node scripts/test-archival-system.js`
3. Verify database schema: `node scripts/inspect-database-schema.js`
4. Review this documentation

## Version History

- **v1.0.0** (2025-09-09): Initial implementation
  - Automatic archival for announcements and calendar events
  - Asia/Manila timezone support
  - Comprehensive test suite
  - Cross-platform scheduling support
  - Admin archive management interface
