-- =====================================================
-- AGREGAR PERMISOS DE PRODUCTOS AL ROL ADMINISTRADOR
-- =====================================================
-- Este script asigna los permisos VIEW_PRODUCTS, CREATE_PRODUCT,
-- EDIT_PRODUCT y DELETE_PRODUCT al rol "Administrador" de todas las empresas

-- 1. Verificar que los permisos existen (deberían existir ya)
-- Si no existen, los creamos
INSERT INTO "Permission" (key, name, description, category, "isActive", "createdAt", "updatedAt")
SELECT * FROM (VALUES
  ('VIEW_PRODUCTS', 'Ver Productos', 'Ver listado de productos', 'ventas', true, NOW(), NOW()),
  ('CREATE_PRODUCT', 'Crear Productos', 'Crear nuevos productos', 'ventas', true, NOW(), NOW()),
  ('EDIT_PRODUCT', 'Editar Productos', 'Editar productos existentes', 'ventas', true, NOW(), NOW()),
  ('DELETE_PRODUCT', 'Eliminar Productos', 'Eliminar productos', 'ventas', true, NOW(), NOW())
) AS v(key, name, description, category, "isActive", "createdAt", "updatedAt")
WHERE NOT EXISTS (SELECT 1 FROM "Permission" WHERE "Permission".key = v.key);

-- 2. Asignar los permisos de productos al rol "Administrador" de cada empresa
INSERT INTO "RolePermission" ("roleId", "permissionId", "isGranted", "createdAt", "updatedAt")
SELECT
  r.id as "roleId",
  p.id as "permissionId",
  true as "isGranted",
  NOW() as "createdAt",
  NOW() as "updatedAt"
FROM "Role" r
CROSS JOIN "Permission" p
WHERE r.name = 'Administrador'
  AND p.key IN ('VIEW_PRODUCTS', 'CREATE_PRODUCT', 'EDIT_PRODUCT', 'DELETE_PRODUCT')
  AND NOT EXISTS (
    SELECT 1 FROM "RolePermission" rp
    WHERE rp."roleId" = r.id AND rp."permissionId" = p.id
  );

-- 3. Verificación - mostrar los roles y permisos asignados
SELECT
  c.name as empresa,
  r.name as rol,
  p.key as permiso,
  p.name as nombre_permiso
FROM "RolePermission" rp
JOIN "Role" r ON r.id = rp."roleId"
JOIN "Permission" p ON p.id = rp."permissionId"
JOIN "Company" c ON c.id = r."companyId"
WHERE p.key IN ('VIEW_PRODUCTS', 'CREATE_PRODUCT', 'EDIT_PRODUCT', 'DELETE_PRODUCT')
  AND rp."isGranted" = true
ORDER BY c.name, r.name, p.key;
