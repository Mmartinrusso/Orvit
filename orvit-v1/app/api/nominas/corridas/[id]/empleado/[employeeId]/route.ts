import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getPayrollAuth } from '@/lib/nominas/auth-helper';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: { id: string; employeeId: string };
}

// GET - Obtener detalle de liquidación de un empleado en una corrida
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await getPayrollAuth();
    if (!auth) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const runId = parseInt(params.id);
    const employeeId = params.employeeId;

    if (isNaN(runId)) {
      return NextResponse.json({ error: 'ID de corrida inválido' }, { status: 400 });
    }

    // Verificar corrida y obtener info del período
    const runResult = await prisma.$queryRaw<any[]>`
      SELECT
        pr.id, pr.run_number, pr.status,
        pp.period_type, pp.year, pp.month, pp.period_start, pp.period_end, pp.payment_date,
        ec.name as category_name
      FROM payroll_runs pr
      JOIN payroll_periods pp ON pp.id = pr.period_id
      LEFT JOIN employee_categories ec ON ec.id = pp.category_id
      WHERE pr.id = ${runId} AND pr.company_id = ${auth.companyId}
    `;

    if (runResult.length === 0) {
      return NextResponse.json({ error: 'Corrida no encontrada' }, { status: 404 });
    }

    const run = runResult[0];

    // Obtener item del empleado
    const itemResult = await prisma.$queryRaw<any[]>`
      SELECT
        pri.id,
        pri.employee_id as "employeeId",
        pri.employee_snapshot as "employeeSnapshot",
        pri.days_worked as "daysWorked",
        pri.days_in_period as "daysInPeriod",
        pri.prorate_factor as "prorateFactor",
        pri.base_salary as "baseSalary",
        pri.gross_remunerative as "grossRemunerative",
        pri.gross_total as "grossTotal",
        pri.total_deductions as "totalDeductions",
        pri.advances_discounted as "advancesDiscounted",
        pri.net_salary as "netSalary",
        pri.employer_cost as "employerCost",
        e.name as "employeeName",
        e.hire_date as "hireDate"
      FROM payroll_run_items pri
      JOIN employees e ON e.id = pri.employee_id
      WHERE pri.run_id = ${runId} AND pri.employee_id = ${employeeId}
    `;

    if (itemResult.length === 0) {
      return NextResponse.json({ error: 'Empleado no encontrado en esta corrida' }, { status: 404 });
    }

    const item = itemResult[0];

    // Obtener líneas de detalle
    const lines = await prisma.$queryRaw<any[]>`
      SELECT
        pril.id,
        pril.component_id as "componentId",
        pril.code,
        pril.name,
        pril.type,
        pril.quantity,
        pril.unit_amount as "unitAmount",
        pril.base_amount as "baseAmount",
        pril.calculated_amount as "calculatedAmount",
        pril.final_amount as "finalAmount",
        pril.formula_used as "formulaUsed",
        pril.meta
      FROM payroll_run_item_lines pril
      WHERE pril.run_item_id = ${item.id}
      ORDER BY
        CASE pril.type WHEN 'EARNING' THEN 1 WHEN 'DEDUCTION' THEN 2 ELSE 3 END,
        pril.id ASC
    `;

    const processedLines = lines.map((l: any) => ({
      ...l,
      id: Number(l.id),
      componentId: l.componentId ? Number(l.componentId) : null,
      quantity: parseFloat(l.quantity),
      unitAmount: parseFloat(l.unitAmount),
      baseAmount: parseFloat(l.baseAmount),
      calculatedAmount: parseFloat(l.calculatedAmount),
      finalAmount: parseFloat(l.finalAmount)
    }));

    // Separar haberes y deducciones
    const earnings = processedLines.filter(l => l.type === 'EARNING');
    const deductions = processedLines.filter(l => l.type === 'DEDUCTION');
    const employerCosts = processedLines.filter(l => l.type === 'EMPLOYER_COST');

    return NextResponse.json({
      period: {
        type: run.period_type,
        year: Number(run.year),
        month: Number(run.month),
        start: run.period_start,
        end: run.period_end,
        paymentDate: run.payment_date,
        categoryName: run.category_name
      },
      run: {
        id: runId,
        number: Number(run.run_number),
        status: run.status
      },
      employee: {
        id: item.employeeId,
        name: item.employeeName,
        hireDate: item.hireDate,
        snapshot: item.employeeSnapshot,
        daysWorked: Number(item.daysWorked),
        daysInPeriod: Number(item.daysInPeriod),
        prorateFactor: parseFloat(item.prorateFactor)
      },
      totals: {
        baseSalary: parseFloat(item.baseSalary),
        grossRemunerative: parseFloat(item.grossRemunerative),
        grossTotal: parseFloat(item.grossTotal),
        totalDeductions: parseFloat(item.totalDeductions),
        advancesDiscounted: parseFloat(item.advancesDiscounted),
        netSalary: parseFloat(item.netSalary),
        employerCost: parseFloat(item.employerCost)
      },
      lines: {
        earnings,
        deductions,
        employerCosts,
        all: processedLines
      }
    });
  } catch (error) {
    console.error('Error obteniendo detalle de empleado:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
