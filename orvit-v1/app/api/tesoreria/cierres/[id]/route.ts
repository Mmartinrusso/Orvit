/**
 * Cash Closing Detail API - CORRECTED
 *
 * Get, approve, or reject a cash closing.
 * FIXED: Now uses CashMovement instead of TreasuryMovement.
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { approveCashClosingWithAdjustment } from '@/lib/tesoreria/movement-service';
import { requirePermission, TESORERIA_PERMISSIONS } from '@/lib/tesoreria/auth';
import { cashClosingActionSchema } from '@/lib/tesoreria/validation-schemas';
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

// ═══════════════════════════════════════════════════════════════════════════════
// GET - Get closing detail
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { user, error } = await requirePermission(TESORERIA_PERMISSIONS.CIERRES_VIEW);
    if (error) return error;

    const companyId = user!.companyId;

    const { id } = await params;
    const closingId = parseInt(id);

    if (!closingId || isNaN(closingId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const closing = await prisma.cashClosing.findFirst({
      where: { id: closingId, companyId },
      include: {
        cashAccount: { select: { id: true, nombre: true } },
        ajusteMovement: true,
      },
    });

    if (!closing) {
      return NextResponse.json(
        { error: 'Cierre no encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json(closing);
  } catch (error) {
    console.error('Error fetching closing:', error);
    return NextResponse.json(
      { error: 'Error al obtener cierre' },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PATCH - Approve or reject closing
// ═══════════════════════════════════════════════════════════════════════════════

// Map action to idempotency operation
function getOperationType(action: string): TesoreriaOperation {
  switch (action) {
    case 'approve':
    case 'approveWithAdjustment':
      return 'APPROVE_CASH_CLOSING';
    case 'reject':
      return 'REJECT_CASH_CLOSING';
    default:
      return 'APPROVE_CASH_CLOSING';
  }
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { user, error } = await requirePermission(TESORERIA_PERMISSIONS.CIERRES_APPROVE);
    if (error) return error;

    const companyId = user!.companyId;

    const { id } = await params;
    const closingId = parseInt(id);

    if (!closingId || isNaN(closingId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    // Parse and validate request body
    const rawBody = await req.json();
    const validationResult = cashClosingActionSchema.safeParse(rawBody);

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
        const closing = await prisma.cashClosing.findFirst({
          where: { id: closingId, companyId },
        });

        if (!closing) {
          throw new Error('Cierre no encontrado');
        }

        if (closing.estado !== 'PENDIENTE') {
          throw new Error('Solo se pueden aprobar cierres pendientes');
        }

        switch (body.action) {
          case 'approve': {
            // Only approve if no difference
            if (Number(closing.diferencia) !== 0) {
              throw new Error(
                'No se puede aprobar cierre con diferencias. Use approveWithAdjustment.'
              );
            }

            await prisma.cashClosing.update({
              where: { id: closingId },
              data: {
                estado: 'APROBADO',
                aprobadoPor: user!.id,
                aprobadoAt: new Date(),
              },
            });

            return {
              success: true,
              message: 'Cierre aprobado',
            };
          }

          case 'approveWithAdjustment': {
            if (Number(closing.diferencia) === 0) {
              // No adjustment needed, just approve
              await prisma.cashClosing.update({
                where: { id: closingId },
                data: {
                  estado: 'APROBADO',
                  aprobadoPor: user!.id,
                  aprobadoAt: new Date(),
                },
              });

              return {
                success: true,
                message: 'Cierre aprobado',
              };
            }

            // Create adjustment movement
            const result = await approveCashClosingWithAdjustment({
              closingId,
              reason: body.adjustmentReason || 'Diferencia de arqueo',
              userId: user!.id,
            });

            return {
              success: true,
              adjustmentMovementId: result.adjustmentMovementId,
              message: 'Cierre aprobado con ajuste',
            };
          }

          case 'reject': {
            await prisma.cashClosing.update({
              where: { id: closingId },
              data: {
                estado: 'RECHAZADO',
              },
            });

            return {
              success: true,
              message: 'Cierre rechazado',
            };
          }

          default:
            throw new Error('Acción no válida');
        }
      },
      {
        entityType: 'CashClosing',
        getEntityId: () => closingId,
      }
    );

    return NextResponse.json(response, {
      headers: idempotencyHeaders(usedKey, isReplay),
    });
  } catch (error) {
    // Handle idempotency errors
    const idempotencyError = handleIdempotencyError(error);
    if (idempotencyError) return idempotencyError;

    console.error('Error updating closing:', error);
    const message =
      error instanceof Error ? error.message : 'Error al actualizar cierre';

    // Return 422 for business logic errors
    const status =
      message.includes('Solo se pueden') ||
      message.includes('No se puede') ||
      message.includes('no encontrado')
        ? 422
        : 500;

    return NextResponse.json({ error: message }, { status });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// DELETE - Delete pending closing
// ═══════════════════════════════════════════════════════════════════════════════

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const { user, error } = await requirePermission(TESORERIA_PERMISSIONS.CIERRES_APPROVE);
    if (error) return error;

    const companyId = user!.companyId;

    const { id } = await params;
    const closingId = parseInt(id);

    if (!closingId || isNaN(closingId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const closing = await prisma.cashClosing.findFirst({
      where: { id: closingId, companyId },
    });

    if (!closing) {
      return NextResponse.json(
        { error: 'Cierre no encontrado' },
        { status: 404 }
      );
    }

    if (closing.estado !== 'PENDIENTE') {
      return NextResponse.json(
        { error: 'Solo se pueden eliminar cierres pendientes' },
        { status: 422 }
      );
    }

    await prisma.cashClosing.delete({
      where: { id: closingId },
    });

    return NextResponse.json({
      success: true,
      message: 'Cierre eliminado',
    });
  } catch (error) {
    console.error('Error deleting closing:', error);
    return NextResponse.json(
      { error: 'Error al eliminar cierre' },
      { status: 500 }
    );
  }
}
