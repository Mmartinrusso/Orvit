/**
 * Bank Reconciliation API - O2C Phase 4
 *
 * Handles bank statement management and reconciliation.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getViewMode, applyViewMode } from '@/lib/view-mode';
import { requirePermission, TESORERIA_PERMISSIONS } from '@/lib/tesoreria/auth';
import { importBankStatementSchema } from '@/lib/tesoreria/validation-schemas';
import {
  getIdempotencyKey,
  withIdempotency,
  handleIdempotencyError,
  idempotencyHeaders,
} from '@/lib/tesoreria/idempotency-helper';

export const dynamic = 'force-dynamic';

// ═══════════════════════════════════════════════════════════════════════════════
// GET - List bank statements or get specific statement
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET(req: NextRequest) {
  try {
    const { user, error } = await requirePermission(TESORERIA_PERMISSIONS.CONCILIACION_VIEW);
    if (error) return error;

    const companyId = user!.companyId;

    const { searchParams } = new URL(req.url);
    const bankAccountId = searchParams.get('bankAccountId');
    const statementId = searchParams.get('id');
    const estado = searchParams.get('estado');
    const periodo = searchParams.get('periodo');
    const viewMode = getViewMode(req);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Get specific statement with items
    if (statementId) {
      const statement = await prisma.bankStatement.findFirst({
        where: applyViewMode(
          { id: parseInt(statementId), companyId },
          viewMode
        ),
        include: {
          bankAccount: {
            select: { id: true, nombre: true, banco: true, numeroCuenta: true },
          },
          items: {
            orderBy: { lineNumber: 'asc' },
            include: {
              treasuryMovement: {
                select: {
                  id: true,
                  fecha: true,
                  tipo: true,
                  medio: true,
                  monto: true,
                  descripcion: true,
                  referenceType: true,
                },
              },
            },
          },
        },
      });

      if (!statement) {
        return NextResponse.json({ error: 'Statement not found' }, { status: 404 });
      }

      return NextResponse.json(statement);
    }

    // List statements
    const where = applyViewMode(
      {
        companyId,
        ...(bankAccountId && { bankAccountId: parseInt(bankAccountId) }),
        ...(estado && { estado: estado as 'PENDIENTE' | 'EN_PROCESO' | 'COMPLETADA' | 'CON_DIFERENCIAS' | 'CERRADA' }),
        ...(periodo && { periodo }),
      },
      viewMode
    );

    const [statements, total] = await Promise.all([
      prisma.bankStatement.findMany({
        where,
        include: {
          bankAccount: {
            select: { id: true, nombre: true, banco: true },
          },
          _count: { select: { items: true } },
        },
        orderBy: [{ periodo: 'desc' }, { createdAt: 'desc' }],
        take: limit,
        skip: offset,
      }),
      prisma.bankStatement.count({ where }),
    ]);

    return NextResponse.json({
      data: statements,
      pagination: { total, limit, offset },
    });
  } catch (error) {
    console.error('Error fetching bank statements:', error);
    return NextResponse.json(
      { error: 'Error al obtener extractos bancarios' },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// POST - Import bank statement from CSV/Excel
// ═══════════════════════════════════════════════════════════════════════════════

export async function POST(req: NextRequest) {
  try {
    const { user, error } = await requirePermission(TESORERIA_PERMISSIONS.CONCILIACION_IMPORT);
    if (error) return error;

    const companyId = user!.companyId;

    // Get idempotency key
    const idempotencyKey = getIdempotencyKey(req);

    const body = await req.json();

    // Validate with Zod schema
    const validation = importBankStatementSchema.safeParse(body);
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
      'IMPORT_BANK_STATEMENT',
      async () => {
        // Get bank account and verify it belongs to user's company
        const bankAccount = await prisma.bankAccount.findUnique({
          where: { id: data.bankAccountId },
          select: { id: true, companyId: true },
        });

        if (!bankAccount) {
          throw new Error('BANK_ACCOUNT_NOT_FOUND');
        }

        if (bankAccount.companyId !== companyId) {
          throw new Error('BANK_ACCOUNT_NOT_IN_COMPANY');
        }

        // Check for existing statement in same period
        const existing = await prisma.bankStatement.findFirst({
          where: { bankAccountId: data.bankAccountId, periodo: data.periodo },
        });

        if (existing) {
          throw new Error('STATEMENT_EXISTS');
        }

        // Calculate totals
        const totalDebitos = data.items.reduce((sum, item) => sum + (item.debito || 0), 0);
        const totalCreditos = data.items.reduce((sum, item) => sum + (item.credito || 0), 0);

        // Create statement with items in transaction
        const statement = await prisma.$transaction(async (tx) => {
          const stmt = await tx.bankStatement.create({
            data: {
              bankAccountId: data.bankAccountId,
              periodo: data.periodo,
              saldoInicial: data.saldoInicial,
              totalDebitos,
              totalCreditos,
              saldoFinal: data.saldoFinal,
              totalItems: data.items.length,
              itemsPendientes: data.items.length,
              toleranciaMonto: data.toleranciaMonto,
              toleranciaDias: data.toleranciaDias,
              docType: data.docType,
              companyId,
              createdBy: user!.id,
            },
          });

          // Create items
          await tx.bankStatementItem.createMany({
            data: data.items.map((item) => ({
              statementId: stmt.id,
              lineNumber: item.lineNumber,
              fecha: new Date(item.fecha),
              fechaValor: item.fechaValor ? new Date(item.fechaValor) : null,
              descripcion: item.descripcion,
              referencia: item.referencia || null,
              debito: item.debito || 0,
              credito: item.credito || 0,
              saldo: item.saldo,
            })),
          });

          return stmt;
        });

        return {
          id: statement.id,
          periodo: statement.periodo,
          totalItems: statement.totalItems,
          message: 'Extracto importado exitosamente',
        };
      },
      {
        entityType: 'BankStatement',
        getEntityId: (result) => result.id,
      }
    );

    return NextResponse.json(idempotencyResult.response, {
      status: idempotencyResult.isReplay ? 200 : 201,
      headers: idempotencyHeaders(idempotencyResult.idempotencyKey, idempotencyResult.isReplay),
    });
  } catch (error) {
    console.error('Error importing bank statement:', error);

    // Handle idempotency conflict error
    const idempotencyError = handleIdempotencyError(error);
    if (idempotencyError) return idempotencyError;

    // Handle custom errors
    if (error instanceof Error) {
      if (error.message === 'BANK_ACCOUNT_NOT_FOUND') {
        return NextResponse.json(
          { error: 'Cuenta bancaria no encontrada' },
          { status: 404 }
        );
      }
      if (error.message === 'BANK_ACCOUNT_NOT_IN_COMPANY') {
        return NextResponse.json(
          { error: 'La cuenta bancaria no pertenece a su empresa' },
          { status: 403 }
        );
      }
      if (error.message === 'STATEMENT_EXISTS') {
        return NextResponse.json(
          { error: 'Ya existe un extracto para este período' },
          { status: 409 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Error al importar extracto bancario' },
      { status: 500 }
    );
  }
}
