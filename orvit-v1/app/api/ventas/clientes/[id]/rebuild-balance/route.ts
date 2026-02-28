/**
 * POST /api/ventas/clientes/[id]/rebuild-balance
 *
 * Rebuilds a client's currentBalance from ClientLedgerEntry (source of truth).
 * Used when discrepancies are detected between cached balance and ledger.
 *
 * Query params:
 * - viewMode: 'S' (T1 only) or 'E' (T1+T2), default 'E'
 * - dryRun: 'true' to only calculate without updating, default 'false'
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  rebuildCustomerBalance,
  getLedgerSummary,
  type ViewMode,
} from '@/lib/ventas/balance-rebuilder';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.CUENTA_CORRIENTE_RECALCULATE);
    if (error) return error;

    const companyId = user!.companyId;

    const { id: clientId } = await params;
    if (!clientId) {
      return NextResponse.json({ error: 'ID de cliente requerido' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const viewMode = (searchParams.get('viewMode') || 'E') as ViewMode;
    const dryRun = searchParams.get('dryRun') === 'true';

    // Rebuild balance
    const result = await rebuildCustomerBalance(
      clientId,
      companyId,
      viewMode,
      !dryRun // updateCache = true if not dry run
    );

    // Get detailed ledger summary for audit
    const ledgerSummary = await getLedgerSummary(clientId, companyId, viewMode);

    return NextResponse.json({
      success: true,
      dryRun,
      result: {
        clientId: result.clientId,
        clientName: result.clientName,
        previousBalance: result.previousBalance.toFixed(2),
        newBalance: result.newBalance.toFixed(2),
        difference: result.difference.toFixed(2),
        entriesProcessed: result.entriesProcessed,
        wasUpdated: result.wasUpdated,
        viewMode: result.viewMode,
      },
      ledgerSummary: {
        totalDebe: ledgerSummary.totalDebe.toFixed(2),
        totalHaber: ledgerSummary.totalHaber.toFixed(2),
        calculatedBalance: ledgerSummary.balance.toFixed(2),
        entryCount: ledgerSummary.entryCount,
        oldestEntry: ledgerSummary.oldestEntry,
        newestEntry: ledgerSummary.newestEntry,
        entriesByType: ledgerSummary.entriesByType.map(e => ({
          type: e.type,
          count: e.count,
          totalDebe: e.totalDebe.toFixed(2),
          totalHaber: e.totalHaber.toFixed(2),
        })),
      },
    });
  } catch (error) {
    console.error('Error rebuilding balance:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    );
  }
}

// GET - Check for discrepancy without rebuilding
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.CLIENTES_CREDIT_ADJUST);
    if (error) return error;

    const companyId = user!.companyId;

    const clientId = params.id;
    if (!clientId) {
      return NextResponse.json({ error: 'ID de cliente requerido' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const viewMode = (searchParams.get('viewMode') || 'E') as ViewMode;

    // Dry run to check discrepancy
    const result = await rebuildCustomerBalance(
      clientId,
      companyId,
      viewMode,
      false // Don't update
    );

    return NextResponse.json({
      clientId: result.clientId,
      clientName: result.clientName,
      cachedBalance: result.previousBalance.toFixed(2),
      ledgerBalance: result.newBalance.toFixed(2),
      difference: result.difference.toFixed(2),
      hasDiscrepancy: !result.difference.isZero(),
      entriesInLedger: result.entriesProcessed,
      viewMode: result.viewMode,
    });
  } catch (error) {
    console.error('Error checking balance:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    );
  }
}
