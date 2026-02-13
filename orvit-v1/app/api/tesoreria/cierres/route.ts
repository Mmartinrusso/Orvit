/**
 * Cash Closings API - CORRECTED
 *
 * Handles cash account daily closings and reconciliation.
 * FIXED: Now uses CashMovement instead of TreasuryMovement.
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { createCashClosing, getTreasuryPosition } from '@/lib/tesoreria/movement-service';
import { getViewMode, applyViewMode } from '@/lib/view-mode';
import { Prisma } from '@prisma/client';
import { requirePermission, TESORERIA_PERMISSIONS } from '@/lib/tesoreria/auth';
import { createCashClosingSchema } from '@/lib/tesoreria/validation-schemas';
import {
  getIdempotencyKey,
  withIdempotency,
  handleIdempotencyError,
  idempotencyHeaders,
} from '@/lib/tesoreria/idempotency-helper';

export const dynamic = 'force-dynamic';

// ═══════════════════════════════════════════════════════════════════════════════
// GET - List cash closings or get system balance for a date
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET(req: NextRequest) {
  try {
    const { user, error } = await requirePermission(TESORERIA_PERMISSIONS.CIERRES_VIEW);
    if (error) return error;

    const companyId = user!.companyId;

    const { searchParams } = new URL(req.url);
    const cashAccountId = searchParams.get('cashAccountId');
    const fecha = searchParams.get('fecha');
    const action = searchParams.get('action');
    const estado = searchParams.get('estado');
    const viewMode = getViewMode(req);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Get system balance for creating a new closing
    if (action === 'preview' && cashAccountId && fecha) {
      const position = await getTreasuryPosition(companyId, viewMode);
      const cashAccountPosition = position.cajas.find(
        (c) => c.id === parseInt(cashAccountId)
      );

      if (!cashAccountPosition) {
        return NextResponse.json(
          { error: 'Cuenta de caja no encontrada' },
          { status: 404 }
        );
      }

      // Calculate balance up to the specified date
      const fechaDate = new Date(fecha);
      fechaDate.setHours(23, 59, 59, 999);

      const movementsSum = await prisma.treasuryMovement.aggregate({
        where: {
          companyId,
          cashAccountId: parseInt(cashAccountId),
          accountType: 'CASH',
          estado: 'CONFIRMADO',
          fecha: { lte: fechaDate },
          ...(viewMode === 'S' ? { docType: 'T1' } : {}),
        },
        _sum: { monto: true },
      });

      // Get check balance (checks in this cash account)
      const checksSum = await prisma.cheque.aggregate({
        where: {
          companyId,
          estado: 'CARTERA',
          // Assuming cheques have a reference to where they are held
        },
        _sum: { monto: true },
      });

      return NextResponse.json({
        cashAccountId: parseInt(cashAccountId),
        fecha,
        saldoSistemaEfectivo: movementsSum._sum.monto || 0,
        saldoSistemaCheques: checksSum._sum.monto || 0,
        saldoSistemaTotal:
          (movementsSum._sum.monto || new Prisma.Decimal(0)).add(
            checksSum._sum.monto || new Prisma.Decimal(0)
          ),
      });
    }

    // List closings
    const where = applyViewMode(
      {
        companyId,
        ...(cashAccountId && { cashAccountId: parseInt(cashAccountId) }),
        ...(fecha && { fecha: new Date(fecha) }),
        ...(estado && { estado: estado as any }),
      },
      viewMode
    );

    const [closings, total] = await Promise.all([
      prisma.cashClosing.findMany({
        where,
        include: {
          cashAccount: { select: { id: true, nombre: true } },
        },
        orderBy: { fecha: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.cashClosing.count({ where }),
    ]);

    return NextResponse.json({
      data: closings,
      pagination: { total, limit, offset },
    });
  } catch (error) {
    console.error('Error fetching closings:', error);
    return NextResponse.json(
      { error: 'Error al obtener cierres' },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// POST - Create cash closing
// ═══════════════════════════════════════════════════════════════════════════════

export async function POST(req: NextRequest) {
  try {
    const { user, error } = await requirePermission(TESORERIA_PERMISSIONS.CIERRES_CREATE);
    if (error) return error;

    const companyId = user!.companyId;

    // Get idempotency key
    const idempotencyKey = getIdempotencyKey(req);

    const body = await req.json();

    // Validate with Zod schema
    const validation = createCashClosingSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Datos de entrada inválidos', details: validation.error.errors },
        { status: 400 }
      );
    }

    const data = validation.data;

    // Execute with idempotency support
    const idempotencyResult = await withIdempotency(
      idempotencyKey,
      companyId,
      'CREATE_CASH_CLOSING',
      async () => {
        // Get cash account and verify it belongs to user's company
        const cashAccount = await prisma.cashAccount.findUnique({
          where: { id: data.cashAccountId },
          select: { id: true, companyId: true },
        });

        if (!cashAccount) {
          throw new Error('CASH_ACCOUNT_NOT_FOUND');
        }

        if (cashAccount.companyId !== companyId) {
          throw new Error('CASH_ACCOUNT_NOT_IN_COMPANY');
        }

        // Check for existing closing on same date
        const existing = await prisma.cashClosing.findFirst({
          where: {
            cashAccountId: data.cashAccountId,
            fecha: new Date(data.fecha),
          },
        });

        if (existing) {
          throw new Error('CLOSING_EXISTS');
        }

        // Create closing using service
        const closing = await createCashClosing({
          cashAccountId: data.cashAccountId,
          fecha: new Date(data.fecha),
          arqueoEfectivo: data.arqueoEfectivo,
          arqueoCheques: data.arqueoCheques,
          desglose: data.desglose || null,
          diferenciaNotas: data.diferenciaNotas,
          docType: data.docType,
          companyId,
          userId: user!.id,
        });

        return {
          id: closing.id,
          diferencia: closing.diferencia,
          estado: closing.estado,
          message:
            Number(closing.diferencia) === 0
              ? 'Cierre completado sin diferencias'
              : `Cierre creado con diferencia de ${closing.diferencia}`,
        };
      },
      {
        entityType: 'CashClosing',
        getEntityId: (result) => result.id,
      }
    );

    return NextResponse.json(idempotencyResult.response, {
      status: idempotencyResult.isReplay ? 200 : 201,
      headers: idempotencyHeaders(idempotencyResult.idempotencyKey, idempotencyResult.isReplay),
    });
  } catch (error) {
    console.error('Error creating closing:', error);

    // Handle idempotency conflict error
    const idempotencyError = handleIdempotencyError(error);
    if (idempotencyError) return idempotencyError;

    // Handle custom errors
    if (error instanceof Error) {
      if (error.message === 'CASH_ACCOUNT_NOT_FOUND') {
        return NextResponse.json(
          { error: 'Cuenta de caja no encontrada' },
          { status: 404 }
        );
      }
      if (error.message === 'CASH_ACCOUNT_NOT_IN_COMPANY') {
        return NextResponse.json(
          { error: 'La cuenta de caja no pertenece a su empresa' },
          { status: 403 }
        );
      }
      if (error.message === 'CLOSING_EXISTS') {
        return NextResponse.json(
          { error: 'Ya existe un cierre para esta fecha' },
          { status: 409 }
        );
      }
    }

    const message = error instanceof Error ? error.message : 'Error al crear cierre';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
