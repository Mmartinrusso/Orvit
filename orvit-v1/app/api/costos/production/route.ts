import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/shared-helpers';
import { PRODUCCION_PERMISSIONS } from '@/lib/permissions';
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
    const { user, error } = await requirePermission(PRODUCCION_PERMISSIONS.REPORTES.VIEW);
    if (error) return error;

    const companyId = user!.companyId;

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
