-- Migration: Remove holiday_type_id column completely from school_calendar table
-- Date: 2025-07-18
-- Description: Removes the holiday_type_id column and its foreign key constraint since we're now using category_id/subcategory_id

-- Step 1: Check current foreign key constraints
SELECT 
    CONSTRAINT_NAME, 
    COLUMN_NAME, 
    REFERENCED_TABLE_NAME, 
    REFERENCED_COLUMN_NAME
FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'school_calendar' 
  AND CONSTRAINT_NAME LIKE '%holiday%';

-- Step 2: Drop the foreign key constraint first
ALTER TABLE `school_calendar` DROP FOREIGN KEY `fk_calendar_holiday_type`;

-- Step 3: Drop the holiday_type_id column
ALTER TABLE `school_calendar` DROP COLUMN `holiday_type_id`;

-- Step 4: Verify the column has been removed
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'school_calendar' 
  AND COLUMN_NAME = 'holiday_type_id';

-- Step 5: Verify our category columns exist
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'school_calendar' 
  AND COLUMN_NAME IN ('category_id', 'subcategory_id');

-- Step 6: Add audit log entry for this migration
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
  'Migration: Removed holiday_type_id column and foreign key constraint - now using category_id/subcategory_id system', 
  NOW()
);

-- Note: This migration completely removes the holiday_type_id column
-- Make sure you have backed up your data and migrated any existing holiday types to categories
-- before running this migration.
