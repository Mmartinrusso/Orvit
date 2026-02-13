/**
 * Treasury Movements API - CORRECTED
 *
 * Handles cash and bank movements using the correct models.
 * FIXED: Was using non-existent TreasuryMovement, now uses CashMovement/BankMovement.
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { createCashMovement, createBankMovement } from '@/lib/tesoreria/movement-service';
import { getViewMode, applyViewMode, ViewMode } from '@/lib/view-mode';
import { requirePermission, TESORERIA_PERMISSIONS } from '@/lib/tesoreria/auth';
import { createTreasuryMovementSchema } from '@/lib/tesoreria/validation-schemas';
import {
  getIdempotencyKey,
  withIdempotency,
  handleIdempotencyError,
  idempotencyHeaders,
} from '@/lib/tesoreria/idempotency-helper';

export const dynamic = 'force-dynamic';

// ═══════════════════════════════════════════════════════════════════════════════
// GET - List treasury movements
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET(req: NextRequest) {
  try {
    const { user, error } = await requirePermission(TESORERIA_PERMISSIONS.MOVIMIENTOS_VIEW);
    if (error) return error;

    const companyId = user!.companyId;

    const { searchParams } = new URL(req.url);
    const accountType = searchParams.get('accountType'); // CASH, BANK, CHECK_PORTFOLIO
    const cashAccountId = searchParams.get('cashAccountId');
    const bankAccountId = searchParams.get('bankAccountId');
    const tipo = searchParams.get('tipo'); // INGRESO, EGRESO
    const medio = searchParams.get('medio');
    const estado = searchParams.get('estado');
    const conciliado = searchParams.get('conciliado');
    const referenceType = searchParams.get('referenceType');
    const fechaDesde = searchParams.get('fechaDesde');
    const fechaHasta = searchParams.get('fechaHasta');
    const viewMode = getViewMode(req);
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build separate where clauses for cash and bank
    const dateFilter = fechaDesde && fechaHasta
      ? {
          fecha: {
            gte: new Date(fechaDesde),
            lte: new Date(fechaHasta),
          },
        }
      : {};

    const baseWhere = {
      companyId,
      ...(tipo && { tipo: tipo as any }),
      ...(referenceType && { referenceType }),
      ...dateFilter,
    };

    // Fetch cash movements if requested
    const shouldFetchCash = !accountType || accountType === 'CASH';
    const shouldFetchBank = !accountType || accountType === 'BANK';

    const cashWhere = applyViewMode(
      {
        ...baseWhere,
        ...(cashAccountId && { cashAccountId: parseInt(cashAccountId) }),
      },
      viewMode
    );

    const bankWhere = applyViewMode(
      {
        ...baseWhere,
        ...(bankAccountId && { bankAccountId: parseInt(bankAccountId) }),
      },
      viewMode
    );

    // Fetch movements from both tables
    const [cashMovements, bankMovements] = await Promise.all([
      shouldFetchCash
        ? prisma.cashMovement.findMany({
            where: cashWhere,
            include: {
              cashAccount: { select: { id: true, nombre: true } },
            },
            orderBy: [{ fecha: 'desc' }, { createdAt: 'desc' }],
          })
        : [],
      shouldFetchBank
        ? prisma.bankMovement.findMany({
            where: bankWhere,
            include: {
              bankAccount: { select: { id: true, nombre: true, banco: true } },
              cheque: {
                select: { id: true, numero: true, banco: true, monto: true },
              },
            },
            orderBy: [{ fecha: 'desc' }, { createdAt: 'desc' }],
          })
        : [],
    ]);

    // Transform and combine movements
    const movements = [
      ...cashMovements.map((m) => ({
        id: `cash-${m.id}`,
        movementId: m.id,
        accountType: 'CASH' as const,
        fecha: m.fecha,
        tipo: m.tipo,
        monto: m.tipo === 'INGRESO' ? m.ingreso : m.egreso,
        descripcion: m.descripcion,
        referenceType: m.referenceType,
        referenceId: m.referenceId,
        numeroComprobante: m.numeroComprobante,
        saldoAnterior: m.saldoAnterior,
        saldoPosterior: m.saldoPosterior,
        account: m.cashAccount,
        createdAt: m.createdAt,
      })),
      ...bankMovements.map((m) => ({
        id: `bank-${m.id}`,
        movementId: m.id,
        accountType: 'BANK' as const,
        fecha: m.fecha,
        fechaValor: m.fechaValor,
        tipo: m.tipo,
        monto: m.tipo === 'INGRESO' ? m.ingreso : m.egreso,
        descripcion: m.descripcion,
        referenceType: m.referenceType,
        referenceId: m.referenceId,
        numeroComprobante: m.numeroComprobante,
        saldoAnterior: m.saldoAnterior,
        saldoPosterior: m.saldoPosterior,
        account: m.bankAccount,
        cheque: m.cheque,
        createdAt: m.createdAt,
      })),
    ].sort((a, b) => {
      // Sort by fecha desc, then createdAt desc
      const fechaDiff = b.fecha.getTime() - a.fecha.getTime();
      if (fechaDiff !== 0) return fechaDiff;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });

    // Apply pagination
    const total = movements.length;
    const paginatedMovements = movements.slice(offset, offset + limit);

    // Calculate totals
    const ingresos = movements
      .filter((m) => m.tipo === 'INGRESO')
      .reduce((sum, m) => sum + Number(m.monto), 0);
    const egresos = movements
      .filter((m) => m.tipo === 'EGRESO')
      .reduce((sum, m) => sum + Number(m.monto), 0);

    return NextResponse.json({
      data: paginatedMovements,
      pagination: { total, limit, offset },
      summary: {
        ingresos,
        egresos,
        neto: ingresos - egresos,
      },
    });
  } catch (error) {
    console.error('Error fetching movements:', error);
    return NextResponse.json(
      { error: 'Error al obtener movimientos' },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// POST - Create manual treasury movement
// ═══════════════════════════════════════════════════════════════════════════════

export async function POST(req: NextRequest) {
  try {
    const { user, error } = await requirePermission(TESORERIA_PERMISSIONS.MOVIMIENTOS_CREATE);
    if (error) return error;

    const companyId = user!.companyId;

    // Get idempotency key
    const idempotencyKey = getIdempotencyKey(req);

    const body = await req.json();

    // Validate with Zod schema
    const validation = createTreasuryMovementSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Datos de entrada inválidos' },
        { status: 400 }
      );
    }

    const data = validation.data;

    // Execute with idempotency support
    const idempotencyResult = await withIdempotency(
      idempotencyKey,
      companyId,
      'CREATE_TREASURY_MOVEMENT',
      async () => {
        let movement;

        // Create movement based on account type
        if (data.accountType === 'CASH') {
          if (!data.cashAccountId) {
            throw new Error('cashAccountId is required for CASH movements');
          }

          movement = await createCashMovement({
            cashAccountId: data.cashAccountId,
            fecha: new Date(data.fecha),
            tipo: data.tipo as 'INGRESO' | 'EGRESO',
            monto: data.monto,
            descripcion: data.descripcion || `Movimiento de caja ${data.tipo.toLowerCase()}`,
            referenceType: data.referenceType,
            referenceId: data.referenceId,
            numeroComprobante: data.numeroComprobante ?? undefined,
            comprobanteUrl: data.comprobanteUrl ?? undefined,
            docType: data.docType,
            companyId,
            createdBy: user!.id,
          });
        } else if (data.accountType === 'BANK') {
          if (!data.bankAccountId) {
            throw new Error('bankAccountId is required for BANK movements');
          }

          movement = await createBankMovement({
            bankAccountId: data.bankAccountId,
            fecha: new Date(data.fecha),
            fechaValor: data.fechaValor ? new Date(data.fechaValor) : undefined,
            tipo: data.tipo as 'INGRESO' | 'EGRESO',
            monto: data.monto,
            descripcion: data.descripcion || `Movimiento bancario ${data.tipo.toLowerCase()}`,
            referenceType: data.referenceType,
            referenceId: data.referenceId,
            numeroComprobante: data.numeroComprobante ?? undefined,
            comprobanteUrl: data.comprobanteUrl ?? undefined,
            chequeId: data.chequeId ?? undefined,
            docType: data.docType,
            companyId,
            createdBy: user!.id,
          });
        } else {
          throw new Error('Invalid accountType. Must be CASH or BANK.');
        }

        return {
          id: movement.id,
          accountType: data.accountType,
          tipo: movement.tipo,
          monto: movement.monto,
          saldoPosterior: movement.saldoPosterior,
          message: 'Movimiento creado exitosamente',
        };
      },
      {
        entityType: data.accountType === 'CASH' ? 'CashMovement' : 'BankMovement',
        getEntityId: (result) => result.id,
      }
    );

    return NextResponse.json(idempotencyResult.response, {
      status: idempotencyResult.isReplay ? 200 : 201,
      headers: idempotencyHeaders(idempotencyResult.idempotencyKey, idempotencyResult.isReplay),
    });
  } catch (error) {
    console.error('Error al crear movimiento de tesorería:', error);

    // Handle idempotency conflict error
    const idempotencyError = handleIdempotencyError(error);
    if (idempotencyError) return idempotencyError;

    return NextResponse.json(
      { error: 'Error al crear movimiento' },
      { status: 500 }
    );
  }
}
