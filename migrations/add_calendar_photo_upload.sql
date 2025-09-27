-- Migration: Add photo upload support to calendar events
-- Date: 2025-07-12
-- Description: Adds calendar_attachments table and modifies school_calendar table to support photo uploads

-- Add new columns to school_calendar table
ALTER TABLE `school_calendar` 
ADD COLUMN `is_published` tinyint(1) NOT NULL DEFAULT 0 COMMENT 'Whether the event is published and visible to students' AFTER `is_active`,
ADD COLUMN `deleted_at` timestamp NULL DEFAULT NULL COMMENT 'Timestamp when event was soft deleted' AFTER `updated_at`;

-- Add indexes for new columns
ALTER TABLE `school_calendar`
ADD KEY `idx_calendar_published` (`is_published`),
ADD KEY `idx_calendar_deleted` (`deleted_at`);

-- Create calendar_attachments table
CREATE TABLE `calendar_attachments` (
  `attachment_id` int(11) NOT NULL AUTO_INCREMENT,
  `calendar_id` int(11) NOT NULL,
  `file_name` varchar(255) NOT NULL,
  `file_path` varchar(500) NOT NULL,
  `file_type` enum('image','video','document') NOT NULL DEFAULT 'image',
  `file_size` int(11) NOT NULL,
  `mime_type` varchar(100) NOT NULL,
  `display_order` tinyint(3) UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Order for displaying multiple images (0-based)',
  `is_primary` tinyint(1) NOT NULL DEFAULT 0 COMMENT 'Primary image for event preview',
  `uploaded_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `deleted_at` timestamp NULL DEFAULT NULL COMMENT 'Soft delete timestamp',
  PRIMARY KEY (`attachment_id`),
  KEY `fk_calendar_attachment` (`calendar_id`),
  KEY `idx_calendar_attachments_type` (`file_type`),
  KEY `idx_calendar_attachments_order` (`calendar_id`,`display_order`),
  KEY `idx_calendar_attachments_primary` (`calendar_id`,`is_primary`),
  KEY `idx_calendar_attachments_deleted` (`deleted_at`),
  CONSTRAINT `fk_calendar_attachment` FOREIGN KEY (`calendar_id`) REFERENCES `school_calendar` (`calendar_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Update existing events to be published by default (optional - adjust as needed)
-- UPDATE `school_calendar` SET `is_published` = 1 WHERE `is_active` = 1;

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
  'CREATE', 
  'calendar_attachments', 
  'Migration: Added calendar photo upload support with calendar_attachments table and updated school_calendar schema', 
  NOW()
);
