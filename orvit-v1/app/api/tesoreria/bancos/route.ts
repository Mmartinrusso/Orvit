import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, TESORERIA_PERMISSIONS } from '@/lib/tesoreria/auth';
import { createBankAccountSchema } from '@/lib/tesoreria/validation-schemas';
import {
  getIdempotencyKey,
  withIdempotency,
  handleIdempotencyError,
  idempotencyHeaders,
} from '@/lib/tesoreria/idempotency-helper';

export const dynamic = 'force-dynamic';

// Calcular saldo de banco (siempre T1 - no hay T2 en bancos)
async function getBankBalance(bankAccountId: number): Promise<number> {
  const result = await prisma.bankMovement.aggregate({
    where: { bankAccountId },
    _sum: { ingreso: true, egreso: true }
  });

  return Number(result._sum.ingreso || 0) - Number(result._sum.egreso || 0);
}

// GET /api/tesoreria/bancos - Listar cuentas bancarias con saldos
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requirePermission(TESORERIA_PERMISSIONS.BANCOS_VIEW);
    if (error) return error;

    const companyId = user!.companyId;

    const { searchParams } = new URL(request.url);
    const soloActivas = searchParams.get('soloActivas') !== 'false';
    const moneda = searchParams.get('moneda');

    const where: any = { companyId };
    if (soloActivas) {
      where.isActive = true;
    }
    if (moneda) {
      where.moneda = moneda;
    }

    const bancos = await prisma.bankAccount.findMany({
      where,
      orderBy: [
        { esDefault: 'desc' },
        { nombre: 'asc' }
      ],
      include: {
        _count: {
          select: {
            movements: true,
            cheques: true
          }
        }
      }
    });

    // Calcular saldos para cada banco
    const bancosConSaldo = await Promise.all(
      bancos.map(async (banco) => {
        const saldoCalculado = await getBankBalance(banco.id);
        return {
          ...banco,
          saldoCalculado,
          diferenciaConciliacion: Number(banco.saldoBancario) - saldoCalculado,
        };
      })
    );

    return NextResponse.json({ data: bancosConSaldo });
  } catch (error) {
    console.error('Error fetching bancos:', error);
    return NextResponse.json(
      { error: 'Error al obtener las cuentas bancarias' },
      { status: 500 }
    );
  }
}

// POST /api/tesoreria/bancos - Crear nueva cuenta bancaria
export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requirePermission(TESORERIA_PERMISSIONS.BANCOS_CREATE);
    if (error) return error;

    const companyId = user!.companyId;

    // Get idempotency key
    const idempotencyKey = getIdempotencyKey(request);

    const body = await request.json();

    // Validate with Zod schema
    const validation = createBankAccountSchema.safeParse(body);
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
      'CREATE_BANK_ACCOUNT',
      async () => {
        // Verificar código único
        const existenteCodigo = await prisma.bankAccount.findFirst({
          where: { companyId, codigo: data.codigo }
        });

        if (existenteCodigo) {
          throw new Error('DUPLICATE_CODE');
        }

        // Verificar CBU único si se provee
        if (data.cbu) {
          const existenteCbu = await prisma.bankAccount.findFirst({
            where: { companyId, cbu: data.cbu }
          });

          if (existenteCbu) {
            throw new Error('DUPLICATE_CBU');
          }
        }

        // Si es default, quitar default de las otras
        if (data.esDefault) {
          await prisma.bankAccount.updateMany({
            where: { companyId, moneda: data.moneda, esDefault: true },
            data: { esDefault: false }
          });
        }

        const nuevaCuenta = await prisma.bankAccount.create({
          data: {
            companyId,
            codigo: data.codigo,
            nombre: data.nombre,
            banco: data.banco,
            tipoCuenta: data.tipoCuenta,
            numeroCuenta: data.numeroCuenta,
            cbu: data.cbu || null,
            alias: data.alias || null,
            moneda: data.moneda,
            esDefault: data.esDefault,
            saldoContable: 0,
            saldoBancario: 0,
            createdBy: user!.id
          }
        });

        return nuevaCuenta;
      },
      {
        entityType: 'BankAccount',
        getEntityId: (result) => result.id,
      }
    );

    return NextResponse.json(idempotencyResult.response, {
      status: idempotencyResult.isReplay ? 200 : 201,
      headers: idempotencyHeaders(idempotencyResult.idempotencyKey, idempotencyResult.isReplay),
    });
  } catch (error) {
    console.error('Error creating cuenta bancaria:', error);

    // Handle idempotency conflict error
    const idempotencyError = handleIdempotencyError(error);
    if (idempotencyError) return idempotencyError;

    // Handle custom errors
    if (error instanceof Error) {
      if (error.message === 'DUPLICATE_CODE') {
        return NextResponse.json(
          { error: 'Ya existe una cuenta bancaria con ese código' },
          { status: 400 }
        );
      }
      if (error.message === 'DUPLICATE_CBU') {
        return NextResponse.json(
          { error: 'Ya existe una cuenta bancaria con ese CBU' },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Error al crear la cuenta bancaria' },
      { status: 500 }
    );
  }
}
