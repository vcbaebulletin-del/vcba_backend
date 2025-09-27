-- Migration: Add Position-Based Permissions System
-- This migration enhances the admin_profiles table to support position-based access control
-- Date: 2025-08-05
-- Author: System Migration

-- Step 1: Add constraint to position column to enforce predefined values
-- This ensures only 'super_admin' and 'professor' are allowed as position values

ALTER TABLE admin_profiles
ADD CONSTRAINT chk_admin_position
CHECK (position IS NULL OR position IN ('super_admin', 'professor'));

-- Step 2: Add index for efficient position-based queries
CREATE INDEX idx_admin_profiles_position ON admin_profiles(position);

-- Step 3: Update existing admin accounts to have proper position values
-- Current data shows: "MIT lll", "MIT ll", and null values
-- We'll set the first admin (likely system admin) as super_admin
-- and others as professor, but this should be reviewed and adjusted

-- Update the first admin account to super_admin (typically the system administrator)
UPDATE admin_profiles 
SET position = 'super_admin' 
WHERE admin_id = (
    SELECT admin_id 
    FROM admin_accounts 
    ORDER BY admin_id ASC 
    LIMIT 1
);

-- Update remaining admin accounts to professor (default role for content creators)
UPDATE admin_profiles 
SET position = 'professor' 
WHERE position IS NULL OR position NOT IN ('super_admin', 'professor');

-- Step 4: Create audit log entry for this migration
INSERT INTO audit_logs (
    user_type, 
    user_id, 
    action_type, 
    target_table, 
    description, 
    performed_at
) VALUES (
    'system', 
    NULL, 
    'ALTER', 
    'admin_profiles', 
    'Migration: Added position-based permissions system with super_admin and professor roles', 
    NOW()
) ON DUPLICATE KEY UPDATE description = description;

-- Step 5: Verify the migration results
SELECT 'Position-based permissions migration completed!' as status;

-- Show updated admin positions
SELECT 
    a.email,
    p.first_name,
    p.last_name,
    p.position,
    p.grade_level,
    'Updated position for access control' as note
FROM admin_accounts a
JOIN admin_profiles p ON a.admin_id = p.admin_id
ORDER BY a.admin_id;

-- Step 6: Add table comment to document the new constraint
ALTER TABLE admin_profiles 
COMMENT = 'Admin profile information with position-based access control (super_admin, professor)';

-- Verification queries to ensure data integrity
SELECT 
    'Position constraint check' as check_type,
    COUNT(*) as total_admins,
    SUM(CASE WHEN position = 'super_admin' THEN 1 ELSE 0 END) as super_admins,
    SUM(CASE WHEN position = 'professor' THEN 1 ELSE 0 END) as professors,
    SUM(CASE WHEN position IS NULL THEN 1 ELSE 0 END) as null_positions
FROM admin_profiles;
