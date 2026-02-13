/**
 * Cierre de Conciliación API - POST /api/tesoreria/conciliacion/cierre
 *
 * Cierra una conciliación bancaria con justificación de diferencias
 * y opcionalmente genera asiento contable de ajuste.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { BankStatementStatus, Prisma } from '@prisma/client';
import { requirePermission, TESORERIA_PERMISSIONS } from '@/lib/tesoreria/auth';
import { getReconciliationSummary } from '@/lib/tesoreria/reconciliation-matcher';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const diferenciasItemSchema = z.object({
  monto: z.number(),
  concepto: z.string().max(200),
  justificacion: z.string().min(1, 'Justificación requerida').max(500),
});

const cierreSchema = z.object({
  statementId: z.number().int().positive('ID de extracto requerido'),
  justificacionDiferencias: z.array(diferenciasItemSchema).optional().default([]),
  notasCierre: z.string().max(1000).optional(),
  forzarCierre: z.boolean().optional().default(false),
  generarAjuste: z.boolean().optional().default(false),
  saldoBancarioReal: z.number().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const { user, error } = await requirePermission(TESORERIA_PERMISSIONS.CONCILIACION_CLOSE);
    if (error) return error;

    const companyId = user!.companyId;
    const body = await req.json();

    const validation = cierreSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: validation.error.errors },
        { status: 400 }
      );
    }

    const {
      statementId,
      justificacionDiferencias,
      notasCierre,
      forzarCierre,
      generarAjuste,
      saldoBancarioReal,
    } = validation.data;

    // Verificar extracto
    const statement = await prisma.bankStatement.findFirst({
      where: { id: statementId, companyId },
      include: {
        bankAccount: true,
      },
    });

    if (!statement) {
      return NextResponse.json(
        { error: 'Extracto no encontrado' },
        { status: 404 }
      );
    }

    if (statement.estado === 'CERRADA' || statement.estado === 'COMPLETADA') {
      return NextResponse.json(
        { error: 'Extracto ya está cerrado' },
        { status: 422 }
      );
    }

    // Obtener resumen de conciliación
    const summary = await getReconciliationSummary(statementId);

    // Si hay items pendientes y no se fuerza el cierre, rechazar
    if (summary.pending > 0 && !forzarCierre) {
      return NextResponse.json(
        {
          error: `Hay ${summary.pending} item(s) pendientes de conciliar. Use forzarCierre: true para cerrar con diferencias.`,
          summary,
        },
        { status: 422 }
      );
    }

    // Si hay items pendientes, necesitamos justificación
    if (summary.pending > 0 && justificacionDiferencias.length === 0) {
      return NextResponse.json(
        {
          error: 'Debe justificar las diferencias para cerrar con items pendientes',
          pendientes: summary.pending,
          suspense: summary.suspense,
        },
        { status: 422 }
      );
    }

    // Ejecutar cierre en transacción
    const result = await prisma.$transaction(async (tx) => {
      const nuevoEstado: BankStatementStatus = summary.pending === 0 ? 'COMPLETADA' : 'CON_DIFERENCIAS';

      // 1. Actualizar extracto
      const updatedStatement = await tx.bankStatement.update({
        where: { id: statementId },
        data: {
          estado: nuevoEstado,
          cerradoAt: new Date(),
          cerradoPor: user!.id,
          notasCierre: notasCierre || null,
          diferenciasJustificadas: justificacionDiferencias.length > 0
            ? justificacionDiferencias
            : Prisma.DbNull,
        },
      });

      // 2. Actualizar saldo bancario si se proporciona
      if (saldoBancarioReal !== undefined) {
        await tx.bankAccount.update({
          where: { id: statement.bankAccountId },
          data: {
            saldoBancario: saldoBancarioReal,
          },
        });
      }

      // 3. Si se pide generar ajuste contable para las diferencias
      let ajusteMovementId: number | null = null;
      if (generarAjuste && summary.pending > 0) {
        const totalDiferencias = justificacionDiferencias.reduce(
          (sum, d) => sum + d.monto,
          0
        );

        if (totalDiferencias !== 0) {
          const movement = await tx.treasuryMovement.create({
            data: {
              companyId,
              bankAccountId: statement.bankAccountId,
              fecha: new Date(),
              tipo: totalDiferencias > 0 ? 'INGRESO' : 'EGRESO',
              medio: 'AJUSTE',
              monto: Math.abs(totalDiferencias),
              accountType: 'BANK',
              referenceType: 'AJUSTE_CONCILIACION',
              descripcion: `Ajuste conciliación ${statement.periodo}: ${notasCierre || 'Diferencias justificadas'}`,
              conciliado: true,
              conciliadoAt: new Date(),
              conciliadoBy: user!.id,
              docType: statement.docType,
              createdBy: user!.id,
            },
          });
          ajusteMovementId = movement.id;

          // Actualizar saldo contable del banco
          await tx.bankAccount.update({
            where: { id: statement.bankAccountId },
            data: {
              saldoContable: {
                increment: totalDiferencias,
              },
            },
          });
        }
      }

      return {
        statementId: updatedStatement.id,
        estado: nuevoEstado,
        ajusteMovementId,
      };
    });

    return NextResponse.json({
      success: true,
      message: result.estado === 'COMPLETADA'
        ? 'Conciliación completada exitosamente'
        : 'Conciliación cerrada con diferencias justificadas',
      ...result,
      summary,
    });
  } catch (error) {
    console.error('Error en cierre de conciliación:', error);
    return NextResponse.json(
      { error: 'Error al cerrar conciliación' },
      { status: 500 }
    );
  }
}
