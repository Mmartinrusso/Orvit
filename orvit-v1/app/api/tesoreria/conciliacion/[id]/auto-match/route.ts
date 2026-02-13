/**
 * Auto-Match Bank Reconciliation API - O2C Phase 4
 *
 * Automatically matches bank statement items with treasury movements.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { autoMatchStatementItems } from '@/lib/tesoreria/reconciliation-matcher';
import { requirePermission, TESORERIA_PERMISSIONS } from '@/lib/tesoreria/auth';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// POST - Run auto-match on statement
// ═══════════════════════════════════════════════════════════════════════════════

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { user, error } = await requirePermission(TESORERIA_PERMISSIONS.CONCILIACION_MATCH);
    if (error) return error;

    const companyId = user!.companyId;

    const { id } = await params;
    const statementId = parseInt(id);

    if (!statementId || isNaN(statementId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    // Verify statement exists and belongs to user's company
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

    if (statement.estado === 'CERRADA') {
      return NextResponse.json(
        { error: 'No se puede modificar un extracto cerrado' },
        { status: 422 }
      );
    }

    // Run auto-match
    const result = await autoMatchStatementItems(statementId);

    return NextResponse.json({
      statementId: result.statementId,
      totalItems: result.totalItems,
      matched: result.matched,
      unmatched: result.unmatched,
      suspense: result.suspense,
      results: result.results,
      message: `Auto-match completado: ${result.matched}/${result.totalItems} items conciliados`,
    });
  } catch (error) {
    console.error('Error in auto-match:', error);
    return NextResponse.json(
      { error: 'Error en auto-match' },
      { status: 500 }
    );
  }
}
