-- Step 4: Add calendar_id to comments table
-- Run this after step 3 completes successfully

-- Add calendar_id column to comments table
ALTER TABLE `comments` 
ADD COLUMN `calendar_id` int(11) NULL 
COMMENT 'Calendar event ID if comment is on a calendar event' 
AFTER `announcement_id`;

-- Add index
ALTER TABLE `comments`
ADD KEY `fk_comment_calendar` (`calendar_id`);

-- Add foreign key constraint
ALTER TABLE `comments`
ADD CONSTRAINT `fk_comment_calendar` 
FOREIGN KEY (`calendar_id`) REFERENCES `school_calendar` (`calendar_id`) ON DELETE CASCADE;

-- Verify the changes
SELECT 'calendar_id column added to comments!' as status;
DESCRIBE comments;
