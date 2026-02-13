-- Migration: Add ventas.dashboard.view permission and assign to all roles
-- This fixes the issue where users cannot access the sales dashboard page

-- 1. Create the missing permission
INSERT INTO "Permission" (name, description, category, "isActive", "createdAt", "updatedAt")
VALUES (
  'ventas.dashboard.view',
  'Ver dashboard de ventas con KPIs y estadísticas',
  'ventas',
  true,
  NOW(),
  NOW()
)
ON CONFLICT (name) DO NOTHING;

-- 2. Assign this permission to all existing roles
-- This ensures all users can access the sales dashboard
INSERT INTO "RolePermission" ("roleId", "permissionId", "isGranted", "createdAt", "updatedAt")
SELECT
  r.id as "roleId",
  p.id as "permissionId",
  true as "isGranted",
  NOW() as "createdAt",
  NOW() as "updatedAt"
FROM "Role" r
CROSS JOIN "Permission" p
WHERE p.name = 'ventas.dashboard.view'
  AND NOT EXISTS (
    SELECT 1 FROM "RolePermission" rp
    WHERE rp."roleId" = r.id AND rp."permissionId" = p.id
  );

-- Verify the migration
DO $$
DECLARE
  permission_count INTEGER;
  role_permission_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO permission_count FROM "Permission" WHERE name = 'ventas.dashboard.view';
  SELECT COUNT(*) INTO role_permission_count FROM "RolePermission" rp
  INNER JOIN "Permission" p ON p.id = rp."permissionId"
  WHERE p.name = 'ventas.dashboard.view';

  RAISE NOTICE 'Migration completed successfully:';
  RAISE NOTICE '  - Permission created: % (should be 1)', permission_count;
  RAISE NOTICE '  - Assigned to % roles', role_permission_count;
END $$;
