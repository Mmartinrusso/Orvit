import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { getCalculatorData } from '@/lib/costs/integrations/calculator-consolidator';

export const dynamic = 'force-dynamic';

/**
 * GET /api/costos/v2/calculator?month=YYYY-MM
 *
 * Consolida en un solo request:
 * - Producción del mes: costos de materiales por producto
 * - Indirectos + distribución configurada → monto por producto
 * - Ventas del mes: precio promedio de venta por producto
 *
 * Retorna una fila por producto con costo, margen e ingresos reales.
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

    const month = request.nextUrl.searchParams.get('month');
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json(
        { error: 'Parámetro month requerido en formato YYYY-MM' },
        { status: 400 }
      );
    }

    const data = await getCalculatorData(companyId, month);

    return NextResponse.json({
      success: true,
      ...data
    });
  } catch (error) {
    console.error('Error en /api/costos/v2/calculator:', error);
    return NextResponse.json(
      { error: 'Error al calcular datos consolidados' },
      { status: 500 }
    );
  }
}
