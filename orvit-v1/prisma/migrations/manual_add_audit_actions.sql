-- Agregar nuevos valores al enum AuditAction para el sistema de audit log
-- Ejecutar manualmente en la base de datos

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'ROLE_CHANGE';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PERMISSION_CHANGE';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'ACCESS';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CONFIG_CHANGE';
