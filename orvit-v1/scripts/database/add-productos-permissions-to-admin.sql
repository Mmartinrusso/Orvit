-- =====================================================
-- AGREGAR PERMISOS DE PRODUCTOS AL ROL ADMINISTRADOR
-- =====================================================
-- Este script asigna los permisos ventas.productos.view, ventas.productos.create,
-- ventas.productos.edit y ventas.productos.delete al rol "Administrador" de todas las empresas

-- 1. Verificar que los permisos existen (deberían existir ya)
-- Si no existen, los creamos
INSERT INTO "Permission" (key, name, description, category, "isActive", "createdAt", "updatedAt")
SELECT * FROM (VALUES
  ('ventas.productos.view', 'Ver Productos', 'Ver listado de productos', 'ventas', true, NOW(), NOW()),
  ('ventas.productos.create', 'Crear Productos', 'Crear nuevos productos', 'ventas', true, NOW(), NOW()),
  ('ventas.productos.edit', 'Editar Productos', 'Editar productos existentes', 'ventas', true, NOW(), NOW()),
  ('ventas.productos.delete', 'Eliminar Productos', 'Eliminar productos', 'ventas', true, NOW(), NOW())
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
  AND p.key IN ('ventas.productos.view', 'ventas.productos.create', 'ventas.productos.edit', 'ventas.productos.delete')
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
WHERE p.key IN ('ventas.productos.view', 'ventas.productos.create', 'ventas.productos.edit', 'ventas.productos.delete')
  AND rp."isGranted" = true
ORDER BY c.name, r.name, p.key;
