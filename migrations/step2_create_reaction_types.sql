-- Step 2: Create reaction_types table
-- Run this after step 1 completes successfully

-- Create reaction_types table if it doesn't exist
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

-- Verify the table
SELECT 'reaction_types table created!' as status;
SELECT * FROM reaction_types;
