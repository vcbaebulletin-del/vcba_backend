-- Migration to remove section column from student_profiles table
-- Run this script to remove the section field from the database

-- First, let's check if the column exists before dropping it
-- This prevents errors if the migration has already been run

-- Remove the section column from student_profiles table
ALTER TABLE student_profiles DROP COLUMN IF EXISTS section;

-- Optional: Add a comment to track this migration
-- You can add this to a migrations tracking table if you have one
-- INSERT INTO migrations (name, executed_at) VALUES ('remove_section_column', NOW());

-- Verification query (uncomment to check the table structure after migration)
-- DESCRIBE student_profiles;
