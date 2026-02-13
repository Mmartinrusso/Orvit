-- LIMPIEZA DE EMERGENCIA - TODAS LAS NOTIFICACIONES DE STOCK BAJO
-- Este script elimina TODAS las notificaciones de stock bajo existentes

-- 1. Eliminar TODAS las notificaciones de stock bajo (individuales y generales)
DELETE FROM "Notification" WHERE type = 'stock_low';
DELETE FROM "Notification" WHERE type = 'stock_out';

-- 2. Verificar que se eliminaron completamente
SELECT COUNT(*) as remaining_stock_low_notifications FROM "Notification" WHERE type = 'stock_low';
SELECT COUNT(*) as remaining_stock_out_notifications FROM "Notification" WHERE type = 'stock_out';

-- 3. Verificar que no queden notificaciones relacionadas con stock
SELECT COUNT(*) as any_stock_notifications FROM "Notification" 
WHERE type LIKE '%stock%' OR message LIKE '%Stock%' OR title LIKE '%Stock%';

-- 4. Mensaje de confirmación
SELECT 'LIMPIEZA DE EMERGENCIA COMPLETADA: Todas las notificaciones de stock eliminadas' as status; 