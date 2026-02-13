/**
 * Manual Match/Unmatch Bank Reconciliation API - O2C Phase 4
 *
 * Handles manual reconciliation of bank statement items.
 * All operations are idempotent and validated.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  manualMatch,
  unmatch,
  resolveSuspense,
  createMovementFromSuspense,
} from '@/lib/tesoreria/reconciliation-matcher';
import { requirePermission, TESORERIA_PERMISSIONS } from '@/lib/tesoreria/auth';
import { reconciliationMatchRequestSchema } from '@/lib/tesoreria/validation-schemas';
import {
  withIdempotency,
  getIdempotencyKey,
  handleIdempotencyError,
  idempotencyHeaders,
  type TesoreriaOperation,
} from '@/lib/tesoreria/idempotency-helper';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Map action to idempotency operation
function getOperationType(action: string): TesoreriaOperation {
  switch (action) {
    case 'match':
      return 'MANUAL_MATCH';
    case 'unmatch':
      return 'UNMATCH';
    case 'resolveSuspense':
      return 'RESOLVE_SUSPENSE';
    case 'createMovement':
      return 'CREATE_MOVEMENT_FROM_SUSPENSE';
    default:
      return 'MANUAL_MATCH';
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// POST - Manual match or special operations
// ═══════════════════════════════════════════════════════════════════════════════

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { user, error } = await requirePermission(TESORERIA_PERMISSIONS.CONCILIACION_MATCH);
    if (error) return error;

    const companyId = user!.companyId;

    const { id } = await params;
    const statementId = parseInt(id);

    if (!statementId || isNaN(statementId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    // Parse and validate request body
    const rawBody = await req.json();
    const validationResult = reconciliationMatchRequestSchema.safeParse(rawBody);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Datos de solicitud inválidos',
          details: validationResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const body = validationResult.data;
    const idempotencyKey = getIdempotencyKey(req);
    const operation = getOperationType(body.action);

    // Execute with idempotency
    const { response, isReplay, idempotencyKey: usedKey } = await withIdempotency(
      idempotencyKey,
      companyId,
      operation,
      async () => {
        // Verify statement exists, belongs to user's company, and is not closed
        const statement = await prisma.bankStatement.findFirst({
          where: { id: statementId, companyId },
          select: { id: true, estado: true, companyId: true },
        });

        if (!statement) {
          throw new Error('Extracto no encontrado');
        }

        if (statement.estado === 'CERRADA') {
          throw new Error('No se puede modificar un extracto cerrado');
        }

        // Verify item belongs to this statement
        const item = await prisma.bankStatementItem.findFirst({
          where: { id: body.itemId, statementId },
        });

        if (!item) {
          throw new Error('Item no pertenece a este extracto');
        }

        // Execute action
        switch (body.action) {
          case 'match': {
            const result = await manualMatch(
              body.itemId,
              body.movementId,
              user!.id
            );

            return {
              success: true,
              result,
              message: 'Item conciliado manualmente',
            };
          }

          case 'unmatch': {
            await unmatch(body.itemId);

            return {
              success: true,
              message: 'Conciliación deshecha',
            };
          }

          case 'resolveSuspense': {
            await resolveSuspense(body.itemId, body.notas, user!.id);

            return {
              success: true,
              message: 'Suspense resuelto',
            };
          }

          case 'createMovement': {
            const movementId = await createMovementFromSuspense(
              body.itemId,
              body.referenceType,
              body.descripcion,
              user!.id
            );

            return {
              success: true,
              movementId,
              message: 'Movimiento creado y conciliado',
            };
          }

          default:
            throw new Error('Acción no válida');
        }
      },
      {
        entityType: 'BankStatementItem',
        getEntityId: () => body.itemId,
      }
    );

    return NextResponse.json(response, {
      headers: idempotencyHeaders(usedKey, isReplay),
    });
  } catch (error) {
    // Handle idempotency errors
    const idempotencyError = handleIdempotencyError(error);
    if (idempotencyError) return idempotencyError;

    console.error('Error in manual reconciliation:', error);
    const message = error instanceof Error ? error.message : 'Error en operación';

    // Return 422 for business logic errors
    const status =
      message.includes('No se puede') ||
      message.includes('no encontrado') ||
      message.includes('no pertenece')
        ? 422
        : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
