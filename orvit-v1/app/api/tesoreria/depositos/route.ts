/**
 * Cash Deposits API - CORRECTED
 *
 * Handles cash deposits from cash account to bank account.
 * FIXED: Now uses CashMovement/BankMovement instead of TreasuryMovement.
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { createCashDeposit } from '@/lib/tesoreria/movement-service';
import { getViewMode, applyViewMode } from '@/lib/view-mode';
import { requirePermission, TESORERIA_PERMISSIONS } from '@/lib/tesoreria/auth';
import { createCashDepositSchema } from '@/lib/tesoreria/validation-schemas';
import {
  getIdempotencyKey,
  withIdempotency,
  handleIdempotencyError,
  idempotencyHeaders,
} from '@/lib/tesoreria/idempotency-helper';

export const dynamic = 'force-dynamic';

// ═══════════════════════════════════════════════════════════════════════════════
// GET - List cash deposits
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET(req: NextRequest) {
  try {
    const { user, error } = await requirePermission(TESORERIA_PERMISSIONS.DEPOSITOS_VIEW);
    if (error) return error;

    const companyId = user!.companyId;

    const { searchParams } = new URL(req.url);
    const cashAccountId = searchParams.get('cashAccountId');
    const bankAccountId = searchParams.get('bankAccountId');
    const estado = searchParams.get('estado');
    const fechaDesde = searchParams.get('fechaDesde');
    const fechaHasta = searchParams.get('fechaHasta');
    const viewMode = getViewMode(req);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const where = applyViewMode(
      {
        companyId,
        ...(cashAccountId && { cashAccountId: parseInt(cashAccountId) }),
        ...(bankAccountId && { bankAccountId: parseInt(bankAccountId) }),
        ...(estado && { estado: estado as any }),
        ...(fechaDesde &&
          fechaHasta && {
            fecha: {
              gte: new Date(fechaDesde),
              lte: new Date(fechaHasta),
            },
          }),
      },
      viewMode
    );

    const [deposits, total] = await Promise.all([
      prisma.cashDeposit.findMany({
        where,
        include: {
          cashAccount: { select: { id: true, nombre: true } },
          bankAccount: { select: { id: true, nombre: true, banco: true } },
        },
        orderBy: { fecha: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.cashDeposit.count({ where }),
    ]);

    return NextResponse.json({
      data: deposits,
      pagination: { total, limit, offset },
      _m: viewMode,
    });
  } catch (error) {
    console.error('Error fetching deposits:', error);
    return NextResponse.json(
      { error: 'Error al obtener depósitos' },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// POST - Create cash deposit
// ═══════════════════════════════════════════════════════════════════════════════

export async function POST(req: NextRequest) {
  try {
    const { user, error } = await requirePermission(TESORERIA_PERMISSIONS.DEPOSITOS_CREATE);
    if (error) return error;

    const companyId = user!.companyId;

    // Get idempotency key
    const idempotencyKey = getIdempotencyKey(req);

    const body = await req.json();

    // Validate with Zod schema
    const validation = createCashDepositSchema.safeParse(body);
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
      'CREATE_DEPOSIT',
      async () => {
        // Get accounts to verify they belong to the same company
        const [cashAccount, bankAccount] = await Promise.all([
          prisma.cashAccount.findUnique({
            where: { id: data.cashAccountId },
            select: { id: true, companyId: true },
          }),
          prisma.bankAccount.findUnique({
            where: { id: data.bankAccountId },
            select: { id: true, companyId: true },
          }),
        ]);

        if (!cashAccount || !bankAccount) {
          throw new Error('ACCOUNT_NOT_FOUND');
        }

        // Verify accounts belong to user's company
        if (cashAccount.companyId !== companyId || bankAccount.companyId !== companyId) {
          throw new Error('ACCOUNT_NOT_IN_COMPANY');
        }

        // Create deposit using service
        const deposit = await createCashDeposit({
          cashAccountId: data.cashAccountId,
          bankAccountId: data.bankAccountId,
          fecha: new Date(data.fecha),
          efectivo: data.efectivo ?? 0,
          chequeIds: data.chequeIds ?? [],
          numeroComprobante: data.numeroComprobante,
          comprobanteUrl: data.comprobanteUrl,
          docType: data.docType,
          companyId,
          userId: user!.id,
        });

        return {
          id: deposit.id,
          numero: deposit.numero,
          total: deposit.total,
          message: 'Depósito creado exitosamente',
        };
      },
      {
        entityType: 'CashDeposit',
        getEntityId: (result) => result.id,
      }
    );

    return NextResponse.json(idempotencyResult.response, {
      status: idempotencyResult.isReplay ? 200 : 201,
      headers: idempotencyHeaders(idempotencyResult.idempotencyKey, idempotencyResult.isReplay),
    });
  } catch (error) {
    console.error('Error creating deposit:', error);

    // Handle idempotency conflict error
    const idempotencyError = handleIdempotencyError(error);
    if (idempotencyError) return idempotencyError;

    // Handle custom errors
    if (error instanceof Error) {
      if (error.message === 'ACCOUNT_NOT_FOUND') {
        return NextResponse.json(
          { error: 'Cuenta de caja o banco no encontrada' },
          { status: 404 }
        );
      }
      if (error.message === 'ACCOUNT_NOT_IN_COMPANY') {
        return NextResponse.json(
          { error: 'Las cuentas no pertenecen a su empresa' },
          { status: 403 }
        );
      }
    }

    const message = error instanceof Error ? error.message : 'Error al crear depósito';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
