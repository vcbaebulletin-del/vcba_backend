-- Migration: Add ANNOUNCEMENT_COMMENT notification type
-- This migration adds a new notification type for comments on announcements
-- Date: 2025-07-13

-- Insert the new notification type if it doesn't exist
INSERT IGNORE INTO notification_types (type_id, type_name, description, is_sms_enabled, is_push_enabled)
VALUES (
  10,
  'announcement_comment',
  'Notification sent to announcement author when someone comments on their post',
  0,
  1
);

-- Update the notification model SQL queries to handle the new type
-- The context metadata generation in NotificationModel.js should include this new type
-- This will be handled in the application code, not in this migration

-- Add comment to document the new notification type
ALTER TABLE notification_types
COMMENT = 'Notification types including announcement comment notifications for grade-level filtering';
