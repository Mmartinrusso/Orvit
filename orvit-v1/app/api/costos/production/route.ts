import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { getProductionCostsForMonth } from '@/lib/costs/integrations/production';

export const dynamic = 'force-dynamic';

/**
 * GET /api/costos/production?month=2026-01
 *
 * Obtiene los costos de producción para un mes específico.
 * Calcula consumo de insumos basado en recetas activas.
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

    // Obtener datos de producción
    const data = await getProductionCostsForMonth(companyId, month);

    return NextResponse.json({
      success: true,
      month,
      source: 'MonthlyProduction + Recipe',
      hasData: data.productCount > 0,
      summary: {
        totalProductionCost: data.totalProductionCost,
        unitsProduced: data.unitsProduced,
        productCount: data.productCount,
        inputsCount: data.inputsConsumed.length
      },
      inputsConsumed: data.inputsConsumed,
      byProduct: data.byProduct,
      details: data.details
    });

  } catch (error) {
    console.error('Error obteniendo costos de producción:', error);
    return NextResponse.json(
      { error: 'Error al obtener costos de producción' },
      { status: 500 }
    );
  }
}
