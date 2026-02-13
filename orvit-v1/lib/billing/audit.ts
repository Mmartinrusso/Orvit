/**
 * Servicio de Auditoría de Billing
 * Registra todas las acciones de billing para trazabilidad
 */

import { prisma } from '@/lib/prisma';

// Generar ID para audit log
function generateAuditId(): string {
  return `aud_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
}

export type BillingAction =
  // Suscripciones
  | 'SUBSCRIPTION_CREATED'
  | 'SUBSCRIPTION_ACTIVATED'
  | 'SUBSCRIPTION_CANCELED'
  | 'SUBSCRIPTION_PAUSED'
  | 'SUBSCRIPTION_REACTIVATED'
  | 'PLAN_CHANGE'
  | 'BILLING_CYCLE_CHANGE'
  // Facturas
  | 'INVOICE_CREATED'
  | 'INVOICE_STATUS_CHANGE'
  | 'INVOICE_VOIDED'
  // Pagos
  | 'PAYMENT_RECEIVED'
  | 'PAYMENT_FAILED'
  | 'PAYMENT_REFUNDED'
  // Tokens
  | 'TOKENS_PURCHASED'
  | 'TOKENS_CONSUMED'
  | 'TOKENS_ADJUSTED'
  | 'TOKENS_REFUNDED'
  | 'MONTHLY_ALLOWANCE_RESET'
  // Planes
  | 'PLAN_CREATED'
  | 'PLAN_UPDATED'
  | 'PLAN_DEACTIVATED'
  // Empresas
  | 'COMPANY_ASSIGNED_TO_SUBSCRIPTION'
  | 'COMPANY_REMOVED_FROM_SUBSCRIPTION';

export type BillingEntityType =
  | 'subscription'
  | 'invoice'
  | 'payment'
  | 'tokens'
  | 'plan'
  | 'company';

/**
 * Registra una acción de billing en el audit log
 */
export async function logBillingAction(
  userId: number | null,
  action: BillingAction,
  entityType: BillingEntityType,
  entityId: string,
  oldValue?: Record<string, any> | null,
  newValue?: Record<string, any> | null,
  ipAddress?: string
): Promise<void> {
  try {
    await prisma.billingAuditLog.create({
      data: {
        id: generateAuditId(),
        userId,
        action,
        entityType,
        entityId,
        oldValue: oldValue ? (oldValue as any) : null,
        newValue: newValue ? (newValue as any) : null,
        ipAddress,
      },
    });
  } catch (error) {
    // No fallar si el audit log falla, solo loguear el error
    console.error('Error al registrar audit log de billing:', error);
  }
}

/**
 * Obtiene el historial de auditoría para una entidad específica
 */
export async function getAuditHistory(
  entityType: BillingEntityType,
  entityId: string,
  options?: {
    limit?: number;
    offset?: number;
  }
) {
  const [logs, total] = await Promise.all([
    prisma.billingAuditLog.findMany({
      where: {
        entityType,
        entityId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: options?.limit || 50,
      skip: options?.offset || 0,
    }),
    prisma.billingAuditLog.count({
      where: { entityType, entityId },
    }),
  ]);

  return {
    logs,
    total,
    hasMore: (options?.offset || 0) + logs.length < total,
  };
}

/**
 * Obtiene el historial de auditoría de un usuario específico
 */
export async function getUserAuditHistory(
  userId: number,
  options?: {
    actions?: BillingAction[];
    from?: Date;
    to?: Date;
    limit?: number;
    offset?: number;
  }
) {
  const where: any = { userId };

  if (options?.actions && options.actions.length > 0) {
    where.action = { in: options.actions };
  }

  if (options?.from || options?.to) {
    where.createdAt = {};
    if (options.from) where.createdAt.gte = options.from;
    if (options.to) where.createdAt.lte = options.to;
  }

  const [logs, total] = await Promise.all([
    prisma.billingAuditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: options?.limit || 50,
      skip: options?.offset || 0,
    }),
    prisma.billingAuditLog.count({ where }),
  ]);

  return {
    logs,
    total,
    hasMore: (options?.offset || 0) + logs.length < total,
  };
}

/**
 * Busca en el historial de auditoría global con filtros
 */
export async function searchAuditLogs(options?: {
  action?: BillingAction;
  entityType?: BillingEntityType;
  userId?: number;
  from?: Date;
  to?: Date;
  limit?: number;
  offset?: number;
}) {
  const where: any = {};

  if (options?.action) {
    where.action = options.action;
  }

  if (options?.entityType) {
    where.entityType = options.entityType;
  }

  if (options?.userId) {
    where.userId = options.userId;
  }

  if (options?.from || options?.to) {
    where.createdAt = {};
    if (options.from) where.createdAt.gte = options.from;
    if (options.to) where.createdAt.lte = options.to;
  }

  const [logs, total] = await Promise.all([
    prisma.billingAuditLog.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: options?.limit || 50,
      skip: options?.offset || 0,
    }),
    prisma.billingAuditLog.count({ where }),
  ]);

  return {
    logs,
    total,
    hasMore: (options?.offset || 0) + logs.length < total,
  };
}

/**
 * Obtiene estadísticas de auditoría
 */
export async function getAuditStats(options?: {
  from?: Date;
  to?: Date;
}) {
  const where: any = {};

  if (options?.from || options?.to) {
    where.createdAt = {};
    if (options.from) where.createdAt.gte = options.from;
    if (options.to) where.createdAt.lte = options.to;
  }

  const [byAction, byEntity, byUser] = await Promise.all([
    prisma.billingAuditLog.groupBy({
      by: ['action'],
      where,
      _count: true,
    }),
    prisma.billingAuditLog.groupBy({
      by: ['entityType'],
      where,
      _count: true,
    }),
    prisma.billingAuditLog.groupBy({
      by: ['userId'],
      where: {
        ...where,
        userId: { not: null },
      },
      _count: true,
      orderBy: { _count: { userId: 'desc' } },
      take: 10,
    }),
  ]);

  return {
    byAction: byAction.reduce((acc, item) => {
      acc[item.action] = item._count;
      return acc;
    }, {} as Record<string, number>),
    byEntity: byEntity.reduce((acc, item) => {
      acc[item.entityType] = item._count;
      return acc;
    }, {} as Record<string, number>),
    topUsers: byUser.map(item => ({
      userId: item.userId,
      count: item._count,
    })),
  };
}

/**
 * Obtiene descripciones legibles para las acciones de auditoría
 */
export function getActionDescription(action: BillingAction): string {
  const descriptions: Record<BillingAction, string> = {
    SUBSCRIPTION_CREATED: 'Suscripción creada',
    SUBSCRIPTION_ACTIVATED: 'Suscripción activada',
    SUBSCRIPTION_CANCELED: 'Suscripción cancelada',
    SUBSCRIPTION_PAUSED: 'Suscripción pausada',
    SUBSCRIPTION_REACTIVATED: 'Suscripción reactivada',
    PLAN_CHANGE: 'Cambio de plan',
    BILLING_CYCLE_CHANGE: 'Cambio de ciclo de facturación',
    INVOICE_CREATED: 'Factura creada',
    INVOICE_STATUS_CHANGE: 'Cambio de estado de factura',
    INVOICE_VOIDED: 'Factura anulada',
    PAYMENT_RECEIVED: 'Pago recibido',
    PAYMENT_FAILED: 'Pago fallido',
    PAYMENT_REFUNDED: 'Pago reembolsado',
    TOKENS_PURCHASED: 'Tokens comprados',
    TOKENS_CONSUMED: 'Tokens consumidos',
    TOKENS_ADJUSTED: 'Tokens ajustados',
    TOKENS_REFUNDED: 'Tokens reembolsados',
    MONTHLY_ALLOWANCE_RESET: 'Allowance mensual reseteado',
    PLAN_CREATED: 'Plan creado',
    PLAN_UPDATED: 'Plan actualizado',
    PLAN_DEACTIVATED: 'Plan desactivado',
    COMPANY_ASSIGNED_TO_SUBSCRIPTION: 'Empresa asignada a suscripción',
    COMPANY_REMOVED_FROM_SUBSCRIPTION: 'Empresa removida de suscripción',
  };

  return descriptions[action] || action;
}

/**
 * Formatea el valor de auditoría para mostrar en UI
 */
export function formatAuditValue(value: any): string {
  if (value === null || value === undefined) {
    return '-';
  }

  if (typeof value === 'object') {
    return JSON.stringify(value, null, 2);
  }

  return String(value);
}

/**
 * Calcula la diferencia entre valores old y new para mostrar
 */
export function getAuditDiff(
  oldValue: Record<string, any> | null,
  newValue: Record<string, any> | null
): Array<{ field: string; from: any; to: any }> {
  const diff: Array<{ field: string; from: any; to: any }> = [];

  if (!oldValue && !newValue) {
    return diff;
  }

  const allKeys = new Set([
    ...Object.keys(oldValue || {}),
    ...Object.keys(newValue || {}),
  ]);

  for (const key of allKeys) {
    const oldVal = oldValue?.[key];
    const newVal = newValue?.[key];

    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      diff.push({
        field: key,
        from: oldVal,
        to: newVal,
      });
    }
  }

  return diff;
}
