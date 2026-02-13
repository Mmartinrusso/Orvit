/**
 * GET /api/ventas/clientes/[id]/credito
 *
 * Returns complete credit status for a client.
 * Uses credit-validator for comprehensive validation.
 *
 * Query params:
 * - viewMode: 'S' (T1 only) or 'E' (T1+T2), default 'E'
 * - orderAmount: Optional amount to validate against
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  validateClientCredit,
  getQuickCreditStatus,
  type ViewMode,
} from '@/lib/ventas/credit-validator';
import { getLedgerSummary } from '@/lib/ventas/balance-rebuilder';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.CLIENTES_CREDIT_VIEW);
    if (error) return error;

    const companyId = user!.companyId;

    const { id: clientId } = await params;
    if (!clientId) {
      return NextResponse.json({ error: 'ID de cliente requerido' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const viewMode = (searchParams.get('viewMode') || 'E') as ViewMode;
    const orderAmountParam = searchParams.get('orderAmount');
    const quick = searchParams.get('quick') === 'true';
    const includeLedgerSummary = searchParams.get('includeLedger') === 'true';

    // Quick mode for list views
    if (quick) {
      const status = await getQuickCreditStatus(clientId, companyId, viewMode);
      return NextResponse.json(status);
    }

    // Full validation
    const orderAmount = orderAmountParam ? parseFloat(orderAmountParam) : 0;

    const result = await validateClientCredit({
      clientId,
      companyId,
      orderAmount,
      viewMode,
      userId: user!.id,
    });

    // Optionally include ledger summary for debugging
    let ledgerSummary = null;
    if (includeLedgerSummary) {
      ledgerSummary = await getLedgerSummary(clientId, companyId, viewMode);
    }

    return NextResponse.json({
      ...result,
      ...(ledgerSummary && { ledgerSummary }),
    });
  } catch (error) {
    console.error('Error getting credit status:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    );
  }
}
