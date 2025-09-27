-- Migration: Add visibility start and end date/time fields to announcements table
-- This migration adds visibility scheduling capability to announcements
-- Date: 2025-08-31

-- Add visibility_start_at column to announcements table
ALTER TABLE announcements
ADD COLUMN visibility_start_at TIMESTAMP NULL DEFAULT NULL
COMMENT 'Start date and time for announcement visibility (includes time for precision, e.g., 2025-09-04 07:00:00)'
AFTER scheduled_publish_at;

-- Add visibility_end_at column to announcements table
ALTER TABLE announcements
ADD COLUMN visibility_end_at TIMESTAMP NULL DEFAULT NULL
COMMENT 'End date and time for announcement visibility (includes time for precision, e.g., 2025-09-10 17:00:00)'
AFTER visibility_start_at;

-- Add indexes for efficient filtering by visibility dates
CREATE INDEX idx_announcements_visibility_start ON announcements(visibility_start_at);
CREATE INDEX idx_announcements_visibility_end ON announcements(visibility_end_at);

-- Add composite index for common visibility queries (status + visibility dates)
CREATE INDEX idx_announcements_status_visibility ON announcements(status, visibility_start_at, visibility_end_at);

-- Add composite index for published announcements with visibility filtering
CREATE INDEX idx_announcements_published_visibility ON announcements(status, published_at, visibility_start_at, visibility_end_at);

-- Update table comment to reflect new visibility functionality
ALTER TABLE announcements
COMMENT = 'Announcements with grade level targeting and visibility date/time scheduling for access control';

-- Verify the changes
DESCRIBE announcements;