import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import {
  getIndirectCostsForMonth,
  getIndirectSummaryWithLabels
} from '@/lib/costs/integrations/indirect';

export const dynamic = 'force-dynamic';

/**
 * GET /api/costos/indirect?month=2026-01
 *
 * Obtiene los costos indirectos para un mes específico.
 * V2: Los datos vienen de Compras (PurchaseReceipt con esIndirecto=true).
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload || !payload.companyId) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const companyId = payload.companyId as number;

    // Obtener mes de query params
    const month = request.nextUrl.searchParams.get('month');
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json(
        { error: 'Parámetro month requerido en formato YYYY-MM' },
        { status: 400 }
      );
    }

    // Verificar si se quiere resumen con labels
    const summary = request.nextUrl.searchParams.get('summary') === 'true';

    if (summary) {
      const summaryData = await getIndirectSummaryWithLabels(companyId, month);
      return NextResponse.json({
        success: true,
        month,
        source: 'COMPRAS',
        ...summaryData
      });
    }

    // Obtener datos completos
    const data = await getIndirectCostsForMonth(companyId, month);

    return NextResponse.json({
      success: true,
      month,
      source: 'COMPRAS',
      hasData: data.itemCount > 0,
      summary: {
        total: data.total,
        itemCount: data.itemCount,
        categoryCount: Object.keys(data.byCategory).length
      },
      byCategory: data.byCategory,
      details: data.details
    });

  } catch (error) {
    console.error('Error obteniendo costos indirectos:', error);
    return NextResponse.json(
      { error: 'Error al obtener costos indirectos' },
      { status: 500 }
    );
  }
}
