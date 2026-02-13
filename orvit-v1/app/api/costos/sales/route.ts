import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { getSalesForMonth } from '@/lib/costs/integrations/sales';

export const dynamic = 'force-dynamic';

/**
 * GET /api/costos/sales?month=2026-01
 *
 * Obtiene los datos de ventas para un mes específico.
 * Los datos vienen de SalesInvoice con estados confirmados.
 *
 * Incluye COGS calculado desde Product.costPrice.
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

    // Obtener datos de ventas
    const data = await getSalesForMonth(companyId, month);

    return NextResponse.json({
      success: true,
      month,
      source: 'SalesInvoice',
      hasData: data.invoiceCount > 0,
      summary: {
        totalRevenue: data.totalRevenue,
        totalCost: data.totalCost,
        grossMargin: data.grossMargin,
        marginPercent: Math.round(data.marginPercent * 100) / 100,
        invoiceCount: data.invoiceCount,
        itemCount: data.itemCount
      },
      byClient: data.byClient,
      byProduct: data.byProduct,
      details: data.details
    });

  } catch (error) {
    console.error('Error obteniendo datos de ventas:', error);
    return NextResponse.json(
      { error: 'Error al obtener datos de ventas' },
      { status: 500 }
    );
  }
}
