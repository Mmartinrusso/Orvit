import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getPayrollAuth, hasPayrollAccess } from '@/lib/nominas/auth-helper';

export const dynamic = 'force-dynamic';

// GET - Obtener corridas de un período
export async function GET(request: NextRequest) {
  try {
    const auth = await getPayrollAuth();
    if (!auth) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const periodId = searchParams.get('periodId');

    if (!periodId) {
      return NextResponse.json(
        { error: 'periodId es requerido' },
        { status: 400 }
      );
    }

    const runs = await prisma.$queryRaw<any[]>`
      SELECT
        pr.id,
        pr.period_id as "periodId",
        pr.company_id as "companyId",
        pr.run_number as "runNumber",
        pr.run_type as "runType",
        pr.status,
        pr.total_gross as "totalGross",
        pr.total_deductions as "totalDeductions",
        pr.total_net as "totalNet",
        pr.total_employer_cost as "totalEmployerCost",
        pr.employee_count as "employeeCount",
        pr.calculated_at as "calculatedAt",
        pr.calculated_by as "calculatedBy",
        pr.approved_at as "approvedAt",
        pr.approved_by as "approvedBy",
        pr.paid_at as "paidAt",
        pr.locked_at as "lockedAt",
        pr.voided_at as "voidedAt",
        pr.void_reason as "voidReason",
        pr.notes,
        pr.created_at as "createdAt"
      FROM payroll_runs pr
      JOIN payroll_periods pp ON pp.id = pr.period_id
      WHERE pr.period_id = ${parseInt(periodId)}
        AND pp.company_id = ${auth.companyId}
      ORDER BY pr.run_number DESC
    `;

    const processedRuns = runs.map((r: any) => ({
      ...r,
      id: Number(r.id),
      periodId: Number(r.periodId),
      companyId: Number(r.companyId),
      runNumber: Number(r.runNumber),
      totalGross: parseFloat(r.totalGross),
      totalDeductions: parseFloat(r.totalDeductions),
      totalNet: parseFloat(r.totalNet),
      totalEmployerCost: parseFloat(r.totalEmployerCost),
      employeeCount: Number(r.employeeCount)
    }));

    return NextResponse.json(processedRuns);
  } catch (error) {
    console.error('Error obteniendo corridas:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// POST - Crear nueva corrida y calcular
export async function POST(request: NextRequest) {
  try {
    const auth = await getPayrollAuth();
    if (!auth || !hasPayrollAccess(auth.user)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const {
      periodId,
      runType = 'REGULAR', // REGULAR | ADJUSTMENT | RETROACTIVE
      notes
    } = body;

    if (!periodId) {
      return NextResponse.json(
        { error: 'periodId es requerido' },
        { status: 400 }
      );
    }

    // Verificar período y obtener datos
    const period = await prisma.$queryRaw<any[]>`
      SELECT
        pp.id, pp.company_id, pp.union_id, pp.period_type,
        pp.year, pp.month, pp.period_start, pp.period_end,
        pp.business_days, pp.is_closed,
        pu.name as union_name, pu.code as union_code,
        pu.convention_code, pu.attendance_policy_json
      FROM payroll_periods pp
      LEFT JOIN payroll_unions pu ON pu.id = pp.union_id
      WHERE pp.id = ${parseInt(periodId)}
        AND pp.company_id = ${auth.companyId}
    `;

    if (period.length === 0) {
      return NextResponse.json({ error: 'Período no encontrado' }, { status: 404 });
    }

    if (period[0].is_closed) {
      return NextResponse.json(
        { error: 'El período está cerrado' },
        { status: 400 }
      );
    }

    // Obtener último número de corrida
    const lastRun = await prisma.$queryRaw<any[]>`
      SELECT MAX(run_number)::int as max_run FROM payroll_runs
      WHERE period_id = ${parseInt(periodId)}
    `;

    const runNumber = (lastRun[0]?.max_run || 0) + 1;

    // Crear corrida en DRAFT con totales en 0
    const createResult = await prisma.$queryRaw<any[]>`
      INSERT INTO payroll_runs (
        period_id, company_id, run_number, run_type, status,
        total_gross, total_deductions, total_net, total_employer_cost,
        employee_count, notes, created_at, updated_at
      )
      VALUES (
        ${parseInt(periodId)},
        ${auth.companyId},
        ${runNumber},
        ${runType},
        'DRAFT',
        0, 0, 0, 0, 0,
        ${notes || null},
        NOW(), NOW()
      )
      RETURNING id
    `;

    const runId = Number(createResult[0].id);

    // Obtener empleados del gremio del período (a través de union_category)
    const unionFilter = period[0].union_id
      ? Prisma.sql`AND uc.union_id = ${period[0].union_id}`
      : Prisma.empty;

    const employees = await prisma.$queryRaw<any[]>`
      SELECT
        e.id, e.name, e.union_category_id, e.work_sector_id,
        e.hire_date, e.termination_date, e.gross_salary,
        uc.name as union_category_name, uc.union_id,
        ws.name as work_sector_name
      FROM employees e
      LEFT JOIN union_categories uc ON uc.id = e.union_category_id
      LEFT JOIN work_sectors ws ON ws.id = e.work_sector_id
      WHERE e.company_id = ${auth.companyId}
        AND e.active = true
        ${unionFilter}
    `;

    let totalGross = 0;
    let totalDeductions = 0;
    let totalNet = 0;
    let totalEmployerCost = 0;
    let employeeCount = 0;

    const periodStart = new Date(period[0].period_start);
    const periodEnd = new Date(period[0].period_end);

    for (const emp of employees) {
      // Calcular prorrateo por alta/baja
      let prorateFactor = 1;
      const hireDate = emp.hire_date ? new Date(emp.hire_date) : null;
      const termDate = emp.termination_date ? new Date(emp.termination_date) : null;

      if (hireDate && hireDate > periodStart) {
        // Entró durante el período
        const daysInPeriod = Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        const daysWorked = Math.ceil((periodEnd.getTime() - hireDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        prorateFactor = Math.min(daysWorked / daysInPeriod, 1);
      }

      if (termDate && termDate < periodEnd) {
        // Salió durante el período
        if (termDate < periodStart) {
          prorateFactor = 0; // No corresponde liquidar
          continue;
        }
        const daysInPeriod = Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        const daysWorked = Math.ceil((termDate.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        prorateFactor = Math.min(prorateFactor, daysWorked / daysInPeriod);
      }

      if (prorateFactor <= 0) continue;

      // Snapshot del empleado
      const snapshot = {
        unionId: emp.union_id,
        unionName: period[0].union_name,
        unionCategoryId: emp.union_category_id,
        unionCategoryName: emp.union_category_name,
        workSectorId: emp.work_sector_id,
        workSectorName: emp.work_sector_name,
        hireDate: emp.hire_date,
        baseSalary: parseFloat(emp.gross_salary || 0)
      };

      // Obtener conceptos fijos vigentes
      const fixedConcepts = await prisma.$queryRaw<any[]>`
        SELECT
          efc.id, efc.component_id, efc.quantity, efc.unit_amount,
          sc.code, sc.name, sc.type, sc.is_remunerative,
          sc.affects_employee_contrib, sc.affects_employer_contrib
        FROM employee_fixed_concepts efc
        JOIN salary_components sc ON sc.id = efc.component_id
        WHERE efc.employee_id = ${emp.id}
          AND efc.is_active = true
          AND efc.effective_from <= ${periodEnd}::date
          AND (efc.effective_to IS NULL OR efc.effective_to >= ${periodStart}::date)
        ORDER BY sc."order" ASC
      `;

      // Obtener conceptos variables aprobados
      const variableConcepts = await prisma.$queryRaw<any[]>`
        SELECT
          pvc.id, pvc.component_id, pvc.quantity, pvc.unit_amount,
          sc.code, sc.name, sc.type, sc.is_remunerative,
          sc.affects_employee_contrib, sc.affects_employer_contrib
        FROM payroll_variable_concepts pvc
        JOIN salary_components sc ON sc.id = pvc.component_id
        WHERE pvc.period_id = ${parseInt(periodId)}
          AND pvc.employee_id = ${emp.id}
          AND pvc.status = 'APPROVED'
        ORDER BY sc."order" ASC
      `;

      // Calcular líneas y totales
      const lines: any[] = [];
      let empGrossRemunerative = 0;
      let empGrossTotal = 0;
      let empDeductions = 0;
      let empEmployerContribBase = 0;

      // Procesar conceptos fijos
      for (const fc of fixedConcepts) {
        const qty = parseFloat(fc.quantity);
        const unitAmt = parseFloat(fc.unit_amount);
        const baseAmount = qty * unitAmt;
        const finalAmount = baseAmount * prorateFactor;

        lines.push({
          componentId: fc.component_id,
          code: fc.code,
          name: fc.name,
          type: fc.type,
          quantity: qty,
          unitAmount: unitAmt,
          baseAmount,
          calculatedAmount: finalAmount,
          finalAmount,
          isFixed: true
        });

        if (fc.type === 'EARNING') {
          empGrossTotal += finalAmount;
          if (fc.is_remunerative) {
            empGrossRemunerative += finalAmount;
          }
          if (fc.affects_employer_contrib) {
            empEmployerContribBase += finalAmount;
          }
        } else if (fc.type === 'DEDUCTION') {
          empDeductions += finalAmount;
        }
      }

      // Procesar conceptos variables
      for (const vc of variableConcepts) {
        const qty = parseFloat(vc.quantity);
        const unitAmt = parseFloat(vc.unit_amount);
        const finalAmount = qty * unitAmt; // Variables no se prorratean

        lines.push({
          componentId: vc.component_id,
          code: vc.code,
          name: vc.name,
          type: vc.type,
          quantity: qty,
          unitAmount: unitAmt,
          baseAmount: finalAmount,
          calculatedAmount: finalAmount,
          finalAmount,
          isFixed: false
        });

        if (vc.type === 'EARNING') {
          empGrossTotal += finalAmount;
          if (vc.is_remunerative) {
            empGrossRemunerative += finalAmount;
          }
          if (vc.affects_employer_contrib) {
            empEmployerContribBase += finalAmount;
          }
        } else if (vc.type === 'DEDUCTION') {
          empDeductions += finalAmount;
        }
      }

      // Calcular aportes automáticos (sobre bruto remunerativo)
      // Jubilación 11%
      const jubilacion = empGrossRemunerative * 0.11;
      lines.push({
        componentId: null,
        code: 'JUB',
        name: 'Jubilación (11%)',
        type: 'DEDUCTION',
        quantity: 1,
        unitAmount: jubilacion,
        baseAmount: empGrossRemunerative,
        calculatedAmount: jubilacion,
        finalAmount: jubilacion,
        isCalculated: true
      });
      empDeductions += jubilacion;

      // Obra Social 3%
      const obraSocial = empGrossRemunerative * 0.03;
      lines.push({
        componentId: null,
        code: 'OS',
        name: 'Obra Social (3%)',
        type: 'DEDUCTION',
        quantity: 1,
        unitAmount: obraSocial,
        baseAmount: empGrossRemunerative,
        calculatedAmount: obraSocial,
        finalAmount: obraSocial,
        isCalculated: true
      });
      empDeductions += obraSocial;

      // Ley 19032 (PAMI) 3%
      const ley19032 = empGrossRemunerative * 0.03;
      lines.push({
        componentId: null,
        code: 'L19032',
        name: 'Ley 19032 (3%)',
        type: 'DEDUCTION',
        quantity: 1,
        unitAmount: ley19032,
        baseAmount: empGrossRemunerative,
        calculatedAmount: ley19032,
        finalAmount: ley19032,
        isCalculated: true
      });
      empDeductions += ley19032;

      // Calcular neto
      const empNetSalary = empGrossTotal - empDeductions;

      // Calcular costo empleador (contribuciones patronales)
      // Jubilación patronal ~16%
      const jubPatronal = empEmployerContribBase * 0.16;
      // Obra Social patronal ~6%
      const osPatronal = empEmployerContribBase * 0.06;
      // ART ~3% (estimado)
      const art = empEmployerContribBase * 0.03;
      const empEmployerCost = empGrossTotal + jubPatronal + osPatronal + art;

      // Calcular días trabajados (simplificado)
      const daysInPeriod = Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      const daysWorked = Math.round(daysInPeriod * prorateFactor);

      // Crear item de corrida
      await prisma.$queryRaw`
        INSERT INTO payroll_run_items (
          run_id, employee_id, employee_snapshot,
          days_worked, days_in_period, prorate_factor,
          base_salary, gross_remunerative, gross_total,
          total_deductions, advances_discounted, net_salary, employer_cost
        )
        VALUES (
          ${runId},
          ${emp.id},
          ${JSON.stringify(snapshot)}::jsonb,
          ${daysWorked},
          ${daysInPeriod},
          ${prorateFactor},
          ${parseFloat(emp.gross_salary || 0)},
          ${empGrossRemunerative},
          ${empGrossTotal},
          ${empDeductions},
          0,
          ${empNetSalary},
          ${empEmployerCost}
        )
      `;

      // Obtener ID del item recién creado
      const itemResult = await prisma.$queryRaw<any[]>`
        SELECT id FROM payroll_run_items
        WHERE run_id = ${runId} AND employee_id = ${emp.id}
      `;
      const itemId = itemResult[0].id;

      // Insertar líneas de detalle
      for (const line of lines) {
        await prisma.$queryRaw`
          INSERT INTO payroll_run_item_lines (
            run_item_id, component_id, code, name, type,
            quantity, unit_amount, base_amount, calculated_amount, final_amount,
            formula_used, meta
          )
          VALUES (
            ${itemId},
            ${line.componentId},
            ${line.code},
            ${line.name},
            ${line.type},
            ${line.quantity},
            ${line.unitAmount},
            ${line.baseAmount},
            ${line.calculatedAmount},
            ${line.finalAmount},
            ${line.isCalculated ? 'PERCENTAGE' : null},
            ${JSON.stringify({ isFixed: line.isFixed || false, isCalculated: line.isCalculated || false })}::jsonb
          )
        `;
      }

      // Acumular totales
      totalGross += empGrossTotal;
      totalDeductions += empDeductions;
      totalNet += empNetSalary;
      totalEmployerCost += empEmployerCost;
      employeeCount++;
    }

    // Actualizar totales de la corrida
    await prisma.$queryRaw`
      UPDATE payroll_runs
      SET
        total_gross = ${totalGross},
        total_deductions = ${totalDeductions},
        total_net = ${totalNet},
        total_employer_cost = ${totalEmployerCost},
        employee_count = ${employeeCount},
        status = 'CALCULATED',
        calculated_at = NOW(),
        calculated_by = ${auth.user.id},
        updated_at = NOW()
      WHERE id = ${runId}
    `;

    // Log de auditoría
    await prisma.$queryRaw`
      INSERT INTO payroll_audit_logs (run_id, action, user_id, details, created_at)
      VALUES (
        ${runId},
        'CALCULATED',
        ${auth.user.id},
        ${JSON.stringify({ employeeCount, totalNet })}::jsonb,
        NOW()
      )
    `;

    return NextResponse.json({
      success: true,
      run: {
        id: runId,
        runNumber,
        runType,
        status: 'CALCULATED',
        totalGross,
        totalDeductions,
        totalNet,
        totalEmployerCost,
        employeeCount
      }
    }, { status: 201 });
  } catch (error) {
    console.error('Error calculando corrida:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
