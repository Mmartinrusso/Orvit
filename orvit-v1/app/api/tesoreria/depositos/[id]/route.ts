/**
 * Cash Deposit Detail API - O2C Phase 3
 *
 * Get, confirm, or cancel a cash deposit.
 * All financial operations are idempotent and validated.
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requirePermission, TESORERIA_PERMISSIONS } from '@/lib/tesoreria/auth';
import { depositActionSchema } from '@/lib/tesoreria/validation-schemas';
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
// GET - Get deposit detail
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { user, error } = await requirePermission(TESORERIA_PERMISSIONS.DEPOSITOS_VIEW);
    if (error) return error;

    const companyId = user!.companyId;

    const { id } = await params;
    const depositId = parseInt(id);

    if (!depositId || isNaN(depositId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const deposit = await prisma.cashDeposit.findFirst({
      where: { id: depositId, companyId },
      include: {
        cashAccount: { select: { id: true, nombre: true } },
        bankAccount: { select: { id: true, nombre: true, banco: true } },
        egresoMovement: true,
        ingresoMovement: true,
      },
    });

    if (!deposit) {
      return NextResponse.json(
        { error: 'Depósito no encontrado' },
        { status: 404 }
      );
    }

    // Get associated checks if any
    const checks = deposit.chequeIds.length
      ? await prisma.cheque.findMany({
          where: { id: { in: deposit.chequeIds } },
          select: {
            id: true,
            numero: true,
            banco: true,
            monto: true,
            fechaEmision: true,
            fechaVencimiento: true,
          },
        })
      : [];

    return NextResponse.json({
      ...deposit,
      cheques: checks,
    });
  } catch (error) {
    console.error('Error fetching deposit:', error);
    return NextResponse.json(
      { error: 'Error al obtener depósito' },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PATCH - Confirm or reject deposit
// ═══════════════════════════════════════════════════════════════════════════════

// Map action to idempotency operation
function getOperationType(action: string): TesoreriaOperation {
  switch (action) {
    case 'confirm':
      return 'CONFIRM_CASH_DEPOSIT';
    case 'reject':
      return 'REJECT_CASH_DEPOSIT';
    default:
      return 'CONFIRM_CASH_DEPOSIT';
  }
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { user, error } = await requirePermission(TESORERIA_PERMISSIONS.DEPOSITOS_CONFIRM);
    if (error) return error;

    const companyId = user!.companyId;

    const { id } = await params;
    const depositId = parseInt(id);

    if (!depositId || isNaN(depositId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    // Parse and validate request body
    const rawBody = await req.json();
    const validationResult = depositActionSchema.safeParse(rawBody);

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
        const deposit = await prisma.cashDeposit.findFirst({
          where: { id: depositId, companyId },
          include: {
            egresoMovement: true,
            ingresoMovement: true,
          },
        });

        if (!deposit) {
          throw new Error('Depósito no encontrado');
        }

        if (deposit.estado !== 'PENDIENTE') {
          throw new Error('Solo se pueden confirmar depósitos pendientes');
        }

        if (body.action === 'confirm') {
          await prisma.$transaction(async (tx) => {
            // Update deposit status
            await tx.cashDeposit.update({
              where: { id: depositId },
              data: {
                estado: 'CONFIRMADO',
                confirmedBy: user!.id,
                confirmedAt: new Date(),
              },
            });

            // Confirm treasury movements
            if (deposit.egresoMovementId) {
              await tx.treasuryMovement.update({
                where: { id: deposit.egresoMovementId },
                data: { estado: 'CONFIRMADO' },
              });
            }
            if (deposit.ingresoMovementId) {
              await tx.treasuryMovement.update({
                where: { id: deposit.ingresoMovementId },
                data: { estado: 'CONFIRMADO' },
              });
            }

            // Update check statuses to DEPOSITADO
            if (deposit.chequeIds.length > 0) {
              await tx.cheque.updateMany({
                where: { id: { in: deposit.chequeIds } },
                data: {
                  estado: 'DEPOSITADO',
                  depositadoEn: deposit.bankAccountId,
                  fechaDeposito: new Date(),
                },
              });
            }
          });

          return {
            success: true,
            message: 'Depósito confirmado',
          };
        }

        if (body.action === 'reject') {
          await prisma.$transaction(async (tx) => {
            // Update deposit status
            await tx.cashDeposit.update({
              where: { id: depositId },
              data: {
                estado: 'RECHAZADO',
              },
            });

            // Reverse/cancel treasury movements
            if (deposit.egresoMovementId) {
              await tx.treasuryMovement.update({
                where: { id: deposit.egresoMovementId },
                data: { estado: 'REVERSADO' },
              });
            }
            if (deposit.ingresoMovementId) {
              await tx.treasuryMovement.update({
                where: { id: deposit.ingresoMovementId },
                data: { estado: 'REVERSADO' },
              });
            }

            // Return checks to CARTERA
            if (deposit.chequeIds.length > 0) {
              await tx.cheque.updateMany({
                where: { id: { in: deposit.chequeIds } },
                data: {
                  estado: 'CARTERA',
                  depositadoEn: null,
                  fechaDeposito: null,
                },
              });
            }
          });

          return {
            success: true,
            message: 'Depósito rechazado',
          };
        }

        throw new Error('Acción no válida');
      },
      {
        entityType: 'CashDeposit',
        getEntityId: () => depositId,
      }
    );

    return NextResponse.json(response, {
      headers: idempotencyHeaders(usedKey, isReplay),
    });
  } catch (error) {
    // Handle idempotency errors
    const idempotencyError = handleIdempotencyError(error);
    if (idempotencyError) return idempotencyError;

    console.error('Error updating deposit:', error);
    const message =
      error instanceof Error ? error.message : 'Error al actualizar depósito';

    // Return 422 for business logic errors
    const status =
      message.includes('Solo se pueden') ||
      message.includes('no encontrado')
        ? 422
        : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
