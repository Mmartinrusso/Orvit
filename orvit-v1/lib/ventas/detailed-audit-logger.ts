/**
 * Detailed Audit Logger
 *
 * Logs changes with field-level diffs.
 * Tracks who changed what, when, and from/to values.
 */

import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';

export type AuditEntity =
  | 'sale'
  | 'sale_item'
  | 'invoice'
  | 'delivery'
  | 'loadorder'
  | 'remito'
  | 'payment';

export type AuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'STATE_CHANGE'
  | 'APPROVE'
  | 'REJECT'
  | 'CANCEL';

export interface FieldChange {
  field: string;
  oldValue: any;
  newValue: any;
  dataType?: 'string' | 'number' | 'boolean' | 'date' | 'decimal' | 'json';
}

export interface DetailedAuditLogData {
  entityType: AuditEntity;
  entityId: number;
  action: AuditAction;
  userId: number;
  companyId: number;
  changes?: FieldChange[];
  reason?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
}

/**
 * Log detailed audit entry with field-level changes
 */
export async function logDetailedAudit(data: DetailedAuditLogData): Promise<void> {
  try {
    await prisma.detailedAuditLog.create({
      data: {
        entityType: data.entityType.toUpperCase(),
        entityId: data.entityId,
        action: data.action,
        userId: data.userId,
        companyId: data.companyId,
        changes: data.changes as unknown as Prisma.JsonArray,
        reason: data.reason,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        metadata: data.metadata as unknown as Prisma.JsonObject,
        timestamp: new Date(),
      },
    });
  } catch (error) {
    console.error('[DETAILED-AUDIT] Failed to log:', error);
    // Don't throw - audit failures shouldn't break business logic
  }
}

/**
 * Compare two objects and generate field changes array
 */
export function generateFieldChanges<T extends Record<string, any>>(
  oldObj: T,
  newObj: T,
  fieldsToTrack?: string[]
): FieldChange[] {
  const changes: FieldChange[] = [];

  const keysToCheck = fieldsToTrack || Object.keys({ ...oldObj, ...newObj });

  for (const key of keysToCheck) {
    const oldValue = oldObj[key];
    const newValue = newObj[key];

    // Skip if values are equal
    if (isEqual(oldValue, newValue)) {
      continue;
    }

    // Detect data type
    const dataType = detectDataType(newValue ?? oldValue);

    changes.push({
      field: key,
      oldValue: serializeValue(oldValue),
      newValue: serializeValue(newValue),
      dataType,
    });
  }

  return changes;
}

/**
 * Get audit history for an entity
 */
export async function getAuditHistory(
  entityType: AuditEntity,
  entityId: number,
  options?: {
    limit?: number;
    offset?: number;
    action?: AuditAction;
  }
) {
  return await prisma.detailedAuditLog.findMany({
    where: {
      entityType: entityType.toUpperCase(),
      entityId,
      ...(options?.action && { action: options.action }),
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
      timestamp: 'desc',
    },
    take: options?.limit || 50,
    skip: options?.offset || 0,
  });
}

/**
 * Get audit history with changes for a specific field
 */
export async function getFieldHistory(
  entityType: AuditEntity,
  entityId: number,
  fieldName: string
) {
  const logs = await getAuditHistory(entityType, entityId);

  return logs
    .map((log) => {
      const changes = log.changes as unknown as FieldChange[];
      const fieldChange = changes?.find((c) => c.field === fieldName);

      if (!fieldChange) return null;

      return {
        timestamp: log.timestamp,
        user: log.user,
        oldValue: fieldChange.oldValue,
        newValue: fieldChange.newValue,
        reason: log.reason,
      };
    })
    .filter(Boolean);
}

/**
 * Generate human-readable diff summary
 */
export function generateDiffSummary(changes: FieldChange[]): string {
  if (changes.length === 0) return 'Sin cambios';

  const summaries = changes.map((change) => {
    const fieldLabel = formatFieldName(change.field);
    const oldVal = formatValue(change.oldValue, change.dataType);
    const newVal = formatValue(change.newValue, change.dataType);

    return `${fieldLabel}: ${oldVal} → ${newVal}`;
  });

  return summaries.join(', ');
}

/**
 * Revert changes (generate reverse change set)
 */
export function generateReverseChanges(changes: FieldChange[]): FieldChange[] {
  return changes.map((change) => ({
    field: change.field,
    oldValue: change.newValue,
    newValue: change.oldValue,
    dataType: change.dataType,
  }));
}

// Helper functions

function isEqual(a: any, b: any): boolean {
  // Handle null/undefined
  if (a === b) return true;
  if (a == null || b == null) return false;

  // Handle Prisma Decimal
  if (a?.constructor?.name === 'Decimal' || b?.constructor?.name === 'Decimal') {
    return a?.toString() === b?.toString();
  }

  // Handle dates
  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }

  // Handle objects/arrays
  if (typeof a === 'object' && typeof b === 'object') {
    return JSON.stringify(a) === JSON.stringify(b);
  }

  return false;
}

function serializeValue(value: any): any {
  if (value === null || value === undefined) return null;

  // Handle Prisma Decimal
  if (value?.constructor?.name === 'Decimal') {
    return parseFloat(value.toString());
  }

  // Handle dates
  if (value instanceof Date) {
    return value.toISOString();
  }

  // Handle objects/arrays
  if (typeof value === 'object') {
    return JSON.parse(JSON.stringify(value));
  }

  return value;
}

function detectDataType(value: any): FieldChange['dataType'] {
  if (value === null || value === undefined) return 'string';

  if (value instanceof Date) return 'date';
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') return 'number';
  if (value?.constructor?.name === 'Decimal') return 'decimal';
  if (typeof value === 'object') return 'json';

  return 'string';
}

function formatFieldName(field: string): string {
  // Convert camelCase to Title Case
  return field
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}

function formatValue(value: any, dataType?: FieldChange['dataType']): string {
  if (value === null || value === undefined) return '-';

  switch (dataType) {
    case 'date':
      return new Date(value).toLocaleDateString('es-AR');
    case 'boolean':
      return value ? 'Sí' : 'No';
    case 'decimal':
    case 'number':
      return typeof value === 'number' ? value.toFixed(2) : value.toString();
    case 'json':
      return JSON.stringify(value);
    default:
      return value.toString();
  }
}
