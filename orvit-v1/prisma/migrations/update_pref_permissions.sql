-- Migration: Rename view permissions to pref permissions for obfuscation
-- Run this migration after deploying the new code

-- Update SUPERADMIN, ADMIN, ADMIN_ENTERPRISE permissions
UPDATE "role_permissions" SET permission = 'pref.l2' WHERE permission = 'view.extended';
UPDATE "role_permissions" SET permission = 'pref.adv' WHERE permission = 'view.create_t2';
UPDATE "role_permissions" SET permission = 'pref.cfg' WHERE permission = 'view.config';
UPDATE "role_permissions" SET permission = 'pref.aud' WHERE permission = 'view.logs';

-- Also update user_permission_overrides if they exist
UPDATE "user_permission_overrides" SET permission = 'pref.l2' WHERE permission = 'view.extended';
UPDATE "user_permission_overrides" SET permission = 'pref.adv' WHERE permission = 'view.create_t2';
UPDATE "user_permission_overrides" SET permission = 'pref.cfg' WHERE permission = 'view.config';
UPDATE "user_permission_overrides" SET permission = 'pref.aud' WHERE permission = 'view.logs';

-- Verify the update
SELECT permission, COUNT(*) FROM "role_permissions" WHERE permission LIKE 'pref.%' GROUP BY permission;
