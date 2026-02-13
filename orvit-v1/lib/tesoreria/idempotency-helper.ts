/**
 * Idempotency Helper for Tesoreria Module
 *
 * Prevents duplicate operations from retry requests.
 * Uses idempotency keys stored in database with TTL.
 */

import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

const IDEMPOTENCY_HEADER = 'Idempotency-Key';
const IDEMPOTENCY_TTL_HOURS = 24;

export interface IdempotencyResult<T> {
  isReplay: boolean;
  response: T;
  idempotencyKey: string | null;
}

export type TesoreriaOperation =
  | 'CREATE_CASH_ACCOUNT'
  | 'UPDATE_CASH_ACCOUNT'
  | 'CREATE_BANK_ACCOUNT'
  | 'UPDATE_BANK_ACCOUNT'
  | 'CREATE_TREASURY_MOVEMENT'
  | 'REVERSE_TREASURY_MOVEMENT'
  | 'CREATE_CHEQUE'
  | 'UPDATE_CHEQUE'
  | 'DEPOSIT_CHEQUE'
  | 'ENDORSE_CHEQUE'
  | 'REJECT_CHEQUE'
  | 'CASH_CHEQUE'
  | 'CREATE_DEPOSIT'
  | 'CREATE_CASH_DEPOSIT'
  | 'CONFIRM_CASH_DEPOSIT'
  | 'REJECT_CASH_DEPOSIT'
  | 'CREATE_CASH_CLOSING'
  | 'APPROVE_CASH_CLOSING'
  | 'REJECT_CASH_CLOSING'
  | 'CREATE_BANK_STATEMENT'
  | 'IMPORT_BANK_STATEMENT'
  | 'AUTO_MATCH_STATEMENT'
  | 'MANUAL_MATCH'
  | 'UNMATCH'
  | 'RESOLVE_SUSPENSE'
  | 'CREATE_MOVEMENT_FROM_SUSPENSE'
  | 'CLOSE_RECONCILIATION'
  | 'REOPEN_RECONCILIATION'
  | 'CREATE_TRANSFER';

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
 * Check if an idempotency key already exists and return cached response if available
 */
export async function checkIdempotencyReplay(
  idempotencyKey: string,
  companyId: number,
  operation: TesoreriaOperation
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
  operation: TesoreriaOperation,
  entityId?: number,
  entityType?: string
): Promise<void> {
  const expiresAt = new Date();
  expiresAt.setTime(expiresAt.getTime() + IDEMPOTENCY_TTL_HOURS * 60 * 60 * 1000);

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
  operation: TesoreriaOperation,
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
