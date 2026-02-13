/**
 * API de Períodos de Nómina
 *
 * GET  /api/payroll/periods - Listar períodos
 * POST /api/payroll/periods - Generar períodos del mes
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getPayrollAuthUser } from '@/lib/payroll/auth-helper';
import { generateMonthPeriods, Holiday } from '@/lib/payroll/period-utils';

export const dynamic = 'force-dynamic';

// GET - Listar períodos
export async function GET(request: NextRequest) {
  try {
    const user = await getPayrollAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year')
      ? parseInt(searchParams.get('year')!)
      : new Date().getFullYear();
    const month = searchParams.get('month') ? parseInt(searchParams.get('month')!) : undefined;
    const includeClosed = searchParams.get('includeClosed') !== 'false';

    const periods = await prisma.payrollPeriod.findMany({
      where: {
        company_id: user.companyId,
        year,
        ...(month ? { month } : {}),
        ...(includeClosed ? {} : { is_closed: false }),
      },
      orderBy: [{ year: 'desc' }, { month: 'desc' }, { period_type: 'asc' }],
      include: {
        payrolls: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    });

    return NextResponse.json({
      periods: periods.map((p) => ({
        id: p.id,
        periodType: p.period_type,
        year: p.year,
        month: p.month,
        periodStart: p.period_start,
        periodEnd: p.period_end,
        paymentDate: p.payment_date,
        businessDays: p.business_days,
        isClosed: p.is_closed,
        hasPayroll: p.payrolls.length > 0,
        payrollStatus: p.payrolls[0]?.status || null,
      })),
    });
  } catch (error) {
    console.error('Error obteniendo períodos:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// POST - Generar períodos del mes
export async function POST(request: NextRequest) {
  try {
    const user = await getPayrollAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { year, month } = body;

    if (!year || !month) {
      return NextResponse.json({ error: 'year y month son requeridos' }, { status: 400 });
    }

    // Verificar si ya existen períodos para este mes
    const existing = await prisma.payrollPeriod.findFirst({
      where: {
        company_id: user.companyId,
        year,
        month,
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Ya existen períodos para este mes' },
        { status: 400 }
      );
    }

    // Obtener configuración
    const config = await prisma.payrollConfig.findUnique({
      where: { company_id: user.companyId },
    });

    if (!config) {
      return NextResponse.json(
        { error: 'Debe configurar la nómina primero' },
        { status: 400 }
      );
    }

    // Obtener feriados del mes
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const holidaysDb = await prisma.companyHoliday.findMany({
      where: {
        company_id: user.companyId,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    const holidays: Holiday[] = holidaysDb.map((h) => ({
      date: h.date,
      name: h.name,
      isNational: h.is_national,
    }));

    // Generar períodos
    const periodsData = generateMonthPeriods(
      user.companyId,
      year,
      month,
      config.payment_frequency as 'MONTHLY' | 'BIWEEKLY',
      config.first_payment_day,
      config.second_payment_day,
      config.payment_day_rule as 'PREVIOUS_BUSINESS_DAY' | 'NEXT_BUSINESS_DAY' | 'EXACT',
      holidays
    );

    // Crear períodos en BD
    const created = await prisma.$transaction(
      periodsData.map((p) =>
        prisma.payrollPeriod.create({
          data: {
            company_id: user.companyId,
            period_type: p.periodType,
            year: p.year,
            month: p.month,
            period_start: p.periodStart,
            period_end: p.periodEnd,
            payment_date: p.paymentDate,
            business_days: p.businessDays,
            is_closed: false,
          },
        })
      )
    );

    return NextResponse.json({
      success: true,
      periods: created.map((p) => ({
        id: p.id,
        periodType: p.period_type,
        year: p.year,
        month: p.month,
        periodStart: p.period_start,
        periodEnd: p.period_end,
        paymentDate: p.payment_date,
        businessDays: p.business_days,
      })),
    });
  } catch (error) {
    console.error('Error generando períodos:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
