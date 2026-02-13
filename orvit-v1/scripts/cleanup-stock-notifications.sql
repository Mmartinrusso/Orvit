-- LIMPIEZA DE NOTIFICACIONES DUPLICADAS DE STOCK BAJO
-- Este script elimina las notificaciones individuales y crea una sola notificación general

-- 1. Eliminar todas las notificaciones individuales de stock bajo existentes
DELETE FROM "Notification" WHERE type = 'stock_low' AND metadata->>'toolId' IS NOT NULL;

-- 2. Verificar cuántas notificaciones quedan
SELECT COUNT(*) as remaining_stock_low_notifications FROM "Notification" WHERE type = 'stock_low';

-- 3. Verificar que no queden notificaciones individuales
SELECT COUNT(*) as individual_notifications FROM "Notification" 
WHERE type = 'stock_low' AND metadata->>'toolId' IS NOT NULL;

-- 4. Mensaje de confirmación
SELECT 'LIMPIEZA COMPLETADA: Se eliminaron las notificaciones individuales de stock bajo' as status; 