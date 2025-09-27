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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
