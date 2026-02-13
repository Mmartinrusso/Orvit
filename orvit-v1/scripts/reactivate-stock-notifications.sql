-- REACTIVACIÓN DEL SISTEMA DE NOTIFICACIONES DE STOCK BAJO
-- Este script limpia las notificaciones existentes y reactiva el sistema

-- 1. Limpiar todas las notificaciones de stock bajo existentes
DELETE FROM "Notification" WHERE type = 'stock_low';
DELETE FROM "Notification" WHERE type = 'stock_out';

-- 2. Verificar que se eliminaron
SELECT COUNT(*) as stock_low_count FROM "Notification" WHERE type = 'stock_low';
SELECT COUNT(*) as stock_out_count FROM "Notification" WHERE type = 'stock_out';

-- 3. Eliminar el trigger bloqueador si existe
DROP TRIGGER IF EXISTS block_stock_notifications_trigger ON "Notification";
DROP FUNCTION IF EXISTS block_stock_notifications();

-- 4. Verificar que el trigger se eliminó
SELECT 
    trigger_name, 
    event_manipulation, 
    event_object_table 
FROM information_schema.triggers 
WHERE trigger_name = 'block_stock_notifications_trigger';

-- 5. Mensaje de confirmación
SELECT 'SISTEMA REACTIVADO: Las notificaciones de stock bajo están ahora ACTIVAS con protecciones anti-bucle' as status; 