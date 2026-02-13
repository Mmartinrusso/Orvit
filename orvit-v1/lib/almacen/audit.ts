import { prisma } from '@/lib/prisma';
import { AuditAction } from '@prisma/client';

// Tipos de entidad específicos de almacén
export type AlmacenEntityType =
  | 'SOLICITUD_MATERIAL'
  | 'DESPACHO'
  | 'DEVOLUCION'
  | 'RESERVA'
  | 'MOVIMIENTO_STOCK'
  | 'WAREHOUSE';

// Mapeo de acciones de almacén a AuditAction existente
const actionMapping: Record<string, AuditAction> = {
  // Solicitudes
  SOLICITUD_CREATED: AuditAction.CREATE,
  SOLICITUD_SUBMITTED: AuditAction.STATUS_CHANGE,
  SOLICITUD_APPROVED: AuditAction.APPROVE,
  SOLICITUD_REJECTED: AuditAction.REJECT,
  SOLICITUD_CANCELLED: AuditAction.STATUS_CHANGE,

  // Despachos
  DESPACHO_CREATED: AuditAction.CREATE,
  DESPACHO_PREPARED: AuditAction.STATUS_CHANGE,
  DESPACHO_READY: AuditAction.STATUS_CHANGE,
  DESPACHO_DISPATCHED: AuditAction.STATUS_CHANGE,
  DESPACHO_RECEIVED: AuditAction.CLOSE,
  DESPACHO_SIGNED: AuditAction.APPROVE,
  DESPACHO_CANCELLED: AuditAction.STATUS_CHANGE,

  // Devoluciones
  DEVOLUCION_CREATED: AuditAction.CREATE,
  DEVOLUCION_SUBMITTED: AuditAction.STATUS_CHANGE,
  DEVOLUCION_ACCEPTED: AuditAction.APPROVE,
  DEVOLUCION_REJECTED: AuditAction.REJECT,

  // Reservas
  RESERVA_CREATED: AuditAction.RESERVE_STOCK,
  RESERVA_CONSUMED: AuditAction.CONSUME_STOCK,
  RESERVA_RELEASED: AuditAction.STATUS_CHANGE,
  RESERVA_EXPIRED: AuditAction.STATUS_CHANGE,

  // Stock
  STOCK_ADJUSTED: AuditAction.UPDATE,
  STOCK_TRANSFERRED: AuditAction.UPDATE,
};

interface LogAlmacenEventParams {
  entityType: AlmacenEntityType;
  entityId: number;
  action: string;
  fromStatus?: string;
  toStatus?: string;
  userId: number;
  companyId: number;
  metadata?: Record<string, any>;
  summary?: string;
}

/**
 * Registra un evento de auditoría para operaciones de almacén
 */
export async function logAlmacenEvent(params: LogAlmacenEventParams) {
  const {
    entityType,
    entityId,
    action,
    fromStatus,
    toStatus,
    userId,
    companyId,
    metadata,
    summary,
  } = params;

  // Mapear acción específica a AuditAction genérico
  const mappedAction = actionMapping[action] || AuditAction.UPDATE;

  // Construir summary si no se proporciona
  const eventSummary = summary || buildSummary(entityType, action, fromStatus, toStatus);

  try {
    return await prisma.auditLog.create({
      data: {
        entityType,
        entityId,
        action: mappedAction,
        fieldChanged: fromStatus && toStatus ? 'estado' : undefined,
        oldValue: fromStatus ? { estado: fromStatus } : undefined,
        newValue: toStatus ? { estado: toStatus, ...metadata } : metadata,
        summary: eventSummary,
        performedById: userId,
        companyId,
      },
    });
  } catch (error) {
    console.error('Error al registrar evento de auditoría:', error);
    // No lanzamos el error para no afectar la operación principal
    return null;
  }
}

/**
 * Construye un resumen legible del evento
 */
function buildSummary(
  entityType: AlmacenEntityType,
  action: string,
  fromStatus?: string,
  toStatus?: string
): string {
  const entityNames: Record<AlmacenEntityType, string> = {
    SOLICITUD_MATERIAL: 'Solicitud de material',
    DESPACHO: 'Despacho',
    DEVOLUCION: 'Devolución',
    RESERVA: 'Reserva de stock',
    MOVIMIENTO_STOCK: 'Movimiento de stock',
    WAREHOUSE: 'Depósito',
  };

  const entityName = entityNames[entityType] || entityType;

  if (fromStatus && toStatus) {
    return `${entityName}: ${fromStatus} → ${toStatus}`;
  }

  const actionLabels: Record<string, string> = {
    SOLICITUD_CREATED: 'creada',
    SOLICITUD_SUBMITTED: 'enviada para aprobación',
    SOLICITUD_APPROVED: 'aprobada',
    SOLICITUD_REJECTED: 'rechazada',
    SOLICITUD_CANCELLED: 'cancelada',
    DESPACHO_CREATED: 'creado',
    DESPACHO_PREPARED: 'en preparación',
    DESPACHO_READY: 'listo para despacho',
    DESPACHO_DISPATCHED: 'despachado',
    DESPACHO_RECEIVED: 'recibido',
    DESPACHO_SIGNED: 'firmado',
    DESPACHO_CANCELLED: 'cancelado',
    DEVOLUCION_CREATED: 'creada',
    DEVOLUCION_SUBMITTED: 'enviada para revisión',
    DEVOLUCION_ACCEPTED: 'aceptada',
    DEVOLUCION_REJECTED: 'rechazada',
    RESERVA_CREATED: 'creada',
    RESERVA_CONSUMED: 'consumida',
    RESERVA_RELEASED: 'liberada',
    RESERVA_EXPIRED: 'expirada',
    STOCK_ADJUSTED: 'ajustado',
    STOCK_TRANSFERRED: 'transferido',
  };

  const actionLabel = actionLabels[action] || action;
  return `${entityName} ${actionLabel}`;
}

/**
 * Registra evento de firma digital en despacho o devolución
 */
export async function logSignatureEvent(
  entityType: 'DESPACHO' | 'DEVOLUCION',
  entityId: number,
  signatureHash: string,
  signatureUrl: string,
  signedBy: number,
  companyId: number,
  signatureType: 'despachador' | 'receptor' = 'receptor'
) {
  return logAlmacenEvent({
    entityType,
    entityId,
    action: `${entityType}_SIGNED`,
    userId: signedBy,
    companyId,
    metadata: {
      signatureHash,
      signatureUrl,
      signatureType,
      signedAt: new Date().toISOString(),
    },
    summary: `${entityType === 'DESPACHO' ? 'Despacho' : 'Devolución'} firmado por ${signatureType}`,
  });
}

/**
 * Registra evento de cambio de estado en solicitud
 */
export async function logSolicitudStatusChange(
  solicitudId: number,
  fromStatus: string,
  toStatus: string,
  userId: number,
  companyId: number,
  motivo?: string
) {
  const actionMap: Record<string, string> = {
    PENDIENTE_APROBACION: 'SOLICITUD_SUBMITTED',
    APROBADA: 'SOLICITUD_APPROVED',
    RECHAZADA: 'SOLICITUD_REJECTED',
    CANCELADA: 'SOLICITUD_CANCELLED',
  };

  return logAlmacenEvent({
    entityType: 'SOLICITUD_MATERIAL',
    entityId: solicitudId,
    action: actionMap[toStatus] || 'STATUS_CHANGE',
    fromStatus,
    toStatus,
    userId,
    companyId,
    metadata: motivo ? { motivo } : undefined,
  });
}

/**
 * Registra evento de cambio de estado en despacho
 */
export async function logDespachoStatusChange(
  despachoId: number,
  fromStatus: string,
  toStatus: string,
  userId: number,
  companyId: number,
  motivo?: string
) {
  const actionMap: Record<string, string> = {
    EN_PREPARACION: 'DESPACHO_PREPARED',
    LISTO_DESPACHO: 'DESPACHO_READY',
    DESPACHADO: 'DESPACHO_DISPATCHED',
    RECIBIDO: 'DESPACHO_RECEIVED',
    CANCELADO: 'DESPACHO_CANCELLED',
  };

  return logAlmacenEvent({
    entityType: 'DESPACHO',
    entityId: despachoId,
    action: actionMap[toStatus] || 'STATUS_CHANGE',
    fromStatus,
    toStatus,
    userId,
    companyId,
    metadata: motivo ? { motivo } : undefined,
  });
}

/**
 * Registra evento de reserva de stock
 */
export async function logReservationEvent(
  reservaId: number,
  action: 'CREATED' | 'CONSUMED' | 'RELEASED' | 'EXPIRED',
  cantidad: number,
  supplierItemId: number,
  warehouseId: number,
  userId: number,
  companyId: number,
  motivo?: string
) {
  return logAlmacenEvent({
    entityType: 'RESERVA',
    entityId: reservaId,
    action: `RESERVA_${action}`,
    userId,
    companyId,
    metadata: {
      cantidad,
      supplierItemId,
      warehouseId,
      motivo,
    },
  });
}

/**
 * Obtener historial de eventos para una entidad
 */
export async function getEntityAuditHistory(
  entityType: AlmacenEntityType,
  entityId: number,
  companyId: number,
  limit = 50
) {
  return prisma.auditLog.findMany({
    where: {
      entityType,
      entityId,
      companyId,
    },
    include: {
      performedBy: {
        select: { id: true, name: true, email: true },
      },
    },
    orderBy: { performedAt: 'desc' },
    take: limit,
  });
}

/**
 * Obtener eventos recientes de almacén
 */
export async function getRecentAlmacenEvents(
  companyId: number,
  options?: {
    entityType?: AlmacenEntityType;
    limit?: number;
    since?: Date;
  }
) {
  const almacenEntityTypes: AlmacenEntityType[] = [
    'SOLICITUD_MATERIAL',
    'DESPACHO',
    'DEVOLUCION',
    'RESERVA',
    'MOVIMIENTO_STOCK',
    'WAREHOUSE',
  ];

  return prisma.auditLog.findMany({
    where: {
      companyId,
      entityType: options?.entityType
        ? options.entityType
        : { in: almacenEntityTypes },
      performedAt: options?.since
        ? { gte: options.since }
        : undefined,
    },
    include: {
      performedBy: {
        select: { id: true, name: true },
      },
    },
    orderBy: { performedAt: 'desc' },
    take: options?.limit || 50,
  });
}
