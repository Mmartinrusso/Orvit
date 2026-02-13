import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { getPayrollCostsForMonth, getPayrollSummaryByType } from '@/lib/costs/integrations/payroll';

export const dynamic = 'force-dynamic';

/**
 * GET /api/costos/payroll?month=2026-01
 *
 * Obtiene los costos de nómina para un mes específico.
 * Los datos vienen de PayrollRun con status APPROVED o PAID.
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

    // Verificar si se quiere agrupado por tipo
    const groupByType = request.nextUrl.searchParams.get('groupByType') === 'true';

    if (groupByType) {
      const byType = await getPayrollSummaryByType(companyId, month);
      return NextResponse.json({
        success: true,
        month,
        source: 'PayrollRun',
        byType
      });
    }

    // Obtener datos de nómina
    const data = await getPayrollCostsForMonth(companyId, month);

    return NextResponse.json({
      success: true,
      month,
      source: 'PayrollRun',
      hasData: data.payrollCount > 0,
      summary: {
        totalGross: data.totalGross,
        totalDeductions: data.totalDeductions,
        totalNet: data.totalNet,
        employerCost: data.employerCost,  // Este es el costo real para la empresa
        employeeCount: data.employeeCount,
        payrollCount: data.payrollCount
      },
      details: data.details
    });

  } catch (error) {
    console.error('Error obteniendo costos de nómina:', error);
    return NextResponse.json(
      { error: 'Error al obtener costos de nómina' },
      { status: 500 }
    );
  }
}
