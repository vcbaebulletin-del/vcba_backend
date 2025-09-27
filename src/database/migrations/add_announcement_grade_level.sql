-- Migration: Add grade_level field to announcements table
-- This migration adds grade level targeting capability to announcements
-- Date: 2025-07-09

-- Add grade_level column to announcements table
ALTER TABLE announcements
ADD COLUMN grade_level INT NULL
COMMENT 'Target grade level for announcement (11-12). NULL means announcement is for all grades'
AFTER posted_by;

-- Add constraint to ensure grade_level is between 11 and 12 if specified
ALTER TABLE announcements
ADD CONSTRAINT chk_announcement_grade_level
CHECK (grade_level IS NULL OR (grade_level >= 11 AND grade_level <= 12));

-- Add index for efficient filtering by grade level
CREATE INDEX idx_announcements_grade_level ON announcements(grade_level);

-- Add composite index for common queries (status + grade_level)
CREATE INDEX idx_announcements_status_grade ON announcements(status, grade_level);

-- Update existing announcements to have NULL grade_level (visible to all grades)
-- This preserves existing functionality
UPDATE announcements 
SET grade_level = NULL 
WHERE grade_level IS NULL;

-- Add comment to the table
ALTER TABLE announcements 
COMMENT = 'Announcements with grade level targeting for access control';
