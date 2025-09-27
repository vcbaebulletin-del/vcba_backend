-- Add calendar_id to comments table for calendar event comments
ALTER TABLE comments ADD COLUMN calendar_id int(11) NULL AFTER announcement_id;
ALTER TABLE comments ADD KEY idx_comments_calendar (calendar_id);
ALTER TABLE comments ADD CONSTRAINT fk_comments_calendar FOREIGN KEY (calendar_id) REFERENCES school_calendar (calendar_id) ON DELETE CASCADE;
