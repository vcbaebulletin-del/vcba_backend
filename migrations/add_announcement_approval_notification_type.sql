-- Migration: Add ANNOUNCEMENT_APPROVAL notification type
-- This migration adds a new notification type for announcement approvals
-- Date: 2025-08-22

-- Insert the new notification type if it doesn't exist
INSERT IGNORE INTO notification_types (type_id, type_name, description, is_sms_enabled, is_push_enabled)
VALUES (
  14,
  'announcement_approval',
  'Notification sent to announcement author when their post is approved by a super admin',
  0,
  1
);

-- Add comment to document the new notification type
SELECT 'Announcement approval notification type added!' as status;
