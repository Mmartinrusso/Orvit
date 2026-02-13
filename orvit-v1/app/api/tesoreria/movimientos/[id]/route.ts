/**
 * Treasury Movement Detail API - CORRECTED
 *
 * Get, update, or reverse cash/bank movements.
 * FIXED: Was using non-existent TreasuryMovement, now uses CashMovement/BankMovement.
 *
 * NOTE: This endpoint requires the `type` query parameter (cash or bank) to identify
 * which table to query, since we no longer have a unified TreasuryMovement model.
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { reverseCashMovement, reverseBankMovement } from '@/lib/tesoreria/movement-service';
import { requirePermission, TESORERIA_PERMISSIONS } from '@/lib/tesoreria/auth';
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
// GET - Get movement detail
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { user, error } = await requirePermission(TESORERIA_PERMISSIONS.MOVIMIENTOS_VIEW);
    if (error) return error;

    const companyId = user!.companyId;
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type'); // 'cash' or 'bank'

    const { id } = await params;
    const movementId = parseInt(id);

    if (!movementId || isNaN(movementId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    if (!type || !['cash', 'bank'].includes(type)) {
      return NextResponse.json(
        { error: 'Parámetro type requerido (cash o bank)' },
        { status: 400 }
      );
    }

    if (type === 'cash') {
      const movement = await prisma.cashMovement.findFirst({
        where: { id: movementId, companyId },
        include: {
          cashAccount: { select: { id: true, nombre: true } },
        },
      });

      if (!movement) {
        return NextResponse.json({ error: 'Movimiento no encontrado' }, { status: 404 });
      }

      return NextResponse.json({
        ...movement,
        accountType: 'CASH',
        monto: movement.tipo === 'INGRESO' ? movement.ingreso : movement.egreso,
      });
    } else {
      const movement = await prisma.bankMovement.findFirst({
        where: { id: movementId, companyId },
        include: {
          bankAccount: {
            select: { id: true, nombre: true, banco: true, numeroCuenta: true },
          },
          cheque: true,
        },
      });

      if (!movement) {
        return NextResponse.json({ error: 'Movimiento no encontrado' }, { status: 404 });
      }

      return NextResponse.json({
        ...movement,
        accountType: 'BANK',
        monto: movement.tipo === 'INGRESO' ? movement.ingreso : movement.egreso,
      });
    }
  } catch (error) {
    console.error('Error fetching movement:', error);
    return NextResponse.json({ error: 'Error al obtener movimiento' }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// DELETE - Reverse movement
// ═══════════════════════════════════════════════════════════════════════════════

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const { user, error } = await requirePermission(TESORERIA_PERMISSIONS.MOVIMIENTOS_EDIT);
    if (error) return error;

    const companyId = user!.companyId;
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type'); // 'cash' or 'bank'
    const reason = searchParams.get('reason') || 'Reversión manual';

    const { id } = await params;
    const movementId = parseInt(id);

    if (!movementId || isNaN(movementId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    if (!type || !['cash', 'bank'].includes(type)) {
      return NextResponse.json(
        { error: 'Parámetro type requerido (cash o bank)' },
        { status: 400 }
      );
    }

    const idempotencyKey = getIdempotencyKey(req);

    // Execute with idempotency
    const { response, isReplay, idempotencyKey: usedKey } = await withIdempotency(
      idempotencyKey,
      companyId,
      'REVERSE_TREASURY_MOVEMENT',
      async () => {
        let reversal;

        if (type === 'cash') {
          // Verify movement exists
          const movement = await prisma.cashMovement.findFirst({
            where: { id: movementId, companyId },
          });

          if (!movement) {
            throw new Error('Movimiento no encontrado');
          }

          reversal = await reverseCashMovement(movementId, reason, user!.id);
        } else {
          // Verify movement exists
          const movement = await prisma.bankMovement.findFirst({
            where: { id: movementId, companyId },
          });

          if (!movement) {
            throw new Error('Movimiento no encontrado');
          }

          reversal = await reverseBankMovement(movementId, reason, user!.id);
        }

        return {
          success: true,
          reversalId: reversal.id,
          accountType: type.toUpperCase(),
          message: 'Movimiento reversado exitosamente',
        };
      },
      {
        entityType: type === 'cash' ? 'CashMovement' : 'BankMovement',
        getEntityId: () => movementId,
      }
    );

    return NextResponse.json(response, {
      headers: idempotencyHeaders(usedKey, isReplay),
    });
  } catch (error) {
    // Handle idempotency errors
    const idempotencyError = handleIdempotencyError(error);
    if (idempotencyError) return idempotencyError;

    console.error('Error reversing movement:', error);
    const message = error instanceof Error ? error.message : 'Error al reversar movimiento';

    const status = message.includes('no encontrado') ? 404 : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
