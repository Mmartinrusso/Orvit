/**
 * Reconciliation Report API - GET /api/tesoreria/conciliacion/reporte/[id]
 *
 * Genera reporte PDF de conciliación bancaria.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, TESORERIA_PERMISSIONS } from '@/lib/tesoreria/auth';
import { getReconciliationSummary } from '@/lib/tesoreria/reconciliation-matcher';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { user, error } = await requirePermission(TESORERIA_PERMISSIONS.CONCILIACION_VIEW);
    if (error) return error;

    const companyId = user!.companyId;
    const { id } = await params;
    const statementId = parseInt(id);

    if (!statementId || isNaN(statementId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    // Obtener extracto completo con items y relaciones
    const statement = await prisma.bankStatement.findFirst({
      where: { id: statementId, companyId },
      include: {
        bankAccount: {
          select: {
            nombre: true,
            banco: true,
            numeroCuenta: true,
            cbu: true,
            saldoContable: true,
            saldoBancario: true,
          },
        },
        items: {
          orderBy: { lineNumber: 'asc' },
          include: {
            treasuryMovement: {
              select: {
                id: true,
                fecha: true,
                tipo: true,
                monto: true,
                descripcion: true,
              },
            },
          },
        },
        cerradoPorUser: {
          select: { name: true, email: true },
        },
        company: {
          select: { name: true },
        },
      },
    });

    if (!statement) {
      return NextResponse.json(
        { error: 'Extracto no encontrado' },
        { status: 404 }
      );
    }

    // Obtener resumen
    const summary = await getReconciliationSummary(statementId);

    // Construir datos para PDF (se genera en el cliente)
    const reportData = {
      banco: {
        nombre: statement.bankAccount.nombre,
        banco: statement.bankAccount.banco,
        numeroCuenta: statement.bankAccount.numeroCuenta,
        cbu: statement.bankAccount.cbu || undefined,
      },
      company: {
        name: statement.company.name,
      },
      periodo: statement.periodo,
      estado: statement.estado,
      saldoInicial: Number(statement.saldoInicial),
      saldoFinal: Number(statement.saldoFinal),
      saldoContable: Number(statement.bankAccount.saldoContable),
      saldoBancario: Number(statement.bankAccount.saldoBancario),
      totalDebitos: Number(statement.totalDebitos),
      totalCreditos: Number(statement.totalCreditos),
      totalItems: statement.totalItems,
      itemsConciliados: statement.itemsConciliados,
      itemsPendientes: statement.itemsPendientes,
      itemsSuspense: statement.itemsSuspense,
      matchBreakdown: summary.matchBreakdown,
      itemsConciliadosList: statement.items
        .filter((item) => item.conciliado)
        .map((item) => ({
          fecha: item.fecha.toISOString(),
          descripcion: item.descripcion,
          referencia: item.referencia,
          debito: Number(item.debito),
          credito: Number(item.credito),
          matchType: item.matchType,
          matchConfidence: item.matchConfidence,
          conciliado: item.conciliado,
          esSuspense: item.esSuspense,
          suspenseResuelto: item.suspenseResuelto,
          suspenseNotas: item.suspenseNotas,
          movimientoSistema: item.treasuryMovement
            ? {
                fecha: item.treasuryMovement.fecha.toISOString(),
                tipo: item.treasuryMovement.tipo,
                monto: Number(item.treasuryMovement.monto),
                descripcion: item.treasuryMovement.descripcion,
              }
            : null,
        })),
      itemsPendientesList: statement.items
        .filter((item) => !item.conciliado)
        .map((item) => ({
          fecha: item.fecha.toISOString(),
          descripcion: item.descripcion,
          referencia: item.referencia,
          debito: Number(item.debito),
          credito: Number(item.credito),
          matchType: item.matchType,
          matchConfidence: item.matchConfidence,
          conciliado: item.conciliado,
          esSuspense: item.esSuspense,
          suspenseResuelto: item.suspenseResuelto,
          suspenseNotas: item.suspenseNotas,
          movimientoSistema: null,
        })),
      diferencias: Array.isArray(statement.diferenciasJustificadas)
        ? statement.diferenciasJustificadas as Array<{ monto: number; concepto: string; justificacion: string }>
        : [],
      cerradoAt: statement.cerradoAt?.toISOString(),
      cerradoPor: statement.cerradoPorUser?.name || statement.cerradoPorUser?.email,
      notasCierre: statement.notasCierre || undefined,
    };

    return NextResponse.json(reportData);
  } catch (error) {
    console.error('Error generating reconciliation report:', error);
    return NextResponse.json(
      { error: 'Error al generar reporte de conciliación' },
      { status: 500 }
    );
  }
}
