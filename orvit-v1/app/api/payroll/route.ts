/**
 * API de Liquidaciones
 *
 * GET /api/payroll - Listar liquidaciones
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getPayrollAuthUser } from '@/lib/payroll/auth-helper';

export const dynamic = 'force-dynamic';

// GET - Listar liquidaciones
export async function GET(request: NextRequest) {
  try {
    const user = await getPayrollAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Construir filtro
    const where: any = {
      company_id: user.companyId,
    };

    if (status && status !== 'all') {
      where.status = status;
    }

    // Obtener liquidaciones con período
    const [payrolls, total] = await Promise.all([
      prisma.payroll.findMany({
        where,
        include: {
          period: true,
        },
        orderBy: [
          { created_at: 'desc' },
        ],
        take: limit,
        skip: offset,
      }),
      prisma.payroll.count({ where }),
    ]);

    return NextResponse.json({
      payrolls: payrolls.map((p) => ({
        id: p.id,
        periodId: p.period_id,
        status: p.status,
        totalGross: Number(p.total_gross),
        totalDeductions: Number(p.total_deductions),
        totalNet: Number(p.total_net),
        totalEmployerCost: Number(p.total_employer_cost),
        employeeCount: p.employee_count,
        notes: p.notes,
        calculatedAt: p.calculated_at?.toISOString(),
        approvedAt: p.approved_at?.toISOString(),
        paidAt: p.paid_at?.toISOString(),
        cancelledAt: p.cancelled_at?.toISOString(),
        period: {
          id: p.period.id,
          periodType: p.period.period_type,
          year: p.period.year,
          month: p.period.month,
          periodStart: p.period.period_start.toISOString(),
          periodEnd: p.period.period_end.toISOString(),
          paymentDate: p.period.payment_date.toISOString(),
          businessDays: p.period.business_days,
          isClosed: p.period.is_closed,
        },
      })),
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Error obteniendo liquidaciones:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
