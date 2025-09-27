-- Migration: Add category support to calendar events
-- Date: 2025-07-18
-- Description: Adds category_id and subcategory_id columns to school_calendar table to replace holiday_type_id

-- Add new columns to school_calendar table
ALTER TABLE `school_calendar` 
ADD COLUMN `category_id` int(11) NULL COMMENT 'Category ID for event classification' AFTER `holiday_type_id`,
ADD COLUMN `subcategory_id` int(11) NULL COMMENT 'Subcategory ID for event classification' AFTER `category_id`;

-- Add foreign key constraints
ALTER TABLE `school_calendar`
ADD CONSTRAINT `fk_calendar_category` FOREIGN KEY (`category_id`) REFERENCES `categories` (`category_id`) ON DELETE SET NULL ON UPDATE CASCADE,
ADD CONSTRAINT `fk_calendar_subcategory` FOREIGN KEY (`subcategory_id`) REFERENCES `subcategories` (`subcategory_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Add indexes for new columns
ALTER TABLE `school_calendar`
ADD KEY `idx_calendar_category` (`category_id`),
ADD KEY `idx_calendar_subcategory` (`subcategory_id`);

-- Migrate existing data from holiday_type_id to category_id
-- This maps holiday types to appropriate categories
-- You may need to adjust these mappings based on your specific holiday types and categories

-- Example migration (adjust category IDs based on your actual data):
-- UPDATE `school_calendar` sc
-- JOIN `holiday_types` ht ON sc.holiday_type_id = ht.type_id
-- SET sc.category_id = CASE 
--   WHEN ht.type_name LIKE '%Holiday%' OR ht.type_name LIKE '%Break%' THEN 1  -- General category
--   WHEN ht.type_name LIKE '%Event%' OR ht.type_name LIKE '%Activity%' THEN 3  -- Events category
--   WHEN ht.type_name LIKE '%Emergency%' OR ht.type_name LIKE '%Alert%' THEN 4  -- Emergency category
--   WHEN ht.type_name LIKE '%Academic%' OR ht.type_name LIKE '%Exam%' THEN 2  -- Academic category
--   ELSE 1  -- Default to General category
-- END
-- WHERE sc.category_id IS NULL;

-- Note: The above UPDATE statement is commented out because it requires manual review
-- of your holiday types and categories to ensure proper mapping.
-- Please review your data and uncomment/modify as needed.

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
  'Migration: Added category_id and subcategory_id columns to school_calendar table for category-based event classification', 
  NOW()
);

-- Optional: After migration is complete and tested, you can drop the holiday_type_id column
-- ALTER TABLE `school_calendar` DROP FOREIGN KEY `fk_calendar_holiday_type`;
-- ALTER TABLE `school_calendar` DROP COLUMN `holiday_type_id`;
-- Note: This is commented out for safety. Only run after confirming the migration works correctly.
