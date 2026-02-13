/**
 * Bank Statement Detail API - O2C Phase 4
 *
 * Get statement details, close reconciliation, get unmatched movements.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  getReconciliationSummary,
  getUnmatchedMovements,
} from '@/lib/tesoreria/reconciliation-matcher';
import { getViewMode } from '@/lib/view-mode';
import { requirePermission, TESORERIA_PERMISSIONS } from '@/lib/tesoreria/auth';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// GET - Get statement summary and unmatched movements
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { user, error } = await requirePermission(TESORERIA_PERMISSIONS.CONCILIACION_VIEW);
    if (error) return error;

    const companyId = user!.companyId;

    const { id } = await params;
    const statementId = parseInt(id);
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');
    const viewMode = getViewMode(req);

    if (!statementId) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const statement = await prisma.bankStatement.findFirst({
      where: { id: statementId, companyId },
      select: {
        id: true,
        bankAccountId: true,
        periodo: true,
        estado: true,
        companyId: true,
        docType: true,
      },
    });

    if (!statement) {
      return NextResponse.json(
        { error: 'Extracto no encontrado' },
        { status: 404 }
      );
    }

    // Get reconciliation summary
    if (action === 'summary') {
      const summary = await getReconciliationSummary(statementId);
      return NextResponse.json(summary);
    }

    // Get unmatched treasury movements for manual matching
    if (action === 'unmatched-movements') {
      const fechaDesde = searchParams.get('fechaDesde');
      const fechaHasta = searchParams.get('fechaHasta');
      const tipo = searchParams.get('tipo') as 'INGRESO' | 'EGRESO' | undefined;
      const montoMin = searchParams.get('montoMin');
      const montoMax = searchParams.get('montoMax');

      const movements = await getUnmatchedMovements(statement.bankAccountId, {
        fechaDesde: fechaDesde ? new Date(fechaDesde) : undefined,
        fechaHasta: fechaHasta ? new Date(fechaHasta) : undefined,
        tipo,
        montoMin: montoMin ? parseFloat(montoMin) : undefined,
        montoMax: montoMax ? parseFloat(montoMax) : undefined,
        companyId,
      });

      return NextResponse.json(movements);
    }

    // Default: return full statement with items
    const fullStatement = await prisma.bankStatement.findUnique({
      where: { id: statementId },
      include: {
        bankAccount: {
          select: { id: true, nombre: true, banco: true, numeroCuenta: true, saldoContable: true, saldoBancario: true },
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

    const summary = await getReconciliationSummary(statementId);

    return NextResponse.json({
      statement: fullStatement,
      summary,
    });
  } catch (error) {
    console.error('Error fetching statement:', error);
    return NextResponse.json(
      { error: 'Error al obtener extracto' },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PATCH - Update statement (close reconciliation, update tolerances)
// ═══════════════════════════════════════════════════════════════════════════════

interface UpdateStatementRequest {
  action: 'close' | 'reopen' | 'updateTolerances';
  toleranciaMonto?: number;
  toleranciaDias?: number;
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { user, error } = await requirePermission(TESORERIA_PERMISSIONS.CONCILIACION_CLOSE);
    if (error) return error;

    const companyId = user!.companyId;

    const { id } = await params;
    const statementId = parseInt(id);
    const body: UpdateStatementRequest = await req.json();

    if (!statementId) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const statement = await prisma.bankStatement.findFirst({
      where: { id: statementId, companyId },
      select: { id: true, estado: true, companyId: true },
    });

    if (!statement) {
      return NextResponse.json(
        { error: 'Extracto no encontrado' },
        { status: 404 }
      );
    }

    switch (body.action) {
      case 'close': {
        if (statement.estado === 'CERRADA') {
          return NextResponse.json(
            { error: 'Extracto ya está cerrado' },
            { status: 422 }
          );
        }

        // Get summary to check if there are pending items
        const summary = await getReconciliationSummary(statementId);

        await prisma.bankStatement.update({
          where: { id: statementId },
          data: {
            estado: summary.pending === 0 ? 'COMPLETADA' : 'CON_DIFERENCIAS',
            cerradoAt: new Date(),
            cerradoPor: user!.id,
          },
        });

        return NextResponse.json({
          success: true,
          estado: summary.pending === 0 ? 'COMPLETADA' : 'CON_DIFERENCIAS',
          message:
            summary.pending === 0
              ? 'Conciliación completada'
              : `Conciliación cerrada con ${summary.pending} items pendientes`,
        });
      }

      case 'reopen': {
        if (statement.estado !== 'CERRADA' && statement.estado !== 'COMPLETADA' && statement.estado !== 'CON_DIFERENCIAS') {
          return NextResponse.json(
            { error: 'Extracto no está cerrado' },
            { status: 422 }
          );
        }

        await prisma.bankStatement.update({
          where: { id: statementId },
          data: {
            estado: 'EN_PROCESO',
            cerradoAt: null,
            cerradoPor: null,
          },
        });

        return NextResponse.json({
          success: true,
          message: 'Extracto reabierto',
        });
      }

      case 'updateTolerances': {
        if (statement.estado === 'CERRADA') {
          return NextResponse.json(
            { error: 'No se puede modificar un extracto cerrado' },
            { status: 422 }
          );
        }

        await prisma.bankStatement.update({
          where: { id: statementId },
          data: {
            ...(body.toleranciaMonto !== undefined && {
              toleranciaMonto: body.toleranciaMonto,
            }),
            ...(body.toleranciaDias !== undefined && {
              toleranciaDias: body.toleranciaDias,
            }),
          },
        });

        return NextResponse.json({
          success: true,
          message: 'Tolerancias actualizadas',
        });
      }

      default:
        return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error updating statement:', error);
    return NextResponse.json(
      { error: 'Error al actualizar extracto' },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// DELETE - Delete statement (only if not closed)
// ═══════════════════════════════════════════════════════════════════════════════

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const { user, error } = await requirePermission(TESORERIA_PERMISSIONS.CONCILIACION_CLOSE);
    if (error) return error;

    const companyId = user!.companyId;

    const { id } = await params;
    const statementId = parseInt(id);

    if (!statementId) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const statement = await prisma.bankStatement.findFirst({
      where: { id: statementId, companyId },
      select: { id: true, estado: true },
    });

    if (!statement) {
      return NextResponse.json(
        { error: 'Extracto no encontrado' },
        { status: 404 }
      );
    }

    if (statement.estado === 'CERRADA' || statement.estado === 'COMPLETADA' || statement.estado === 'CON_DIFERENCIAS') {
      return NextResponse.json(
        { error: 'No se puede eliminar un extracto cerrado' },
        { status: 422 }
      );
    }

    // Delete statement (items cascade)
    await prisma.bankStatement.delete({
      where: { id: statementId },
    });

    return NextResponse.json({
      success: true,
      message: 'Extracto eliminado',
    });
  } catch (error) {
    console.error('Error deleting statement:', error);
    return NextResponse.json(
      { error: 'Error al eliminar extracto' },
      { status: 500 }
    );
  }
}
