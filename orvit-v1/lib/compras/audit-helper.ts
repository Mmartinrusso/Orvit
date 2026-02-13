import { prisma } from '@/lib/prisma';
import type { PrismaClient } from '@prisma/client';
import type { AuditableEntity, AuditAction, AuditMetadata } from './audit-config';

export interface LogPurchaseAuditParams {
  entidad: AuditableEntity;
  entidadId: number;
  accion: AuditAction;
  companyId: number;
  userId: number;
  metadata?: AuditMetadata;
  tx?: PrismaClient | typeof prisma;
}

/**
 * Registra un evento de auditoría en PurchaseAuditLog
 * Soporta transacciones pasando el parámetro `tx`
 */
export async function logPurchaseAudit(params: LogPurchaseAuditParams): Promise<void> {
  const db = params.tx || prisma;

  try {
    await db.purchaseAuditLog.create({
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
            }
          : null,
        companyId: params.companyId,
        userId: params.userId,
      },
    });
  } catch (error) {
    // Log error pero no fallar la operación principal
    console.error('[AuditHelper] Error registrando auditoría:', error);
  }
}

/**
 * Registra un cambio de estado
 */
export async function logStatusChange(params: {
  entidad: AuditableEntity;
  entidadId: number;
  estadoAnterior: string;
  estadoNuevo: string;
  companyId: number;
  userId: number;
  reason?: string;
  relatedIds?: AuditMetadata['relatedIds'];
  tx?: PrismaClient | typeof prisma;
}): Promise<void> {
  await logPurchaseAudit({
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
export async function logApproval(params: {
  entidad: AuditableEntity;
  entidadId: number;
  estadoAnterior: string;
  companyId: number;
  userId: number;
  tx?: PrismaClient | typeof prisma;
}): Promise<void> {
  await logPurchaseAudit({
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
export async function logRejection(params: {
  entidad: AuditableEntity;
  entidadId: number;
  estadoAnterior: string;
  reason: string;
  companyId: number;
  userId: number;
  tx?: PrismaClient | typeof prisma;
}): Promise<void> {
  await logPurchaseAudit({
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
export async function logCreation(params: {
  entidad: AuditableEntity;
  entidadId: number;
  companyId: number;
  userId: number;
  estadoInicial?: string;
  amount?: number;
  relatedIds?: AuditMetadata['relatedIds'];
  tx?: PrismaClient | typeof prisma;
}): Promise<void> {
  await logPurchaseAudit({
    entidad: params.entidad,
    entidadId: params.entidadId,
    accion: 'CREATE',
    companyId: params.companyId,
    userId: params.userId,
    metadata: {
      estadoNuevo: params.estadoInicial,
      amount: params.amount,
      relatedIds: params.relatedIds,
    },
    tx: params.tx,
  });
}

/**
 * Registra una eliminación
 */
export async function logDeletion(params: {
  entidad: AuditableEntity;
  entidadId: number;
  companyId: number;
  userId: number;
  estadoAnterior?: string;
  tx?: PrismaClient | typeof prisma;
}): Promise<void> {
  await logPurchaseAudit({
    entidad: params.entidad,
    entidadId: params.entidadId,
    accion: 'DELETE',
    companyId: params.companyId,
    userId: params.userId,
    metadata: {
      estadoAnterior: params.estadoAnterior,
    },
    tx: params.tx,
  });
}

/**
 * Registra una cancelación
 */
export async function logCancellation(params: {
  entidad: AuditableEntity;
  entidadId: number;
  estadoAnterior: string;
  reason: string;
  companyId: number;
  userId: number;
  tx?: PrismaClient | typeof prisma;
}): Promise<void> {
  await logPurchaseAudit({
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
export async function logCompletion(params: {
  entidad: AuditableEntity;
  entidadId: number;
  estadoAnterior: string;
  companyId: number;
  userId: number;
  tx?: PrismaClient | typeof prisma;
}): Promise<void> {
  await logPurchaseAudit({
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
