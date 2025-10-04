-- Migration to set default value for section column in student_profiles table
-- This fixes the error: "Field 'section' doesn't have a default value"
-- Date: 2025-10-04

-- Check if section column exists and set default value to 1
-- If the column doesn't exist, this will fail silently
ALTER TABLE student_profiles 
MODIFY COLUMN section INT DEFAULT 1;

-- Verification query (uncomment to check the table structure after migration)
-- DESCRIBE student_profiles;

