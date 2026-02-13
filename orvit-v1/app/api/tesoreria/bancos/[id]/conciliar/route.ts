/**
 * Bank Reconciliation API - POST /api/tesoreria/bancos/[id]/conciliar
 *
 * Concilia movimientos bancarios contra extractos.
 * Acepta lista de movementIds y saldoBancarioReal,
 * marca movimientos como conciliados y actualiza saldo del banco.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, TESORERIA_PERMISSIONS } from '@/lib/tesoreria/auth';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const conciliarSchema = z.object({
  movementIds: z.array(z.number().int().positive()).min(1, 'Debe incluir al menos un movimiento'),
  saldoBancarioReal: z.number(),
  statementId: z.number().int().positive().optional(),
  notas: z.string().max(500).optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { user, error } = await requirePermission(TESORERIA_PERMISSIONS.CONCILIACION_MATCH);
    if (error) return error;

    const companyId = user!.companyId;
    const { id } = await params;
    const bankAccountId = parseInt(id);

    if (!bankAccountId || isNaN(bankAccountId)) {
      return NextResponse.json({ error: 'ID de banco inválido' }, { status: 400 });
    }

    const body = await req.json();
    const validation = conciliarSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { movementIds, saldoBancarioReal, statementId, notas } = validation.data;

    // Verificar que el banco pertenece a la empresa
    const bankAccount = await prisma.bankAccount.findFirst({
      where: { id: bankAccountId, companyId },
    });

    if (!bankAccount) {
      return NextResponse.json(
        { error: 'Cuenta bancaria no encontrada' },
        { status: 404 }
      );
    }

    // Verificar que todos los movimientos existen y pertenecen al banco
    const movements = await prisma.bankMovement.findMany({
      where: {
        id: { in: movementIds },
        bankAccountId,
        companyId,
      },
    });

    if (movements.length !== movementIds.length) {
      const foundIds = movements.map((m) => m.id);
      const missing = movementIds.filter((id) => !foundIds.includes(id));
      return NextResponse.json(
        { error: `Movimientos no encontrados: ${missing.join(', ')}` },
        { status: 404 }
      );
    }

    // Verificar que no estén ya conciliados
    const alreadyConciliados = movements.filter((m) => m.conciliado);
    if (alreadyConciliados.length > 0) {
      return NextResponse.json(
        {
          error: `${alreadyConciliados.length} movimiento(s) ya están conciliados`,
          ids: alreadyConciliados.map((m) => m.id),
        },
        { status: 422 }
      );
    }

    // Ejecutar conciliación en transacción
    const result = await prisma.$transaction(async (tx) => {
      // 1. Marcar movimientos como conciliados
      await tx.bankMovement.updateMany({
        where: { id: { in: movementIds } },
        data: {
          conciliado: true,
          conciliadoAt: new Date(),
          conciliadoBy: user!.id,
        },
      });

      // 2. Actualizar saldo bancario
      const saldoAnterior = bankAccount.saldoBancario;
      await tx.bankAccount.update({
        where: { id: bankAccountId },
        data: {
          saldoBancario: saldoBancarioReal,
        },
      });

      // 3. Calcular diferencia
      const diferencia = Number(saldoBancarioReal) - Number(saldoAnterior);

      // 4. Si hay statementId, actualizar estadísticas del extracto
      if (statementId) {
        await tx.bankStatement.update({
          where: { id: statementId },
          data: {
            itemsConciliados: { increment: movementIds.length },
            itemsPendientes: { decrement: movementIds.length },
            estado: 'EN_PROCESO',
          },
        });
      }

      return {
        conciliados: movementIds.length,
        saldoAnterior: Number(saldoAnterior),
        saldoNuevo: saldoBancarioReal,
        diferencia,
        bankAccountId,
      };
    });

    return NextResponse.json({
      success: true,
      message: `${result.conciliados} movimiento(s) conciliados exitosamente`,
      ...result,
    });
  } catch (error) {
    console.error('Error en conciliación:', error);
    return NextResponse.json(
      { error: 'Error al conciliar movimientos' },
      { status: 500 }
    );
  }
}
