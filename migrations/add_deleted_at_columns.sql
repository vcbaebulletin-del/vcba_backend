-- Migration: Add deleted_at columns for soft deletion
-- Date: 2025-08-22
-- Description: Adds deleted_at timestamp columns to welcome_page, welcome_cards, and login_carousel_images tables for proper soft deletion

-- Add deleted_at column to welcome_page table
ALTER TABLE `welcome_page` 
ADD COLUMN `deleted_at` TIMESTAMP NULL COMMENT 'Timestamp when the record was soft deleted' AFTER `updated_at`;

-- Add deleted_at column to welcome_cards table
ALTER TABLE `welcome_cards` 
ADD COLUMN `deleted_at` TIMESTAMP NULL COMMENT 'Timestamp when the record was soft deleted' AFTER `updated_at`;

-- Add deleted_at column to login_carousel_images table
ALTER TABLE `login_carousel_images` 
ADD COLUMN `deleted_at` TIMESTAMP NULL COMMENT 'Timestamp when the record was soft deleted' AFTER `updated_at`;

-- Add indexes for better performance on deleted_at queries
ALTER TABLE `welcome_page` ADD INDEX `idx_welcome_page_deleted_at` (`deleted_at`);
ALTER TABLE `welcome_cards` ADD INDEX `idx_welcome_cards_deleted_at` (`deleted_at`);
ALTER TABLE `login_carousel_images` ADD INDEX `idx_login_carousel_deleted_at` (`deleted_at`);
