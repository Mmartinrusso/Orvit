-- =====================================================
-- AGREGAR PERMISOS DE ALMACÉN AL ROL ADMINISTRADOR
-- =====================================================

-- 1. Primero crear los permisos si no existen
INSERT INTO "Permission" (key, name, description, category, "isActive", "createdAt", "updatedAt")
SELECT * FROM (VALUES
  ('ingresar_almacen', 'Ingresar a Almacén', 'Acceso al módulo de almacén', 'almacen', true, NOW(), NOW()),
  ('almacen.view', 'Ver Almacén', 'Ver módulo almacén', 'almacen', true, NOW(), NOW()),
  ('almacen.view_dashboard', 'Ver Dashboard Almacén', 'Ver dashboard de almacén', 'almacen', true, NOW(), NOW()),
  ('almacen.view_inventory', 'Ver Inventario', 'Ver inventario unificado', 'almacen', true, NOW(), NOW()),
  ('almacen.view_costs', 'Ver Costos Almacén', 'Ver costos en almacén', 'almacen', true, NOW(), NOW()),
  -- Solicitudes
  ('almacen.request.view', 'Ver Solicitudes', 'Ver solicitudes de material', 'almacen', true, NOW(), NOW()),
  ('almacen.request.view_all', 'Ver Todas las Solicitudes', 'Ver todas las solicitudes (no solo las propias)', 'almacen', true, NOW(), NOW()),
  ('almacen.request.create', 'Crear Solicitudes', 'Crear solicitudes de material', 'almacen', true, NOW(), NOW()),
  ('almacen.request.edit', 'Editar Solicitudes', 'Editar solicitudes propias', 'almacen', true, NOW(), NOW()),
  ('almacen.request.approve', 'Aprobar Solicitudes', 'Aprobar solicitudes (genera reservas)', 'almacen', true, NOW(), NOW()),
  ('almacen.request.reject', 'Rechazar Solicitudes', 'Rechazar solicitudes', 'almacen', true, NOW(), NOW()),
  ('almacen.request.cancel', 'Cancelar Solicitudes', 'Cancelar solicitudes (libera reservas)', 'almacen', true, NOW(), NOW()),
  -- Despachos
  ('almacen.dispatch.view', 'Ver Despachos', 'Ver despachos', 'almacen', true, NOW(), NOW()),
  ('almacen.dispatch.create', 'Crear Despachos', 'Crear despachos', 'almacen', true, NOW(), NOW()),
  ('almacen.dispatch.process', 'Procesar Despachos', 'Procesar despachos (picking/preparar)', 'almacen', true, NOW(), NOW()),
  ('almacen.dispatch.confirm', 'Confirmar Despachos', 'Confirmar entrega de despacho', 'almacen', true, NOW(), NOW()),
  ('almacen.dispatch.receive', 'Recibir Despachos', 'Confirmar recepción de despacho', 'almacen', true, NOW(), NOW()),
  ('almacen.dispatch.cancel', 'Cancelar Despachos', 'Cancelar despachos', 'almacen', true, NOW(), NOW()),
  -- Devoluciones
  ('almacen.return.view', 'Ver Devoluciones', 'Ver devoluciones', 'almacen', true, NOW(), NOW()),
  ('almacen.return.create', 'Crear Devoluciones', 'Crear devoluciones de material', 'almacen', true, NOW(), NOW()),
  ('almacen.return.process', 'Procesar Devoluciones', 'Procesar devoluciones (aceptar/rechazar)', 'almacen', true, NOW(), NOW()),
  -- Reservas
  ('almacen.reservation.view', 'Ver Reservas', 'Ver reservas', 'almacen', true, NOW(), NOW()),
  ('almacen.reservation.create', 'Crear Reservas', 'Crear reservas manuales', 'almacen', true, NOW(), NOW()),
  ('almacen.reservation.release', 'Liberar Reservas', 'Liberar reservas', 'almacen', true, NOW(), NOW()),
  -- Operaciones de stock
  ('almacen.transfer', 'Transferir Stock', 'Transferir entre depósitos', 'almacen', true, NOW(), NOW()),
  ('almacen.adjust', 'Ajustar Inventario', 'Ajustar inventario', 'almacen', true, NOW(), NOW()),
  ('almacen.cycle_count', 'Conteo Cíclico', 'Conteo cíclico', 'almacen', true, NOW(), NOW()),
  -- Administración
  ('almacen.manage_warehouses', 'Administrar Depósitos', 'Administrar depósitos', 'almacen', true, NOW(), NOW()),
  ('almacen.manage_locations', 'Administrar Ubicaciones', 'Administrar ubicaciones físicas', 'almacen', true, NOW(), NOW()),
  ('almacen.manage_all', 'Administrar Todo Almacén', 'Superadmin almacén', 'almacen', true, NOW(), NOW())
) AS v(key, name, description, category, "isActive", "createdAt", "updatedAt")
WHERE NOT EXISTS (SELECT 1 FROM "Permission" WHERE "Permission".key = v.key);

-- 2. Asignar todos los permisos de almacén al rol "Administrador" de cada empresa
-- Esto asume que existe un rol llamado "Administrador" en cada empresa
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
  AND p.key LIKE 'almacen.%'
  AND NOT EXISTS (
    SELECT 1 FROM "RolePermission" rp
    WHERE rp."roleId" = r.id AND rp."permissionId" = p.id
  );

-- También agregar el permiso base 'ingresar_almacen'
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
  AND p.key = 'ingresar_almacen'
  AND NOT EXISTS (
    SELECT 1 FROM "RolePermission" rp
    WHERE rp."roleId" = r.id AND rp."permissionId" = p.id
  );

-- 3. Verificación - mostrar los permisos asignados
-- SELECT r.name as rol, p.key as permiso
-- FROM "RolePermission" rp
-- JOIN "Role" r ON r.id = rp."roleId"
-- JOIN "Permission" p ON p.id = rp."permissionId"
-- WHERE p.key LIKE 'almacen.%' OR p.key = 'ingresar_almacen'
-- ORDER BY r.name, p.key;
