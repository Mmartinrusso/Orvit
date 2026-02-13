/**
 * API de Generación de Liquidación
 *
 * POST /api/payroll/generate - Generar liquidación para un período
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getPayrollAuthUser } from '@/lib/payroll/auth-helper';
import { calculatePayroll, EmployeeData, AdvanceToDiscount } from '@/lib/payroll/calculator';
import { SalaryComponentData } from '@/lib/payroll/config';

export const dynamic = 'force-dynamic';

// POST - Generar liquidación
export async function POST(request: NextRequest) {
  try {
    const user = await getPayrollAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { periodId, notes } = body;

    if (!periodId) {
      return NextResponse.json({ error: 'periodId es requerido' }, { status: 400 });
    }

    // Obtener período
    const period = await prisma.payrollPeriod.findFirst({
      where: {
        id: periodId,
        company_id: user.companyId,
        is_closed: false,
      },
    });

    if (!period) {
      return NextResponse.json(
        { error: 'Período no encontrado o ya está cerrado' },
        { status: 404 }
      );
    }

    // Verificar que no exista una liquidación
    const existingPayroll = await prisma.payroll.findFirst({
      where: {
        period_id: periodId,
        status: { not: 'CANCELLED' },
      },
    });

    if (existingPayroll) {
      return NextResponse.json(
        { error: 'Ya existe una liquidación para este período' },
        { status: 400 }
      );
    }

    // Obtener empleados activos
    const employees = await prisma.employee.findMany({
      where: {
        company_id: user.companyId,
        active: true,
      },
    });

    if (employees.length === 0) {
      return NextResponse.json({ error: 'No hay empleados activos' }, { status: 400 });
    }

    // Obtener componentes salariales
    const componentsDb = await prisma.salaryComponent.findMany({
      where: {
        company_id: user.companyId,
        is_active: true,
      },
      orderBy: { order: 'asc' },
    });

    if (componentsDb.length === 0) {
      return NextResponse.json(
        { error: 'No hay componentes salariales configurados' },
        { status: 400 }
      );
    }

    // Obtener inputs del período
    const inputs = await prisma.payrollInput.findMany({
      where: { period_id: periodId },
    });

    // Obtener adelantos aprobados pendientes de descontar
    const advances = await prisma.salaryAdvance.findMany({
      where: {
        company_id: user.companyId,
        status: { in: ['APPROVED', 'ACTIVE'] },
        remaining_amount: { gt: 0 },
      },
      include: {
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

    const components: SalaryComponentData[] = componentsDb.map((c) => ({
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

    const advancesToDiscount: AdvanceToDiscount[] = advances
      .filter((a) => a.installments.length > 0)
      .map((a) => ({
        advanceId: a.id,
        installmentId: a.installments[0].id,
        amount: Number(a.installments[0].amount),
        employeeId: a.employee_id,
      }));

    const inputsData = inputs.map((i) => ({
      periodId: i.period_id,
      employeeId: i.employee_id,
      inputKey: i.input_key,
      inputValue: Number(i.input_value),
      meta: i.meta as Record<string, unknown> | undefined,
    }));

    // Calcular nómina
    const result = calculatePayroll(
      employeeData,
      components,
      {
        periodStart: period.period_start,
        periodEnd: period.period_end,
        businessDays: period.business_days,
      },
      inputsData,
      advancesToDiscount
    );

    // Crear liquidación en transacción
    const payroll = await prisma.$transaction(async (tx) => {
      // Crear payroll
      const newPayroll = await tx.payroll.create({
        data: {
          company_id: user.companyId,
          period_id: periodId,
          status: 'CALCULATED',
          total_gross: result.totals.totalGross,
          total_deductions: result.totals.totalDeductions,
          total_net: result.totals.totalNet,
          total_employer_cost: result.totals.totalEmployerCost,
          employee_count: result.totals.employeeCount,
          notes,
          calculated_at: new Date(),
          calculated_by: user.id,
        },
      });

      // Crear items
      for (const item of result.items) {
        const payrollItem = await tx.payrollItem.create({
          data: {
            payroll_id: newPayroll.id,
            employee_id: item.employeeId,
            cost_center_id: item.costCenterId,
            days_worked: item.daysWorked,
            days_in_period: item.daysInPeriod,
            prorate_factor: item.prorateFactor,
            base_salary: item.baseSalary,
            total_earnings: item.totalEarnings,
            total_deductions: item.totalDeductions,
            advances_discounted: item.advancesDiscounted,
            net_salary: item.netSalary,
            employer_cost: item.employerCost,
            snapshot: {
              employeeName: item.employeeName,
              calculatedAt: new Date().toISOString(),
            },
          },
        });

        // Crear líneas
        for (const line of item.lines) {
          await tx.payrollItemLine.create({
            data: {
              payroll_item_id: payrollItem.id,
              component_id: line.componentId,
              code: line.code,
              name: line.name,
              type: line.type,
              base_amount: line.baseAmount,
              calculated_amount: line.calculatedAmount,
              final_amount: line.finalAmount,
              formula_used: line.formulaUsed,
              meta: line.meta,
            },
          });
        }
      }

      // Actualizar adelantos descontados
      for (const adv of advancesToDiscount) {
        const employeeItem = result.items.find((i) => i.employeeId === adv.employeeId);
        if (employeeItem && employeeItem.advancesDiscounted > 0) {
          // Marcar cuota como descontada
          await tx.advanceInstallment.update({
            where: { id: adv.installmentId },
            data: {
              status: 'DISCOUNTED',
              discounted_at: new Date(),
            },
          });

          // Actualizar saldo del adelanto
          const advance = await tx.salaryAdvance.findUnique({
            where: { id: adv.advanceId },
          });

          if (advance) {
            const newRemaining = Number(advance.remaining_amount) - adv.amount;
            await tx.salaryAdvance.update({
              where: { id: adv.advanceId },
              data: {
                remaining_amount: newRemaining,
                status: newRemaining <= 0 ? 'COMPLETED' : 'ACTIVE',
                payroll_id: newPayroll.id,
              },
            });
          }
        }
      }

      // Crear log de auditoría
      await tx.payrollAuditLog.create({
        data: {
          payroll_id: newPayroll.id,
          action: 'CREATED',
          user_id: user.id,
          details: {
            periodType: period.period_type,
            employeeCount: result.totals.employeeCount,
            totalNet: result.totals.totalNet,
          },
        },
      });

      return newPayroll;
    });

    return NextResponse.json({
      success: true,
      payroll: {
        id: payroll.id,
        status: payroll.status,
        totalGross: Number(payroll.total_gross),
        totalDeductions: Number(payroll.total_deductions),
        totalNet: Number(payroll.total_net),
        totalEmployerCost: Number(payroll.total_employer_cost),
        employeeCount: payroll.employee_count,
      },
    });
  } catch (error) {
    console.error('Error generando liquidación:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
