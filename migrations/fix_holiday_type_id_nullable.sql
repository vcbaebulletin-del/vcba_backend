-- Migration: Make holiday_type_id nullable in school_calendar table
-- Date: 2025-07-18
-- Description: Updates holiday_type_id column to allow NULL values since we're transitioning to category_id/subcategory_id

-- Check current structure
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'school_calendar' 
  AND COLUMN_NAME = 'holiday_type_id';

-- Make holiday_type_id nullable
ALTER TABLE `school_calendar` 
MODIFY COLUMN `holiday_type_id` int(11) NULL COMMENT 'Legacy holiday type ID - being phased out in favor of category_id';

-- Verify the change
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'school_calendar' 
  AND COLUMN_NAME = 'holiday_type_id';

-- Add audit log entry for this migration
INSERT INTO `audit_logs` (
  `user_type`, 
  `user_id`, 
  `action_type`, 
  `target_table`, 
  `description`, 
  `performed_at`
) VALUES (
  'system', 
  NULL, 
  'ALTER', 
  'school_calendar', 
  'Migration: Made holiday_type_id column nullable to support transition to category-based system', 
  NOW()
);

-- Optional: Set existing NULL category_id events to have a default category
-- UPDATE `school_calendar` 
-- SET `category_id` = 1 
-- WHERE `category_id` IS NULL AND `holiday_type_id` IS NOT NULL;

-- Note: After this migration, new calendar events can be created without holiday_type_id
-- The system will use category_id and subcategory_id instead
