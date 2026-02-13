/**
 * API de Proyección de Nóminas
 *
 * GET /api/payroll/projection - Obtener proyección de pagos
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getPayrollAuthUser } from '@/lib/payroll/auth-helper';
import { generateProjectionSummary, PendingAdvance, ProjectionConfig } from '@/lib/payroll/projections';
import { EmployeeData } from '@/lib/payroll/calculator';
import { SalaryComponentData, PayrollPeriodData } from '@/lib/payroll/config';
import { Holiday } from '@/lib/payroll/period-utils';

export const dynamic = 'force-dynamic';

// GET - Obtener proyección
export async function GET(request: NextRequest) {
  try {
    const user = await getPayrollAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const companyId = user.companyId;

    // Obtener configuración
    const config = await prisma.payrollConfig.findUnique({
      where: { company_id: companyId },
    });

    if (!config) {
      return NextResponse.json({
        configured: false,
        message: 'Debe configurar la nómina primero',
      });
    }

    // Obtener empleados activos
    const employees = await prisma.employee.findMany({
      where: {
        company_id: companyId,
        active: true,
      },
    });

    // Obtener componentes
    const components = await prisma.salaryComponent.findMany({
      where: {
        company_id: companyId,
        is_active: true,
      },
    });

    // Obtener períodos actuales y futuros
    const today = new Date();
    const periods = await prisma.payrollPeriod.findMany({
      where: {
        company_id: companyId,
        payment_date: { gte: today },
        is_closed: false,
      },
      orderBy: { payment_date: 'asc' },
    });

    // Obtener feriados del año actual y siguiente
    const startYear = today.getFullYear();
    const holidays = await prisma.companyHoliday.findMany({
      where: {
        company_id: companyId,
        date: {
          gte: new Date(startYear, 0, 1),
          lte: new Date(startYear + 1, 11, 31),
        },
      },
    });

    // Obtener adelantos pendientes
    const advances = await prisma.salaryAdvance.findMany({
      where: {
        company_id: companyId,
        status: { in: ['APPROVED', 'ACTIVE'] },
        remaining_amount: { gt: 0 },
      },
      include: {
        employee: {
          select: { name: true },
        },
        installments: {
          where: { status: 'PENDING' },
          orderBy: { installment_num: 'asc' },
          take: 1,
        },
      },
    });

    // Mapear datos
    const employeeData: EmployeeData[] = employees.map((e) => ({
      id: e.id,
      name: e.name,
      grossSalary: Number(e.gross_salary),
      hireDate: e.hire_date,
      terminationDate: e.termination_date,
      isActive: e.active,
      costCenterId: e.cost_center_id || undefined,
    }));

    const componentData: SalaryComponentData[] = components.map((c) => ({
      id: c.id,
      companyId: c.company_id,
      code: c.code,
      name: c.name,
      type: c.type as 'EARNING' | 'DEDUCTION',
      calcType: c.calc_type as 'FIXED' | 'PERCENTAGE' | 'FORMULA' | 'DAYS_BASED',
      calcValue: c.calc_value ? Number(c.calc_value) : null,
      calcFormula: c.calc_formula,
      baseVariable: c.base_variable as 'gross' | 'base' | 'net',
      dependsOn: c.depends_on,
      roundingMode: c.rounding_mode as 'HALF_UP' | 'DOWN' | 'UP' | 'NONE',
      roundingDecimals: c.rounding_decimals,
      capMin: c.cap_min ? Number(c.cap_min) : null,
      capMax: c.cap_max ? Number(c.cap_max) : null,
      isTaxable: c.is_taxable,
      isActive: c.is_active,
      applyTo: c.apply_to,
      prorateOnPartial: c.prorate_on_partial,
      order: c.order,
    }));

    const periodData: PayrollPeriodData[] = periods.map((p) => ({
      id: p.id,
      companyId: p.company_id,
      periodType: p.period_type as 'QUINCENA_1' | 'QUINCENA_2' | 'MONTHLY',
      year: p.year,
      month: p.month,
      periodStart: p.period_start,
      periodEnd: p.period_end,
      paymentDate: p.payment_date,
      businessDays: p.business_days,
      isClosed: p.is_closed,
    }));

    const holidayData: Holiday[] = holidays.map((h) => ({
      date: h.date,
      name: h.name,
      isNational: h.is_national,
    }));

    const pendingAdvances: PendingAdvance[] = advances.map((a) => ({
      employeeId: a.employee_id,
      employeeName: a.employee.name,
      amount: Number(a.amount),
      remainingAmount: Number(a.remaining_amount),
      nextInstallmentAmount: a.installments[0] ? Number(a.installments[0].amount) : 0,
    }));

    const projectionConfig: ProjectionConfig = {
      paymentFrequency: config.payment_frequency as 'MONTHLY' | 'BIWEEKLY',
      firstPaymentDay: config.first_payment_day,
      secondPaymentDay: config.second_payment_day,
      paymentDayRule: config.payment_day_rule as
        | 'PREVIOUS_BUSINESS_DAY'
        | 'NEXT_BUSINESS_DAY'
        | 'EXACT',
    };

    // Generar proyección
    const summary = generateProjectionSummary(
      companyId,
      employeeData,
      componentData,
      periodData,
      projectionConfig,
      holidayData,
      pendingAdvances,
      today
    );

    return NextResponse.json({
      configured: true,
      projection: {
        nextPayment: summary.nextPayment
          ? {
              ...summary.nextPayment,
              date: summary.nextPayment.date.toISOString(),
            }
          : null,
        monthlyProjection: summary.monthlyProjection.map((p) => ({
          ...p,
          paymentDate: p.paymentDate.toISOString(),
        })),
        pendingAdvances: summary.pendingAdvances,
        alerts: summary.alerts,
      },
    });
  } catch (error) {
    console.error('Error obteniendo proyección:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');
    return NextResponse.json({
      error: 'Error interno',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
