import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { getMaintenanceCostsForMonth } from '@/lib/costs/integrations/maintenance';

export const dynamic = 'force-dynamic';

/**
 * GET /api/costos/maintenance?month=2026-01
 *
 * Obtiene los costos de mantenimiento para un mes específico.
 * Lee de MaintenanceCostBreakdown (ya calculados por el módulo de mantenimiento).
 *
 * NOTA: Esta API es READ-ONLY, no modifica el módulo de mantenimiento.
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

    // Obtener datos de mantenimiento
    const data = await getMaintenanceCostsForMonth(companyId, month);

    return NextResponse.json({
      success: true,
      month,
      source: 'MaintenanceCostBreakdown',
      readOnly: true,  // Indicar que es solo lectura
      hasData: data.workOrderCount > 0,
      summary: {
        totalCost: data.totalCost,
        laborCost: data.laborCost,
        partsCost: data.partsCost,
        thirdPartyCost: data.thirdPartyCost,
        extrasCost: data.extrasCost,
        workOrderCount: data.workOrderCount
      },
      details: data.details
    });

  } catch (error) {
    console.error('Error obteniendo costos de mantenimiento:', error);
    return NextResponse.json(
      { error: 'Error al obtener costos de mantenimiento' },
      { status: 500 }
    );
  }
}
