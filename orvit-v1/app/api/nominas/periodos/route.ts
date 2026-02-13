import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getPayrollAuth, hasPayrollAccess } from '@/lib/nominas/auth-helper';

export const dynamic = 'force-dynamic';

// GET - Obtener períodos
export async function GET(request: NextRequest) {
  try {
    const auth = await getPayrollAuth();
    if (!auth) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year');
    const month = searchParams.get('month');
    const unionId = searchParams.get('unionId');

    if (!year || !month) {
      return NextResponse.json(
        { error: 'year y month son requeridos' },
        { status: 400 }
      );
    }

    // Construir filtro de gremio con Prisma.sql
    const unionFilter = unionId
      ? Prisma.sql`AND pp.union_id = ${parseInt(unionId)}`
      : Prisma.empty;

    const periods = await prisma.$queryRaw<any[]>`
      SELECT
        pp.id,
        pp.company_id as "companyId",
        pp.union_id as "unionId",
        pp.period_type as "periodType",
        pp.year,
        pp.month,
        pp.period_start as "periodStart",
        pp.period_end as "periodEnd",
        pp.payment_date as "paymentDate",
        pp.business_days as "businessDays",
        pp.is_closed as "isClosed",
        pp.created_at as "createdAt",
        pu.name as "unionName",
        pu.code as "unionCode",
        pu.convention_code as "conventionCode",
        pu.payment_schedule_type as "paymentScheduleType",
        (
          SELECT COUNT(*)::int
          FROM payroll_runs pr
          WHERE pr.period_id = pp.id
        ) as "runCount",
        (
          SELECT json_build_object(
            'id', pr.id,
            'runNumber', pr.run_number,
            'status', pr.status,
            'totalNet', pr.total_net,
            'employeeCount', pr.employee_count
          )
          FROM payroll_runs pr
          WHERE pr.period_id = pp.id
          ORDER BY pr.run_number DESC
          LIMIT 1
        ) as "latestRun",
        (
          SELECT COUNT(DISTINCT e.id)::int
          FROM employees e
          JOIN union_categories uc ON uc.id = e.union_category_id
          WHERE uc.union_id = pp.union_id AND e.active = true
        ) as "totalEmployees"
      FROM payroll_periods pp
      LEFT JOIN payroll_unions pu ON pu.id = pp.union_id
      WHERE pp.company_id = ${auth.companyId}
        AND pp.year = ${parseInt(year)}
        AND pp.month = ${parseInt(month)}
        ${unionFilter}
      ORDER BY pu.name, pp.period_type
    `;

    const processedPeriods = periods.map((p: any) => ({
      ...p,
      id: Number(p.id),
      companyId: Number(p.companyId),
      unionId: p.unionId ? Number(p.unionId) : null,
      year: Number(p.year),
      month: Number(p.month),
      businessDays: Number(p.businessDays),
      runCount: Number(p.runCount || 0),
      totalEmployees: Number(p.totalEmployees || 0),
      latestRun: p.latestRun ? {
        ...p.latestRun,
        id: Number(p.latestRun.id),
        runNumber: Number(p.latestRun.runNumber),
        totalNet: parseFloat(p.latestRun.totalNet),
        employeeCount: Number(p.latestRun.employeeCount)
      } : null
    }));

    return NextResponse.json(processedPeriods);
  } catch (error) {
    console.error('Error obteniendo períodos:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// POST - Generar períodos para un mes/gremio
export async function POST(request: NextRequest) {
  try {
    const auth = await getPayrollAuth();
    if (!auth || !hasPayrollAccess(auth.user)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { year, month, unionId } = body;

    if (!year || !month) {
      return NextResponse.json(
        { error: 'year y month son requeridos' },
        { status: 400 }
      );
    }

    // Obtener gremios a procesar
    let unions: any[];
    if (unionId) {
      unions = await prisma.$queryRaw<any[]>`
        SELECT id, name, code, payment_schedule_type, payment_rule_json
        FROM payroll_unions
        WHERE id = ${parseInt(unionId)}
          AND company_id = ${auth.companyId}
          AND is_active = true
      `;
    } else {
      unions = await prisma.$queryRaw<any[]>`
        SELECT id, name, code, payment_schedule_type, payment_rule_json
        FROM payroll_unions
        WHERE company_id = ${auth.companyId}
          AND is_active = true
      `;
    }

    if (unions.length === 0) {
      return NextResponse.json(
        { error: 'No hay gremios activos' },
        { status: 400 }
      );
    }

    // Obtener feriados del mes
    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0);

    const holidays = await prisma.$queryRaw<{ date: Date }[]>`
      SELECT date FROM company_holidays
      WHERE company_id = ${auth.companyId}
        AND date >= ${startOfMonth}::date
        AND date <= ${endOfMonth}::date
    `;

    const holidayDates = new Set(holidays.map(h => h.date.toISOString().split('T')[0]));

    // Función para contar días hábiles
    const countBusinessDays = (start: Date, end: Date): number => {
      let count = 0;
      const current = new Date(start);
      while (current <= end) {
        const dayOfWeek = current.getDay();
        const dateStr = current.toISOString().split('T')[0];
        if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidayDates.has(dateStr)) {
          count++;
        }
        current.setDate(current.getDate() + 1);
      }
      return count;
    };

    // Función para calcular fecha de pago (día anterior hábil si cae en feriado/finde)
    const calculatePaymentDate = (targetDay: number | 'EOM', yr: number, mo: number): Date => {
      let paymentDate: Date;

      if (targetDay === 'EOM') {
        paymentDate = new Date(yr, mo, 0); // Último día del mes
      } else {
        paymentDate = new Date(yr, mo - 1, targetDay);
      }

      // Si cae en fin de semana o feriado, mover al día hábil anterior
      while (
        paymentDate.getDay() === 0 ||
        paymentDate.getDay() === 6 ||
        holidayDates.has(paymentDate.toISOString().split('T')[0])
      ) {
        paymentDate.setDate(paymentDate.getDate() - 1);
      }

      return paymentDate;
    };

    const createdPeriods = [];

    for (const union of unions) {
      const scheduleType = union.payment_schedule_type || 'BIWEEKLY_FIXED';
      const ruleJson = union.payment_rule_json || {};

      if (scheduleType.startsWith('BIWEEKLY')) {
        // Quincena 1: 1-15
        const q1Start = new Date(year, month - 1, 1);
        const q1End = new Date(year, month - 1, 15);
        const q1PaymentDay = ruleJson.first_day || 15;
        const q1PaymentDate = calculatePaymentDate(q1PaymentDay, year, month);
        const q1BusinessDays = countBusinessDays(q1Start, q1End);

        // Verificar si ya existe
        const existingQ1 = await prisma.$queryRaw<any[]>`
          SELECT id FROM payroll_periods
          WHERE company_id = ${auth.companyId}
            AND union_id = ${union.id}
            AND year = ${year}
            AND month = ${month}
            AND period_type = 'QUINCENA_1'
        `;

        if (existingQ1.length === 0) {
          const result1 = await prisma.$queryRaw<any[]>`
            INSERT INTO payroll_periods (
              company_id, union_id, period_type, year, month,
              period_start, period_end, payment_date, business_days, created_at
            )
            VALUES (
              ${auth.companyId}, ${union.id}, 'QUINCENA_1', ${year}, ${month},
              ${q1Start}::date, ${q1End}::date, ${q1PaymentDate}::date, ${q1BusinessDays}, NOW()
            )
            RETURNING id, period_type as "periodType"
          `;
          createdPeriods.push({
            id: Number(result1[0].id),
            unionId: union.id,
            unionName: union.name,
            periodType: 'QUINCENA_1'
          });
        }

        // Quincena 2: 16-fin de mes
        const q2Start = new Date(year, month - 1, 16);
        const q2End = new Date(year, month, 0); // Último día del mes
        const q2PaymentDay = ruleJson.second_day || 'EOM';
        const q2PaymentDate = calculatePaymentDate(q2PaymentDay, year, month);
        const q2BusinessDays = countBusinessDays(q2Start, q2End);

        const existingQ2 = await prisma.$queryRaw<any[]>`
          SELECT id FROM payroll_periods
          WHERE company_id = ${auth.companyId}
            AND union_id = ${union.id}
            AND year = ${year}
            AND month = ${month}
            AND period_type = 'QUINCENA_2'
        `;

        if (existingQ2.length === 0) {
          const result2 = await prisma.$queryRaw<any[]>`
            INSERT INTO payroll_periods (
              company_id, union_id, period_type, year, month,
              period_start, period_end, payment_date, business_days, created_at
            )
            VALUES (
              ${auth.companyId}, ${union.id}, 'QUINCENA_2', ${year}, ${month},
              ${q2Start}::date, ${q2End}::date, ${q2PaymentDate}::date, ${q2BusinessDays}, NOW()
            )
            RETURNING id, period_type as "periodType"
          `;
          createdPeriods.push({
            id: Number(result2[0].id),
            unionId: union.id,
            unionName: union.name,
            periodType: 'QUINCENA_2'
          });
        }
      } else {
        // Mensual
        const mStart = new Date(year, month - 1, 1);
        const mEnd = new Date(year, month, 0);
        const paymentDay = ruleJson.payment_day || 5;
        // Si es MONTHLY_NEXT_MONTH, el pago es en el mes siguiente
        const paymentMonth = scheduleType === 'MONTHLY_NEXT_MONTH' ? month + 1 : month;
        const paymentYear = paymentMonth > 12 ? year + 1 : year;
        const adjustedPaymentMonth = paymentMonth > 12 ? 1 : paymentMonth;
        const mPaymentDate = calculatePaymentDate(paymentDay, paymentYear, adjustedPaymentMonth);
        const mBusinessDays = countBusinessDays(mStart, mEnd);

        const existingM = await prisma.$queryRaw<any[]>`
          SELECT id FROM payroll_periods
          WHERE company_id = ${auth.companyId}
            AND union_id = ${union.id}
            AND year = ${year}
            AND month = ${month}
            AND period_type = 'MONTHLY'
        `;

        if (existingM.length === 0) {
          const resultM = await prisma.$queryRaw<any[]>`
            INSERT INTO payroll_periods (
              company_id, union_id, period_type, year, month,
              period_start, period_end, payment_date, business_days, created_at
            )
            VALUES (
              ${auth.companyId}, ${union.id}, 'MONTHLY', ${year}, ${month},
              ${mStart}::date, ${mEnd}::date, ${mPaymentDate}::date, ${mBusinessDays}, NOW()
            )
            RETURNING id, period_type as "periodType"
          `;
          createdPeriods.push({
            id: Number(resultM[0].id),
            unionId: union.id,
            unionName: union.name,
            periodType: 'MONTHLY'
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      created: createdPeriods.length,
      periods: createdPeriods
    }, { status: 201 });
  } catch (error) {
    console.error('Error generando períodos:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
