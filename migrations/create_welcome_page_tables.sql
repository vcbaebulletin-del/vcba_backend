-- Migration: Create Welcome Page Management Tables
-- Date: 2025-08-21
-- Description: Creates tables for dynamic welcome page management including background images, cards, and login carousel

-- Create welcome_page table for background image management
CREATE TABLE `welcome_page` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `background_image` varchar(500) NOT NULL COMMENT 'Path to background image file',
  `is_active` tinyint(1) NOT NULL DEFAULT 1 COMMENT 'Whether this background is currently active',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `created_by` int(11) NOT NULL COMMENT 'Admin ID who uploaded the image',
  PRIMARY KEY (`id`),
  KEY `idx_welcome_page_active` (`is_active`),
  KEY `idx_welcome_page_created_by` (`created_by`),
  CONSTRAINT `fk_welcome_page_created_by` FOREIGN KEY (`created_by`) REFERENCES `admin_accounts` (`admin_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Welcome page background image management';

-- Create welcome_cards table for dynamic cards
CREATE TABLE `welcome_cards` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `title` varchar(255) NOT NULL COMMENT 'Card title',
  `description` text NOT NULL COMMENT 'Card description',
  `image` varchar(500) NOT NULL COMMENT 'Path to card image file',
  `order_index` int(11) NOT NULL DEFAULT 0 COMMENT 'Display order (0-based)',
  `is_active` tinyint(1) NOT NULL DEFAULT 1 COMMENT 'Whether this card is visible',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `created_by` int(11) NOT NULL COMMENT 'Admin ID who created the card',
  PRIMARY KEY (`id`),
  KEY `idx_welcome_cards_active` (`is_active`),
  KEY `idx_welcome_cards_order` (`order_index`),
  KEY `idx_welcome_cards_created_by` (`created_by`),
  CONSTRAINT `fk_welcome_cards_created_by` FOREIGN KEY (`created_by`) REFERENCES `admin_accounts` (`admin_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Welcome page dynamic cards';

-- Create login_carousel_images table for login page carousel
CREATE TABLE `login_carousel_images` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `image` varchar(500) NOT NULL COMMENT 'Path to carousel image file',
  `order_index` int(11) NOT NULL DEFAULT 0 COMMENT 'Display order (0-based)',
  `is_active` tinyint(1) NOT NULL DEFAULT 1 COMMENT 'Whether this image is visible in carousel',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `created_by` int(11) NOT NULL COMMENT 'Admin ID who uploaded the image',
  PRIMARY KEY (`id`),
  KEY `idx_login_carousel_active` (`is_active`),
  KEY `idx_login_carousel_order` (`order_index`),
  KEY `idx_login_carousel_created_by` (`created_by`),
  CONSTRAINT `fk_login_carousel_created_by` FOREIGN KEY (`created_by`) REFERENCES `admin_accounts` (`admin_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Login page carousel images';

-- Insert default welcome page background (fallback)
INSERT INTO `welcome_page` (`background_image`, `is_active`, `created_by`) VALUES
('/villamor-image/villamor-collge-BG-landscape.jpg', 1, 1);

-- Insert default welcome cards (fallback data)
INSERT INTO `welcome_cards` (`title`, `description`, `image`, `order_index`, `is_active`, `created_by`) VALUES
('Academic Excellence', 'Access to quality education and comprehensive learning resources', '/uploads/welcome/default-academic.jpg', 0, 1, 1),
('Vibrant Community', 'Join a diverse community of students, faculty, and staff', '/uploads/welcome/default-community.jpg', 1, 1, 1),
('Campus Events', 'Stay updated with the latest announcements and campus activities', '/uploads/welcome/default-events.jpg', 2, 1, 1),
('Achievement Recognition', 'Celebrate academic and extracurricular accomplishments', '/uploads/welcome/default-achievement.jpg', 3, 1, 1);

-- Insert default login carousel images (will be populated with actual images later)
INSERT INTO `login_carousel_images` (`image`, `order_index`, `is_active`, `created_by`) VALUES
('/uploads/carousel/vcba_adv_4.jpg', 0, 1, 1),
('/uploads/carousel/vcba_adv_5.jpg', 1, 1, 1),
('/uploads/carousel/vcba_adv_6.jpg', 2, 1, 1),
('/uploads/carousel/vcba_adv_7.jpg', 3, 1, 1),
('/uploads/carousel/vcba_adv_8.jpg', 4, 1, 1),
('/uploads/carousel/vcba_adv_9.jpg', 5, 1, 1),
('/uploads/carousel/vcba_adv_10.jpg', 6, 1, 1),
('/uploads/carousel/vcba_adv_11.jpg', 7, 1, 1),
('/uploads/carousel/vcba_adv_12.jpg', 8, 1, 1),
('/uploads/carousel/vcba_adv_13.jpg', 9, 1, 1);
