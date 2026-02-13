import { prisma } from '@/lib/prisma';
import type { PrismaClient } from '@prisma/client';
import type { SalesAuditableEntity, SalesAuditAction, SalesAuditMetadata } from './audit-config';

export interface LogSalesAuditParams {
  entidad: SalesAuditableEntity;
  entidadId: number;
  accion: SalesAuditAction;
  companyId: number;
  userId: number;
  metadata?: SalesAuditMetadata;
  tx?: PrismaClient | typeof prisma;
}

/**
 * Registra un evento de auditoría en SalesAuditLog
 * Soporta transacciones pasando el parámetro `tx`
 */
export async function logSalesAudit(params: LogSalesAuditParams): Promise<void> {
  const db = params.tx || prisma;

  try {
    await db.salesAuditLog.create({
      data: {
        entidad: params.entidad,
        entidadId: params.entidadId,
        accion: params.accion,
        datosAnteriores: params.metadata?.estadoAnterior
          ? { estado: params.metadata.estadoAnterior }
          : null,
        datosNuevos: params.metadata
          ? {
              estado: params.metadata.estadoNuevo,
              reason: params.metadata.reason,
              amount: params.metadata.amount,
              relatedIds: params.metadata.relatedIds,
              clientId: params.metadata.clientId,
              clientName: params.metadata.clientName,
              documentNumber: params.metadata.documentNumber,
              sourceEntity: params.metadata.sourceEntity,
              sourceId: params.metadata.sourceId,
              sourceNumber: params.metadata.sourceNumber,
              paymentMethod: params.metadata.paymentMethod,
              version: params.metadata.version,
              acceptedBy: params.metadata.acceptedBy,
              ipAddress: params.metadata.ipAddress,
            }
          : null,
        companyId: params.companyId,
        userId: params.userId,
      },
    });
  } catch (error) {
    // Log error pero no fallar la operación principal
    console.error('[SalesAuditHelper] Error registrando auditoría:', error);
  }
}

/**
 * Registra un cambio de estado
 */
export async function logSalesStatusChange(params: {
  entidad: SalesAuditableEntity;
  entidadId: number;
  estadoAnterior: string;
  estadoNuevo: string;
  companyId: number;
  userId: number;
  reason?: string;
  relatedIds?: SalesAuditMetadata['relatedIds'];
  tx?: PrismaClient | typeof prisma;
}): Promise<void> {
  await logSalesAudit({
    entidad: params.entidad,
    entidadId: params.entidadId,
    accion: 'STATUS_CHANGE',
    companyId: params.companyId,
    userId: params.userId,
    metadata: {
      estadoAnterior: params.estadoAnterior,
      estadoNuevo: params.estadoNuevo,
      reason: params.reason,
      relatedIds: params.relatedIds,
    },
    tx: params.tx,
  });
}

/**
 * Registra una aprobación
 */
export async function logSalesApproval(params: {
  entidad: SalesAuditableEntity;
  entidadId: number;
  estadoAnterior: string;
  companyId: number;
  userId: number;
  tx?: PrismaClient | typeof prisma;
}): Promise<void> {
  await logSalesAudit({
    entidad: params.entidad,
    entidadId: params.entidadId,
    accion: 'APPROVE',
    companyId: params.companyId,
    userId: params.userId,
    metadata: {
      estadoAnterior: params.estadoAnterior,
      estadoNuevo: 'APROBADA',
    },
    tx: params.tx,
  });
}

/**
 * Registra un rechazo
 */
export async function logSalesRejection(params: {
  entidad: SalesAuditableEntity;
  entidadId: number;
  estadoAnterior: string;
  reason: string;
  companyId: number;
  userId: number;
  tx?: PrismaClient | typeof prisma;
}): Promise<void> {
  await logSalesAudit({
    entidad: params.entidad,
    entidadId: params.entidadId,
    accion: 'REJECT',
    companyId: params.companyId,
    userId: params.userId,
    metadata: {
      estadoAnterior: params.estadoAnterior,
      estadoNuevo: 'RECHAZADA',
      reason: params.reason,
    },
    tx: params.tx,
  });
}

/**
 * Registra una creación
 */
export async function logSalesCreation(params: {
  entidad: SalesAuditableEntity;
  entidadId: number;
  companyId: number;
  userId: number;
  estadoInicial?: string;
  amount?: number;
  clientId?: string | number; // string para cuid, number para legacy
  clientName?: string;
  documentNumber?: string;
  relatedIds?: SalesAuditMetadata['relatedIds'];
  tx?: PrismaClient | typeof prisma;
}): Promise<void> {
  await logSalesAudit({
    entidad: params.entidad,
    entidadId: params.entidadId,
    accion: 'CREATE',
    companyId: params.companyId,
    userId: params.userId,
    metadata: {
      estadoNuevo: params.estadoInicial,
      amount: params.amount,
      clientId: params.clientId,
      clientName: params.clientName,
      documentNumber: params.documentNumber,
      relatedIds: params.relatedIds,
    },
    tx: params.tx,
  });
}

/**
 * Registra una actualización
 */
export async function logSalesUpdate(params: {
  entidad: SalesAuditableEntity;
  entidadId: number;
  companyId: number;
  userId: number;
  changes?: Record<string, unknown>;
  tx?: PrismaClient | typeof prisma;
}): Promise<void> {
  await logSalesAudit({
    entidad: params.entidad,
    entidadId: params.entidadId,
    accion: 'UPDATE',
    companyId: params.companyId,
    userId: params.userId,
    metadata: params.changes as SalesAuditMetadata,
    tx: params.tx,
  });
}

/**
 * Registra una eliminación
 */
export async function logSalesDeletion(params: {
  entidad: SalesAuditableEntity;
  entidadId: number;
  companyId: number;
  userId: number;
  estadoAnterior?: string;
  documentNumber?: string;
  tx?: PrismaClient | typeof prisma;
}): Promise<void> {
  await logSalesAudit({
    entidad: params.entidad,
    entidadId: params.entidadId,
    accion: 'DELETE',
    companyId: params.companyId,
    userId: params.userId,
    metadata: {
      estadoAnterior: params.estadoAnterior,
      documentNumber: params.documentNumber,
    },
    tx: params.tx,
  });
}

/**
 * Registra una cancelación
 */
export async function logSalesCancellation(params: {
  entidad: SalesAuditableEntity;
  entidadId: number;
  estadoAnterior: string;
  reason: string;
  companyId: number;
  userId: number;
  tx?: PrismaClient | typeof prisma;
}): Promise<void> {
  await logSalesAudit({
    entidad: params.entidad,
    entidadId: params.entidadId,
    accion: 'CANCEL',
    companyId: params.companyId,
    userId: params.userId,
    metadata: {
      estadoAnterior: params.estadoAnterior,
      estadoNuevo: 'CANCELADA',
      reason: params.reason,
    },
    tx: params.tx,
  });
}

/**
 * Registra completado
 */
export async function logSalesCompletion(params: {
  entidad: SalesAuditableEntity;
  entidadId: number;
  estadoAnterior: string;
  companyId: number;
  userId: number;
  tx?: PrismaClient | typeof prisma;
}): Promise<void> {
  await logSalesAudit({
    entidad: params.entidad,
    entidadId: params.entidadId,
    accion: 'COMPLETE',
    companyId: params.companyId,
    userId: params.userId,
    metadata: {
      estadoAnterior: params.estadoAnterior,
      estadoNuevo: 'COMPLETADA',
    },
    tx: params.tx,
  });
}

/**
 * Registra envío de cotización al cliente
 */
export async function logQuoteSent(params: {
  quoteId: number;
  companyId: number;
  userId: number;
  clientId: string | number; // string para cuid, number para legacy
  clientName: string;
  documentNumber: string;
  tx?: PrismaClient | typeof prisma;
}): Promise<void> {
  await logSalesAudit({
    entidad: 'quote',
    entidadId: params.quoteId,
    accion: 'SEND',
    companyId: params.companyId,
    userId: params.userId,
    metadata: {
      estadoAnterior: 'BORRADOR',
      estadoNuevo: 'ENVIADA',
      clientId: params.clientId,
      clientName: params.clientName,
      documentNumber: params.documentNumber,
    },
    tx: params.tx,
  });
}

/**
 * Registra aceptación de cotización por cliente
 */
export async function logQuoteAccepted(params: {
  quoteId: number;
  companyId: number;
  userId: number;
  acceptedBy: string;
  ipAddress?: string;
  tx?: PrismaClient | typeof prisma;
}): Promise<void> {
  await logSalesAudit({
    entidad: 'quote',
    entidadId: params.quoteId,
    accion: 'ACCEPT',
    companyId: params.companyId,
    userId: params.userId,
    metadata: {
      estadoAnterior: 'ENVIADA',
      estadoNuevo: 'ACEPTADA',
      acceptedBy: params.acceptedBy,
      ipAddress: params.ipAddress,
      acceptedAt: new Date().toISOString(),
    },
    tx: params.tx,
  });
}

/**
 * Registra conversión de cotización a orden de venta
 */
export async function logQuoteConverted(params: {
  quoteId: number;
  saleId: number;
  quoteNumber: string;
  saleNumber: string;
  companyId: number;
  userId: number;
  tx?: PrismaClient | typeof prisma;
}): Promise<void> {
  // Log en la cotización
  await logSalesAudit({
    entidad: 'quote',
    entidadId: params.quoteId,
    accion: 'CONVERT',
    companyId: params.companyId,
    userId: params.userId,
    metadata: {
      estadoAnterior: 'ACEPTADA',
      estadoNuevo: 'CONVERTIDA',
      relatedIds: [{ entity: 'sale', id: params.saleId, numero: params.saleNumber }],
    },
    tx: params.tx,
  });

  // Log en la venta
  await logSalesAudit({
    entidad: 'sale',
    entidadId: params.saleId,
    accion: 'CREATE',
    companyId: params.companyId,
    userId: params.userId,
    metadata: {
      estadoNuevo: 'BORRADOR',
      sourceEntity: 'quote',
      sourceId: params.quoteId,
      sourceNumber: params.quoteNumber,
      documentNumber: params.saleNumber,
    },
    tx: params.tx,
  });
}

/**
 * Registra emisión de factura
 */
export async function logInvoiceEmitted(params: {
  invoiceId: number;
  companyId: number;
  userId: number;
  invoiceNumber: string;
  amount: number;
  clientId: string | number; // string para cuid, number para legacy
  clientName: string;
  tx?: PrismaClient | typeof prisma;
}): Promise<void> {
  await logSalesAudit({
    entidad: 'sales_invoice',
    entidadId: params.invoiceId,
    accion: 'EMIT',
    companyId: params.companyId,
    userId: params.userId,
    metadata: {
      estadoAnterior: 'BORRADOR',
      estadoNuevo: 'EMITIDA',
      documentNumber: params.invoiceNumber,
      amount: params.amount,
      clientId: params.clientId,
      clientName: params.clientName,
    },
    tx: params.tx,
  });
}

/**
 * Registra anulación de factura
 */
export async function logInvoiceVoided(params: {
  invoiceId: number;
  companyId: number;
  userId: number;
  invoiceNumber: string;
  reason: string;
  tx?: PrismaClient | typeof prisma;
}): Promise<void> {
  await logSalesAudit({
    entidad: 'sales_invoice',
    entidadId: params.invoiceId,
    accion: 'VOID',
    companyId: params.companyId,
    userId: params.userId,
    metadata: {
      estadoAnterior: 'EMITIDA',
      estadoNuevo: 'ANULADA',
      documentNumber: params.invoiceNumber,
      reason: params.reason,
    },
    tx: params.tx,
  });
}

/**
 * Registra aplicación de pago a factura
 */
export async function logPaymentApplied(params: {
  paymentId: number;
  invoiceId: number;
  companyId: number;
  userId: number;
  amount: number;
  paymentMethod?: string;
  tx?: PrismaClient | typeof prisma;
}): Promise<void> {
  // Log en el pago
  await logSalesAudit({
    entidad: 'client_payment',
    entidadId: params.paymentId,
    accion: 'APPLY_PAYMENT',
    companyId: params.companyId,
    userId: params.userId,
    metadata: {
      amount: params.amount,
      paymentMethod: params.paymentMethod,
      relatedIds: [{ entity: 'sales_invoice', id: params.invoiceId }],
    },
    tx: params.tx,
  });
}

/**
 * Registra movimiento en cuenta corriente (ledger)
 */
export async function logLedgerEntry(params: {
  entryId: number;
  companyId: number;
  userId: number;
  clientId: string | number; // string para cuid, number para legacy
  clientName: string;
  tipo: string;
  amount: number;
  sourceEntity?: SalesAuditableEntity;
  sourceId?: number;
  sourceNumber?: string;
  tx?: PrismaClient | typeof prisma;
}): Promise<void> {
  await logSalesAudit({
    entidad: 'ledger_entry',
    entidadId: params.entryId,
    accion: 'CREATE',
    companyId: params.companyId,
    userId: params.userId,
    metadata: {
      clientId: params.clientId,
      clientName: params.clientName,
      estadoNuevo: params.tipo,
      amount: params.amount,
      sourceEntity: params.sourceEntity,
      sourceId: params.sourceId,
      sourceNumber: params.sourceNumber,
    },
    tx: params.tx,
  });
}

/**
 * Registra reversión de movimiento en ledger
 */
export async function logLedgerReversal(params: {
  originalEntryId: number;
  reversalEntryId: number;
  companyId: number;
  userId: number;
  reason: string;
  tx?: PrismaClient | typeof prisma;
}): Promise<void> {
  await logSalesAudit({
    entidad: 'ledger_entry',
    entidadId: params.reversalEntryId,
    accion: 'REVERSE',
    companyId: params.companyId,
    userId: params.userId,
    metadata: {
      reason: params.reason,
      relatedIds: [{ entity: 'ledger_entry', id: params.originalEntryId }],
    },
    tx: params.tx,
  });
}

/**
 * Registra creación de entrega
 */
export async function logDeliveryCreated(params: {
  deliveryId: number;
  companyId: number;
  userId: number;
  saleId: number;
  saleNumber: string;
  tx?: PrismaClient | typeof prisma;
}): Promise<void> {
  await logSalesAudit({
    entidad: 'delivery',
    entidadId: params.deliveryId,
    accion: 'CREATE',
    companyId: params.companyId,
    userId: params.userId,
    metadata: {
      estadoNuevo: 'PENDIENTE',
      sourceEntity: 'sale',
      sourceId: params.saleId,
      sourceNumber: params.saleNumber,
    },
    tx: params.tx,
  });
}

/**
 * Registra entrega completada
 */
export async function logDeliveryCompleted(params: {
  deliveryId: number;
  companyId: number;
  userId: number;
  estadoAnterior: string;
  tx?: PrismaClient | typeof prisma;
}): Promise<void> {
  await logSalesAudit({
    entidad: 'delivery',
    entidadId: params.deliveryId,
    accion: 'COMPLETE',
    companyId: params.companyId,
    userId: params.userId,
    metadata: {
      estadoAnterior: params.estadoAnterior,
      estadoNuevo: 'ENTREGADA',
    },
    tx: params.tx,
  });
}

/**
 * Registra creación de remito desde entrega
 */
export async function logRemitoFromDelivery(params: {
  remitoId: number;
  deliveryId: number;
  companyId: number;
  userId: number;
  remitoNumber: string;
  tx?: PrismaClient | typeof prisma;
}): Promise<void> {
  await logSalesAudit({
    entidad: 'remito',
    entidadId: params.remitoId,
    accion: 'CREATE',
    companyId: params.companyId,
    userId: params.userId,
    metadata: {
      estadoNuevo: 'EMITIDO',
      documentNumber: params.remitoNumber,
      sourceEntity: 'delivery',
      sourceId: params.deliveryId,
    },
    tx: params.tx,
  });
}

/**
 * Registra un intento de acceso denegado
 */
export async function logAccessDenied(params: {
  companyId: number;
  userId: number;
  requiredPermission: string;
  resource: string;
  entidad?: SalesAuditableEntity;
  entidadId?: number;
}): Promise<void> {
  await logSalesAudit({
    entidad: params.entidad || 'quote',
    entidadId: params.entidadId || 0,
    accion: 'ACCESS_DENIED',
    companyId: params.companyId,
    userId: params.userId,
    metadata: {
      requiredPermission: params.requiredPermission,
      resource: params.resource,
    },
  });
}

/**
 * Obtener historial de auditoría de una entidad
 */
export async function getSalesAuditHistory(params: {
  entidad: SalesAuditableEntity;
  entidadId: number;
  companyId: number;
  limit?: number;
}) {
  return prisma.salesAuditLog.findMany({
    where: {
      entidad: params.entidad,
      entidadId: params.entidadId,
      companyId: params.companyId,
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
    orderBy: {
      createdAt: 'desc',
    },
    take: params.limit || 50,
  });
}

/**
 * Obtener historial de auditoría de un cliente
 */
export async function getClientSalesAuditHistory(params: {
  clientId: string | number; // string para cuid, number para legacy
  companyId: number;
  limit?: number;
}) {
  return prisma.salesAuditLog.findMany({
    where: {
      companyId: params.companyId,
      OR: [
        {
          datosNuevos: {
            path: ['clientId'],
            equals: params.clientId,
          },
        },
      ],
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
    orderBy: {
      createdAt: 'desc',
    },
    take: params.limit || 100,
  });
}
