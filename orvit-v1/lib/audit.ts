import { prisma } from '@/lib/prisma';
import { AuditAction } from '@prisma/client';
import { NextRequest } from 'next/server';

// ============================================================
// AUDIT LOG - Helper para operaciones sensibles
// Usa el modelo AuditLog existente en schema.prisma
// ============================================================

export interface AuditLogParams {
  userId: number;
  companyId: number;
  action: AuditAction;
  entityType: string; // 'Role', 'Permission', 'WorkOrder', 'CompanySettings', 'CostosConfig'
  entityId: number;
  oldValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  fieldChanged?: string;
  summary?: string;
  request?: NextRequest;
}

/**
 * Extrae IP y User-Agent de un NextRequest
 */
function extractRequestMeta(request?: NextRequest) {
  if (!request) return { ipAddress: null, userAgent: null };

  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const ipAddress = forwarded
    ? forwarded.split(',')[0].trim()
    : realIp || 'unknown';

  const userAgent = request.headers.get('user-agent') || null;

  return { ipAddress, userAgent };
}

/**
 * Registra un evento de auditoría de forma no-bloqueante.
 * No lanza errores para no afectar la operación principal.
 */
export function logAudit(params: AuditLogParams): void {
  const {
    userId,
    companyId,
    action,
    entityType,
    entityId,
    oldValue,
    newValue,
    fieldChanged,
    summary,
    request,
  } = params;

  const { ipAddress, userAgent } = extractRequestMeta(request);

  // Fire-and-forget: no bloqueamos la respuesta
  prisma.auditLog
    .create({
      data: {
        entityType,
        entityId,
        action,
        fieldChanged: fieldChanged || null,
        oldValue: oldValue ?? undefined,
        newValue: newValue ?? undefined,
        summary: summary || `${action} en ${entityType} #${entityId}`,
        performedById: userId,
        companyId,
        ipAddress,
        userAgent,
      },
    })
    .catch((error) => {
      console.error('[AuditLog] Error al registrar evento:', error);
    });
}

/**
 * Helper para auditar cambios de rol
 */
export function auditRoleChange(
  userId: number,
  companyId: number,
  roleId: number,
  oldData: Record<string, unknown> | null,
  newData: Record<string, unknown>,
  summary: string,
  request?: NextRequest
): void {
  logAudit({
    userId,
    companyId,
    action: AuditAction.ROLE_CHANGE,
    entityType: 'Role',
    entityId: roleId,
    oldValue: oldData,
    newValue: newData,
    summary,
    request,
  });
}

/**
 * Helper para auditar cambios de permisos
 */
export function auditPermissionChange(
  userId: number,
  companyId: number,
  targetUserId: number,
  oldData: Record<string, unknown> | null,
  newData: Record<string, unknown>,
  summary: string,
  request?: NextRequest
): void {
  logAudit({
    userId,
    companyId,
    action: AuditAction.PERMISSION_CHANGE,
    entityType: 'Permission',
    entityId: targetUserId,
    oldValue: oldData,
    newValue: newData,
    summary,
    request,
  });
}

/**
 * Helper para auditar eliminación de work orders
 */
export function auditWorkOrderDelete(
  userId: number,
  companyId: number,
  workOrderId: number,
  workOrderData: Record<string, unknown>,
  request?: NextRequest
): void {
  logAudit({
    userId,
    companyId,
    action: AuditAction.DELETE,
    entityType: 'WorkOrder',
    entityId: workOrderId,
    oldValue: workOrderData,
    summary: `WorkOrder #${workOrderId} eliminada (soft delete)`,
    request,
  });
}

/**
 * Helper para auditar acceso a datos sensibles (costos)
 */
export function auditSensitiveAccess(
  userId: number,
  companyId: number,
  resource: string,
  resourceId: number,
  summary: string,
  request?: NextRequest
): void {
  logAudit({
    userId,
    companyId,
    action: AuditAction.ACCESS,
    entityType: resource,
    entityId: resourceId,
    summary,
    request,
  });
}

/**
 * Helper para auditar cambios de configuración
 */
export function auditConfigChange(
  userId: number,
  companyId: number,
  configType: string,
  configId: number,
  oldData: Record<string, unknown> | null,
  newData: Record<string, unknown>,
  request?: NextRequest
): void {
  logAudit({
    userId,
    companyId,
    action: AuditAction.CONFIG_CHANGE,
    entityType: configType,
    entityId: configId,
    oldValue: oldData,
    newValue: newData,
    summary: `Configuración de ${configType} actualizada`,
    request,
  });
}
