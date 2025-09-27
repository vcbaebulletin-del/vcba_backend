-- Migration: Add grade_level field to admin_profiles table
-- This migration adds grade level assignment capability to admin users
-- Date: 2025-07-09

-- Add grade_level column to admin_profiles table
ALTER TABLE admin_profiles
ADD COLUMN grade_level INT NULL
COMMENT 'Grade level assigned to admin (11-12). NULL means system admin with access to all grades'
AFTER position;

-- Add constraint to ensure grade_level is between 11 and 12 if specified
ALTER TABLE admin_profiles
ADD CONSTRAINT chk_admin_grade_level
CHECK (grade_level IS NULL OR (grade_level >= 11 AND grade_level <= 12));

-- Add index for efficient filtering by grade level
CREATE INDEX idx_admin_profiles_grade_level ON admin_profiles(grade_level);

-- Update existing admin accounts to have NULL grade_level (system admins)
-- This preserves existing functionality while allowing new grade-specific admins
UPDATE admin_profiles 
SET grade_level = NULL 
WHERE grade_level IS NULL;

-- Add comment to the table
ALTER TABLE admin_profiles 
COMMENT = 'Admin profile information including grade level assignments for access control';
