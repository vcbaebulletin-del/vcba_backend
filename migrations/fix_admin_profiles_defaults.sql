-- Migration to fix admin_profiles table constraints
-- This fixes potential issues with admin creation on Railway
-- Date: 2025-10-05

-- Make department field nullable with a default value
ALTER TABLE admin_profiles 
MODIFY COLUMN department VARCHAR(100) DEFAULT NULL;

-- Make bio field nullable (if not already)
ALTER TABLE admin_profiles 
MODIFY COLUMN bio TEXT DEFAULT NULL;

-- Make profile_picture field nullable (if not already)
ALTER TABLE admin_profiles 
MODIFY COLUMN profile_picture VARCHAR(255) DEFAULT NULL;

-- Verification query (uncomment to check the table structure after migration)
-- DESCRIBE admin_profiles;

