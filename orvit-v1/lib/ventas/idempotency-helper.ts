/**
 * Idempotency Helper for Ventas Module
 *
 * Prevents duplicate operations from retry requests.
 * Uses idempotency keys stored in database with TTL.
 *
 * Usage:
 * ```typescript
 * const result = await withIdempotency(
 *   request,
 *   companyId,
 *   'CREATE_PAYMENT',
 *   async () => {
 *     // Your logic here
 *     return { success: true, data: ... };
 *   }
 * );
 *
 * if (result.isReplay) {
 *   return NextResponse.json(result.response, {
 *     headers: { 'Idempotency-Replayed': 'true' }
 *   });
 * }
 * ```
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

const IDEMPOTENCY_HEADER = 'Idempotency-Key';
const IDEMPOTENCY_TTL_HOURS = 24;

export interface IdempotencyResult<T> {
  isReplay: boolean;
  response: T;
  idempotencyKey: string | null;
}

export type VentasOperation =
  | 'CREATE_PAYMENT'
  | 'CREATE_SALE'
  | 'CREATE_INVOICE'
  | 'CREATE_DELIVERY'
  | 'CREATE_REMITO'
  | 'CREATE_CREDIT_NOTE'
  | 'CREATE_DEBIT_NOTE'
  | 'CONFIRM_LOAD'
  | 'PACKAGE_DOCUMENTS'
  | 'EMIT_INVOICE'
  | 'EMIT_REMITO'
  | 'CREATE_PRODUCT'
  | 'CREATE_CLIENT'
  | 'CREATE_PRICE_LIST'
  | 'CREATE_PICKUP_SLOT'
  | 'CREATE_DISPUTE'
  | 'CREATE_COLLECTION_ACTION'
  | 'CREATE_QUOTATION'
  | 'CONFIRM_SALE'
  | 'PREPARE_SALE'
  | 'CANCEL_SALE'
  // Quote operations
  | 'APPROVE_QUOTE'
  | 'REJECT_QUOTE'
  | 'SEND_QUOTE'
  | 'DUPLICATE_QUOTE'
  // Payment operations
  | 'CONFIRM_PAYMENT'
  | 'CANCEL_PAYMENT'
  | 'REJECT_PAYMENT'
  // Credit note operations
  | 'EMIT_CREDIT_NOTE'
  | 'CANCEL_CREDIT_NOTE'
  | 'RETRY_CREDIT_NOTE';

/**
 * Generate an idempotency key from request body
 */
export function generateIdempotencyKey(body: unknown): string {
  const hash = crypto.createHash('sha256');
  hash.update(JSON.stringify(body));
  hash.update(Date.now().toString());
  return hash.digest('hex').substring(0, 32);
}

/**
 * Extract idempotency key from header
 */
export function getIdempotencyKey(request: NextRequest): string | null {
  return request.headers.get(IDEMPOTENCY_HEADER);
}

/**
 * Check if an idempotency key already exists and return cached response if available
 */
export async function checkIdempotencyReplay(
  idempotencyKey: string,
  companyId: number,
  operation: VentasOperation
): Promise<{ isReplay: true; response: unknown } | { isReplay: false }> {
  try {
    const existing = await prisma.idempotencyKey.findFirst({
      where: {
        key: idempotencyKey,
        companyId,
        operation,
        expiresAt: { gt: new Date() },
      },
    });

    if (existing) {
      if (existing.status === 'COMPLETED' && existing.response) {
        console.log(`[IDEMPOTENCY] Replay detected for key ${idempotencyKey}`);
        return {
          isReplay: true,
          response: existing.response,
        };
      }

      if (existing.status === 'PROCESSING') {
        throw new IdempotencyConflictError(
          'Operación en proceso. Por favor espere antes de reintentar.',
          idempotencyKey
        );
      }
      // Status FAILED: allow retry
    }

    return { isReplay: false };
  } catch (error) {
    if (error instanceof IdempotencyConflictError) {
      throw error;
    }
    console.error('[IDEMPOTENCY] Error checking key:', error);
    return { isReplay: false };
  }
}

/**
 * Mark idempotency key as processing
 */
export async function markIdempotencyProcessing(
  idempotencyKey: string,
  companyId: number,
  operation: VentasOperation,
  entityId?: number,
  entityType?: string
): Promise<void> {
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + IDEMPOTENCY_TTL_HOURS);

  await prisma.idempotencyKey.upsert({
    where: {
      companyId_key: { companyId, key: idempotencyKey },
    },
    create: {
      key: idempotencyKey,
      companyId,
      operation,
      entityType: entityType || operation,
      entityId,
      status: 'PROCESSING',
      expiresAt,
    },
    update: {
      status: 'PROCESSING',
      expiresAt,
      operation,
    },
  });
}

/**
 * Mark idempotency key as completed with response
 */
export async function markIdempotencyCompleted(
  idempotencyKey: string,
  companyId: number,
  response: unknown,
  entityId?: number
): Promise<void> {
  await prisma.idempotencyKey.update({
    where: {
      companyId_key: { companyId, key: idempotencyKey },
    },
    data: {
      status: 'COMPLETED',
      response: response as Prisma.JsonObject,
      entityId,
    },
  });
}

/**
 * Mark idempotency key as failed
 */
export async function markIdempotencyFailed(
  idempotencyKey: string,
  companyId: number
): Promise<void> {
  try {
    await prisma.idempotencyKey.update({
      where: {
        companyId_key: { companyId, key: idempotencyKey },
      },
      data: {
        status: 'FAILED',
      },
    });
  } catch {
    // Ignore cleanup errors
  }
}

/**
 * Execute an operation with idempotency control
 */
export async function withIdempotency<T>(
  idempotencyKey: string | null,
  companyId: number,
  operation: VentasOperation,
  execute: () => Promise<T>,
  options?: {
    entityType?: string;
    getEntityId?: (result: T) => number;
  }
): Promise<IdempotencyResult<T>> {
  // Without key, execute directly
  if (!idempotencyKey) {
    const response = await execute();
    return { isReplay: false, response, idempotencyKey: null };
  }

  // Check for existing completed operation
  const replayCheck = await checkIdempotencyReplay(idempotencyKey, companyId, operation);
  if (replayCheck.isReplay) {
    return {
      isReplay: true,
      response: replayCheck.response as T,
      idempotencyKey,
    };
  }

  // Mark as processing
  await markIdempotencyProcessing(
    idempotencyKey,
    companyId,
    operation,
    undefined,
    options?.entityType
  );

  try {
    // Execute the operation
    const response = await execute();

    // Get entity ID if available
    const entityId = options?.getEntityId?.(response);

    // Mark as completed
    await markIdempotencyCompleted(idempotencyKey, companyId, response, entityId);

    return { isReplay: false, response, idempotencyKey };
  } catch (error) {
    // Mark as failed
    await markIdempotencyFailed(idempotencyKey, companyId);
    throw error;
  }
}

/**
 * Require idempotency key - returns error response if missing
 */
export function requireIdempotencyKey(request: NextRequest): {
  key: string;
  error?: never;
} | {
  key?: never;
  error: NextResponse;
} {
  const key = getIdempotencyKey(request);
  if (!key) {
    return {
      error: NextResponse.json(
        {
          error: 'Idempotency-Key header es requerido para esta operación',
          code: 'IDEMPOTENCY_KEY_REQUIRED',
        },
        { status: 400 }
      ),
    };
  }
  return { key };
}

/**
 * Error class for idempotency conflicts
 */
export class IdempotencyConflictError extends Error {
  public readonly idempotencyKey: string;
  public readonly code = 'CONCURRENT_OPERATION';

  constructor(message: string, key: string) {
    super(message);
    this.name = 'IdempotencyConflictError';
    this.idempotencyKey = key;
  }

  toResponse(): NextResponse {
    return NextResponse.json(
      {
        error: this.message,
        code: this.code,
        idempotencyKey: this.idempotencyKey,
      },
      { status: 409 }
    );
  }
}

/**
 * Handle idempotency errors in catch blocks
 */
export function handleIdempotencyError(error: unknown): NextResponse | null {
  if (error instanceof IdempotencyConflictError) {
    return error.toResponse();
  }
  return null;
}

/**
 * Create response headers for idempotency
 */
export function idempotencyHeaders(
  key: string | null,
  isReplay: boolean
): Record<string, string> {
  if (!key) return {};
  return {
    'Idempotency-Key': key,
    ...(isReplay ? { 'Idempotency-Replayed': 'true' } : {}),
  };
}

/**
 * Cleanup expired idempotency keys (for cron job)
 */
export async function cleanupExpiredIdempotencyKeys(): Promise<number> {
  const result = await prisma.idempotencyKey.deleteMany({
    where: {
      expiresAt: { lt: new Date() },
    },
  });
  return result.count;
}
