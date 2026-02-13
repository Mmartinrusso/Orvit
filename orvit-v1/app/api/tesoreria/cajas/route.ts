import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getViewMode } from '@/lib/view-mode';
import { requirePermission, TESORERIA_PERMISSIONS } from '@/lib/tesoreria/auth';
import { createCashAccountSchema } from '@/lib/tesoreria/validation-schemas';
import {
  getIdempotencyKey,
  withIdempotency,
  handleIdempotencyError,
  idempotencyHeaders,
} from '@/lib/tesoreria/idempotency-helper';

export const dynamic = 'force-dynamic';

// Calcular saldo de caja según modo
async function getCashBalance(cashAccountId: number, mode: 'S' | 'E'): Promise<{ saldoT1: number; saldoTotal: number }> {
  // Saldo T1 (siempre)
  const t1Result = await prisma.cashMovement.aggregate({
    where: { cashAccountId, docType: 'T1' },
    _sum: { ingreso: true, egreso: true }
  });

  const saldoT1 = Number(t1Result._sum.ingreso || 0) - Number(t1Result._sum.egreso || 0);

  // Saldo total (solo si modo E)
  if (mode === 'E') {
    const totalResult = await prisma.cashMovement.aggregate({
      where: { cashAccountId },
      _sum: { ingreso: true, egreso: true }
    });
    const saldoTotal = Number(totalResult._sum.ingreso || 0) - Number(totalResult._sum.egreso || 0);
    return { saldoT1, saldoTotal };
  }

  return { saldoT1, saldoTotal: saldoT1 };
}

// GET /api/tesoreria/cajas - Listar cajas con saldos
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requirePermission(TESORERIA_PERMISSIONS.CAJAS_VIEW);
    if (error) return error;

    const companyId = user!.companyId;

    const { searchParams } = new URL(request.url);
    const soloActivas = searchParams.get('soloActivas') !== 'false';
    const moneda = searchParams.get('moneda');

    const viewMode = getViewMode(request);

    const where: any = { companyId };
    if (soloActivas) {
      where.isActive = true;
    }
    if (moneda) {
      where.moneda = moneda;
    }

    const cajas = await prisma.cashAccount.findMany({
      where,
      orderBy: [
        { esDefault: 'desc' },
        { nombre: 'asc' }
      ],
      include: {
        _count: {
          select: { movements: true }
        }
      }
    });

    // Calcular saldos para cada caja
    const cajasConSaldo = await Promise.all(
      cajas.map(async (caja) => {
        const { saldoT1, saldoTotal } = await getCashBalance(caja.id, viewMode);
        return {
          ...caja,
          saldoT1,
          saldoTotal: viewMode === 'E' ? saldoTotal : null,
          diferencia: viewMode === 'E' ? saldoTotal - saldoT1 : null,
        };
      })
    );

    return NextResponse.json({
      data: cajasConSaldo,
      _m: viewMode
    });
  } catch (error) {
    console.error('Error fetching cajas:', error);
    return NextResponse.json(
      { error: 'Error al obtener las cajas' },
      { status: 500 }
    );
  }
}

// POST /api/tesoreria/cajas - Crear nueva caja
export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requirePermission(TESORERIA_PERMISSIONS.CAJAS_CREATE);
    if (error) return error;

    const companyId = user!.companyId;

    // Get idempotency key
    const idempotencyKey = getIdempotencyKey(request);

    const body = await request.json();

    // Validate with Zod schema
    const validation = createCashAccountSchema.safeParse(body);
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
      'CREATE_CASH_ACCOUNT',
      async () => {
        // Verificar código único
        const existente = await prisma.cashAccount.findFirst({
          where: { companyId, codigo: data.codigo }
        });

        if (existente) {
          throw new Error('DUPLICATE_CODE');
        }

        // Si es default, quitar default de las otras
        if (data.esDefault) {
          await prisma.cashAccount.updateMany({
            where: { companyId, moneda: data.moneda, esDefault: true },
            data: { esDefault: false }
          });
        }

        const nuevaCaja = await prisma.cashAccount.create({
          data: {
            companyId,
            codigo: data.codigo,
            nombre: data.nombre,
            moneda: data.moneda,
            esDefault: data.esDefault,
            saldoActual: 0,
            createdBy: user!.id
          }
        });

        return nuevaCaja;
      },
      {
        entityType: 'CashAccount',
        getEntityId: (result) => result.id,
      }
    );

    return NextResponse.json(idempotencyResult.response, {
      status: idempotencyResult.isReplay ? 200 : 201,
      headers: idempotencyHeaders(idempotencyResult.idempotencyKey, idempotencyResult.isReplay),
    });
  } catch (error) {
    console.error('Error creating caja:', error);

    // Handle idempotency conflict error
    const idempotencyError = handleIdempotencyError(error);
    if (idempotencyError) return idempotencyError;

    // Handle custom errors
    if (error instanceof Error) {
      if (error.message === 'DUPLICATE_CODE') {
        return NextResponse.json(
          { error: 'Ya existe una caja con ese código' },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Error al crear la caja' },
      { status: 500 }
    );
  }
}
