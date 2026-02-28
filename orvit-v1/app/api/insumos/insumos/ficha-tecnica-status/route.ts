import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/shared-helpers';

export const dynamic = 'force-dynamic';

/**
 * GET /api/insumos/insumos/ficha-tecnica-status?companyId=X
 * Returns the list of supplyIds that already have a technical sheet,
 * scoped to the given company.
 */
export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');

    if (!companyId) {
      return NextResponse.json({ error: 'companyId es requerido' }, { status: 400 });
    }

    const cid = parseInt(companyId);

    // Get all supply IDs for this company that have a technical sheet
    const sheets = await prisma.$queryRaw<{ supplyId: number }[]>`
      SELECT st."supplyId"
      FROM supply_technical_sheets st
      INNER JOIN supplies s ON s.id = st."supplyId"
      WHERE s.company_id = ${cid}
    `;

    return NextResponse.json({ supplyIds: sheets.map((s) => s.supplyId) });
  } catch (error) {
    console.error('Error obteniendo estado fichas técnicas:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
