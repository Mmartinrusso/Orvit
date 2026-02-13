/**
 * Idempotency Helper
 *
 * Previene operaciones duplicadas por retry de requests.
 * Usa una tabla de claves de idempotencia con TTL.
 *
 * Uso:
 * ```typescript
 * const result = await withIdempotency(
 *   request,
 *   companyId,
 *   'CREATE_PAYMENT',
 *   prisma,
 *   async () => {
 *     // Tu lógica aquí
 *     return { success: true, data: ... };
 *   }
 * );
 * ```
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const IDEMPOTENCY_HEADER = 'Idempotency-Key';
const IDEMPOTENCY_TTL_HOURS = 24;

export interface IdempotencyResult<T> {
  isReplay: boolean;
  response: T;
}

/**
 * Genera una clave de idempotencia a partir del body del request
 */
export function generateIdempotencyKey(body: unknown): string {
  const hash = crypto.createHash('sha256');
  hash.update(JSON.stringify(body));
  hash.update(Date.now().toString());
  return hash.digest('hex').substring(0, 32);
}

/**
 * Extrae la clave de idempotencia del header o genera una del body
 */
export function getIdempotencyKey(request: NextRequest, body?: unknown): string | null {
  const headerKey = request.headers.get(IDEMPOTENCY_HEADER);
  if (headerKey) {
    return headerKey;
  }

  // Si no hay header pero hay body, generarla del hash del body
  if (body) {
    return generateIdempotencyKey(body);
  }

  return null;
}

/**
 * Ejecuta una operación con control de idempotencia
 */
export async function withIdempotency<T>(
  idempotencyKey: string | null,
  companyId: number,
  operation: string,
  prismaClient: PrismaClient,
  execute: () => Promise<T>
): Promise<IdempotencyResult<T>> {
  // Sin clave, ejecutar directamente
  if (!idempotencyKey) {
    const response = await execute();
    return { isReplay: false, response };
  }

  // Verificar si ya existe
  const existing = await prismaClient.$queryRaw<
    Array<{ status: string; response: string | null; entityId: number | null }>
  >`
    SELECT "status", "response"::text, "entityId"
    FROM "IdempotencyKey"
    WHERE "companyId" = ${companyId}
    AND "key" = ${idempotencyKey}
    AND "expiresAt" > NOW()
    LIMIT 1
  `;

  if (existing.length > 0) {
    const record = existing[0];

    if (record.status === 'COMPLETED' && record.response) {
      // Operación completada previamente, retornar respuesta guardada
      console.log(`[IDEMPOTENCY] Replay detected for key ${idempotencyKey}`);
      return {
        isReplay: true,
        response: JSON.parse(record.response) as T,
      };
    }

    if (record.status === 'PROCESSING') {
      // Operación en progreso (retry concurrente)
      throw new IdempotencyConflictError(
        'Operación en proceso. Por favor espere antes de reintentar.',
        idempotencyKey
      );
    }

    // Status FAILED: permitir retry
  }

  // Registrar como PROCESSING
  await prismaClient.$executeRaw`
    INSERT INTO "IdempotencyKey" ("key", "companyId", "operation", "entityType", "status", "expiresAt")
    VALUES (
      ${idempotencyKey},
      ${companyId},
      ${operation},
      ${operation},
      'PROCESSING',
      NOW() + INTERVAL '${IDEMPOTENCY_TTL_HOURS} hours'
    )
    ON CONFLICT ("companyId", "key")
    DO UPDATE SET "status" = 'PROCESSING', "expiresAt" = NOW() + INTERVAL '${IDEMPOTENCY_TTL_HOURS} hours'
  `;

  try {
    // Ejecutar operación
    const response = await execute();

    // Marcar como completada
    await prismaClient.$executeRaw`
      UPDATE "IdempotencyKey"
      SET "status" = 'COMPLETED', "response" = ${JSON.stringify(response)}::jsonb
      WHERE "companyId" = ${companyId} AND "key" = ${idempotencyKey}
    `;

    return { isReplay: false, response };
  } catch (error) {
    // Marcar como fallida
    await prismaClient.$executeRaw`
      UPDATE "IdempotencyKey"
      SET "status" = 'FAILED'
      WHERE "companyId" = ${companyId} AND "key" = ${idempotencyKey}
    `;

    throw error;
  }
}

/**
 * Error de conflicto de idempotencia
 */
export class IdempotencyConflictError extends Error {
  public readonly idempotencyKey: string;

  constructor(message: string, key: string) {
    super(message);
    this.name = 'IdempotencyConflictError';
    this.idempotencyKey = key;
  }
}

/**
 * Middleware para manejar idempotencia en API routes
 * Retorna null si debe continuar, o NextResponse si es replay/error
 */
export async function handleIdempotency(
  request: NextRequest,
  companyId: number,
  operation: string,
  prismaClient: PrismaClient
): Promise<NextResponse | null> {
  const idempotencyKey = request.headers.get(IDEMPOTENCY_HEADER);
  if (!idempotencyKey) {
    return null; // Sin clave, continuar normalmente
  }

  try {
    const existing = await prismaClient.$queryRaw<
      Array<{ status: string; response: string | null }>
    >`
      SELECT "status", "response"::text
      FROM "IdempotencyKey"
      WHERE "companyId" = ${companyId}
      AND "key" = ${idempotencyKey}
      AND "operation" = ${operation}
      AND "expiresAt" > NOW()
      LIMIT 1
    `;

    if (existing.length > 0) {
      const record = existing[0];

      if (record.status === 'COMPLETED' && record.response) {
        // Retornar respuesta guardada con header indicando replay
        const response = JSON.parse(record.response);
        return NextResponse.json(response, {
          headers: {
            'Idempotency-Replayed': 'true',
            'Idempotency-Key': idempotencyKey,
          },
        });
      }

      if (record.status === 'PROCESSING') {
        return NextResponse.json(
          {
            error: 'Operación en proceso',
            code: 'CONCURRENT_OPERATION',
            idempotencyKey,
          },
          { status: 409 }
        );
      }
    }

    return null; // Continuar con la operación
  } catch (error) {
    console.error('[IDEMPOTENCY] Error checking key:', error);
    return null; // En caso de error, permitir continuar
  }
}

/**
 * Limpia claves de idempotencia expiradas (para cron job)
 */
export async function cleanupExpiredIdempotencyKeys(
  prismaClient: PrismaClient
): Promise<number> {
  const result = await prismaClient.$executeRaw`
    DELETE FROM "IdempotencyKey"
    WHERE "expiresAt" < NOW()
  `;
  return result;
}
