-- Migration: Add comments and reactions support to calendar events
-- Date: 2025-07-18
-- Description: Adds allow_comments, is_alert columns and creates calendar_reactions table

-- Step 1: Check current database structure
SELECT 'Checking current school_calendar structure...' as status;
DESCRIBE school_calendar;

-- Step 2: Add allow_comments and is_alert columns to school_calendar table
SELECT 'Adding allow_comments and is_alert columns to school_calendar...' as status;

ALTER TABLE `school_calendar` 
ADD COLUMN `allow_comments` tinyint(1) NOT NULL DEFAULT 1 
COMMENT 'Whether comments are allowed on this event' 
AFTER `is_published`;

ALTER TABLE `school_calendar` 
ADD COLUMN `is_alert` tinyint(1) NOT NULL DEFAULT 0 
COMMENT 'Whether this event is marked as an alert/urgent' 
AFTER `allow_comments`;

-- Add indexes for the new columns
ALTER TABLE `school_calendar`
ADD KEY `idx_calendar_allow_comments` (`allow_comments`),
ADD KEY `idx_calendar_is_alert` (`is_alert`);

SELECT 'allow_comments and is_alert columns added successfully!' as status;

-- Step 3: Create reaction_types table if it doesn't exist
SELECT 'Creating reaction_types table if it does not exist...' as status;

CREATE TABLE IF NOT EXISTS `reaction_types` (
  `reaction_id` int(11) NOT NULL AUTO_INCREMENT,
  `reaction_name` varchar(50) NOT NULL,
  `reaction_emoji` varchar(10) NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`reaction_id`),
  UNIQUE KEY `unique_reaction_name` (`reaction_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default reaction types
INSERT IGNORE INTO `reaction_types` (`reaction_name`, `reaction_emoji`) VALUES
('like', '👍'),
('love', '❤️'),
('laugh', '😂'),
('wow', '😮'),
('sad', '😢'),
('angry', '😠');

SELECT 'reaction_types table created with default reactions!' as status;

-- Step 4: Create calendar_reactions table
SELECT 'Creating calendar_reactions table...' as status;

CREATE TABLE IF NOT EXISTS `calendar_reactions` (
  `reaction_log_id` int(11) NOT NULL AUTO_INCREMENT,
  `calendar_id` int(11) NOT NULL,
  `user_type` enum('admin','student') NOT NULL,
  `user_id` int(11) NOT NULL,
  `reaction_id` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`reaction_log_id`),
  UNIQUE KEY `unique_user_calendar_reaction` (`calendar_id`, `user_type`, `user_id`),
  KEY `fk_calendar_reaction_calendar` (`calendar_id`),
  KEY `fk_calendar_reaction_type` (`reaction_id`),
  KEY `idx_calendar_reactions_user` (`user_type`, `user_id`),
  CONSTRAINT `fk_calendar_reaction_calendar` FOREIGN KEY (`calendar_id`) REFERENCES `school_calendar` (`calendar_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_calendar_reaction_type` FOREIGN KEY (`reaction_id`) REFERENCES `reaction_types` (`reaction_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SELECT 'calendar_reactions table created successfully!' as status;

-- Step 5: Add calendar_id column to comments table
SELECT 'Adding calendar_id column to comments table...' as status;

-- Check if calendar_id column already exists
SET @column_exists = (
  SELECT COUNT(*) 
  FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'comments' 
    AND COLUMN_NAME = 'calendar_id'
);

-- Add calendar_id column if it doesn't exist
SET @sql = IF(@column_exists = 0, 
  'ALTER TABLE `comments` ADD COLUMN `calendar_id` int(11) NULL COMMENT ''Calendar event ID if comment is on a calendar event'' AFTER `announcement_id`',
  'SELECT ''calendar_id column already exists'' as message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add foreign key constraint if column was just added
SET @sql = IF(@column_exists = 0, 
  'ALTER TABLE `comments` ADD KEY `fk_comment_calendar` (`calendar_id`)',
  'SELECT ''calendar_id index already exists'' as message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(@column_exists = 0, 
  'ALTER TABLE `comments` ADD CONSTRAINT `fk_comment_calendar` FOREIGN KEY (`calendar_id`) REFERENCES `school_calendar` (`calendar_id`) ON DELETE CASCADE',
  'SELECT ''calendar_id foreign key already exists'' as message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SELECT 'calendar_id column added to comments table!' as status;

-- Step 6: Add notification types for calendar comments and reactions
SELECT 'Adding notification types for calendar events...' as status;

INSERT IGNORE INTO `notification_types` (
  `type_id`, 
  `type_name`, 
  `description`, 
  `is_sms_enabled`, 
  `is_push_enabled`
) VALUES 
(11, 'calendar_comment', 'Notification sent when someone comments on a calendar event', 0, 1),
(12, 'calendar_reaction', 'Notification sent when someone reacts to a calendar event', 0, 1);

SELECT 'Notification types added!' as status;

-- Step 7: Update existing calendar events with default values
SELECT 'Updating existing calendar events with default values...' as status;

UPDATE `school_calendar` 
SET 
  `allow_comments` = 1,  -- Enable comments by default
  `is_alert` = 0         -- Not alert by default
WHERE `allow_comments` IS NULL OR `is_alert` IS NULL;

SELECT 'Existing calendar events updated!' as status;

-- Step 8: Verify all changes
SELECT 'Verifying all changes...' as status;

-- Check updated school_calendar structure
SELECT 'Updated school_calendar columns:' as info;
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_COMMENT
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'school_calendar'
  AND COLUMN_NAME IN ('allow_comments', 'is_alert');

-- Check calendar_reactions table structure
SELECT 'calendar_reactions table structure:' as info;
DESCRIBE calendar_reactions;

-- Check comments table structure
SELECT 'comments table calendar_id column:' as info;
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_COMMENT
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'comments'
  AND COLUMN_NAME = 'calendar_id';

-- Check reaction types
SELECT 'Available reaction types:' as info;
SELECT * FROM reaction_types;

-- Check notification types
SELECT 'Calendar notification types:' as info;
SELECT * FROM notification_types WHERE type_name LIKE '%calendar%';

-- Sample data counts
SELECT 'Data summary:' as info;
SELECT 
  (SELECT COUNT(*) FROM school_calendar) as calendar_events,
  (SELECT COUNT(*) FROM reaction_types) as reaction_types,
  (SELECT COUNT(*) FROM calendar_reactions) as calendar_reactions,
  (SELECT COUNT(*) FROM comments WHERE calendar_id IS NOT NULL) as calendar_comments;

SELECT '🎉 Migration completed successfully!' as status;
SELECT 'Next steps:' as info;
SELECT '1. Update frontend to include allow_comments and is_alert checkboxes' as step;
SELECT '2. Add reaction buttons to calendar events' as step;
SELECT '3. Implement comment functionality for calendar events' as step;
