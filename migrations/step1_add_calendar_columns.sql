-- Step 1: Add allow_comments and is_alert columns to school_calendar
-- Run this first and check for any errors

-- Check current structure
DESCRIBE school_calendar;

-- Add allow_comments column
ALTER TABLE `school_calendar` 
ADD COLUMN `allow_comments` tinyint(1) NOT NULL DEFAULT 1 
COMMENT 'Whether comments are allowed on this event' 
AFTER `is_published`;

-- Add is_alert column  
ALTER TABLE `school_calendar` 
ADD COLUMN `is_alert` tinyint(1) NOT NULL DEFAULT 0 
COMMENT 'Whether this event is marked as an alert/urgent' 
AFTER `allow_comments`;

-- Add indexes
ALTER TABLE `school_calendar`
ADD KEY `idx_calendar_allow_comments` (`allow_comments`),
ADD KEY `idx_calendar_is_alert` (`is_alert`);

-- Verify the changes
SELECT 'Columns added successfully!' as status;
DESCRIBE school_calendar;
