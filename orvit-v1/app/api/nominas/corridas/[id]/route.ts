import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getPayrollAuth, hasPayrollAccess } from '@/lib/nominas/auth-helper';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: { id: string };
}

// GET - Obtener detalle de una corrida
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await getPayrollAuth();
    if (!auth) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const runId = parseInt(params.id);
    if (isNaN(runId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    // Obtener corrida con info del período
    const runResult = await prisma.$queryRaw<any[]>`
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
        pr.paid_by as "paidBy",
        pr.locked_at as "lockedAt",
        pr.locked_by as "lockedBy",
        pr.voided_at as "voidedAt",
        pr.voided_by as "voidedBy",
        pr.void_reason as "voidReason",
        pr.notes,
        pr.created_at as "createdAt",
        pp.period_type as "periodType",
        pp.year,
        pp.month,
        pp.period_start as "periodStart",
        pp.period_end as "periodEnd",
        pp.payment_date as "paymentDate",
        ec.name as "categoryName"
      FROM payroll_runs pr
      JOIN payroll_periods pp ON pp.id = pr.period_id
      LEFT JOIN employee_categories ec ON ec.id = pp.category_id
      WHERE pr.id = ${runId}
        AND pr.company_id = ${auth.companyId}
    `;

    if (runResult.length === 0) {
      return NextResponse.json({ error: 'Corrida no encontrada' }, { status: 404 });
    }

    const run = runResult[0];

    // Obtener items (empleados)
    const items = await prisma.$queryRaw<any[]>`
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
        e.name as "employeeName"
      FROM payroll_run_items pri
      JOIN employees e ON e.id = pri.employee_id
      WHERE pri.run_id = ${runId}
      ORDER BY e.name ASC
    `;

    const processedItems = items.map((item: any) => ({
      ...item,
      id: Number(item.id),
      daysWorked: Number(item.daysWorked),
      daysInPeriod: Number(item.daysInPeriod),
      prorateFactor: parseFloat(item.prorateFactor),
      baseSalary: parseFloat(item.baseSalary),
      grossRemunerative: parseFloat(item.grossRemunerative),
      grossTotal: parseFloat(item.grossTotal),
      totalDeductions: parseFloat(item.totalDeductions),
      advancesDiscounted: parseFloat(item.advancesDiscounted),
      netSalary: parseFloat(item.netSalary),
      employerCost: parseFloat(item.employerCost)
    }));

    return NextResponse.json({
      run: {
        ...run,
        id: Number(run.id),
        periodId: Number(run.periodId),
        companyId: Number(run.companyId),
        runNumber: Number(run.runNumber),
        totalGross: parseFloat(run.totalGross),
        totalDeductions: parseFloat(run.totalDeductions),
        totalNet: parseFloat(run.totalNet),
        totalEmployerCost: parseFloat(run.totalEmployerCost),
        employeeCount: Number(run.employeeCount),
        year: Number(run.year),
        month: Number(run.month)
      },
      items: processedItems
    });
  } catch (error) {
    console.error('Error obteniendo corrida:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// PUT - Actualizar estado de corrida (aprobar, cerrar, anular)
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await getPayrollAuth();
    if (!auth || !hasPayrollAccess(auth.user)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const runId = parseInt(params.id);
    if (isNaN(runId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const body = await request.json();
    const { action, notes, voidReason } = body;

    // Verificar corrida
    const runResult = await prisma.$queryRaw<any[]>`
      SELECT id, status, locked_at
      FROM payroll_runs
      WHERE id = ${runId} AND company_id = ${auth.companyId}
    `;

    if (runResult.length === 0) {
      return NextResponse.json({ error: 'Corrida no encontrada' }, { status: 404 });
    }

    const currentRun = runResult[0];

    // Validar transiciones de estado
    if (currentRun.locked_at && action !== 'VOID') {
      return NextResponse.json(
        { error: 'La corrida está cerrada y no puede modificarse' },
        { status: 400 }
      );
    }

    let updateQuery = '';
    let auditAction = action;

    switch (action) {
      case 'APPROVE':
        if (currentRun.status !== 'CALCULATED') {
          return NextResponse.json(
            { error: 'Solo se pueden aprobar corridas calculadas' },
            { status: 400 }
          );
        }
        await prisma.$queryRaw`
          UPDATE payroll_runs
          SET
            status = 'APPROVED',
            approved_at = NOW(),
            approved_by = ${auth.user.id},
            notes = COALESCE(${notes}, notes),
            updated_at = NOW()
          WHERE id = ${runId}
        `;
        break;

      case 'LOCK':
        if (currentRun.status !== 'APPROVED' && currentRun.status !== 'PAID') {
          return NextResponse.json(
            { error: 'Solo se pueden cerrar corridas aprobadas o pagadas' },
            { status: 400 }
          );
        }
        await prisma.$queryRaw`
          UPDATE payroll_runs
          SET
            locked_at = NOW(),
            locked_by = ${auth.user.id},
            notes = COALESCE(${notes}, notes),
            updated_at = NOW()
          WHERE id = ${runId}
        `;
        auditAction = 'LOCKED';
        break;

      case 'PAY':
        if (currentRun.status !== 'APPROVED') {
          return NextResponse.json(
            { error: 'Solo se pueden pagar corridas aprobadas' },
            { status: 400 }
          );
        }
        await prisma.$queryRaw`
          UPDATE payroll_runs
          SET
            status = 'PAID',
            paid_at = NOW(),
            paid_by = ${auth.user.id},
            notes = COALESCE(${notes}, notes),
            updated_at = NOW()
          WHERE id = ${runId}
        `;
        break;

      case 'VOID':
        if (!voidReason) {
          return NextResponse.json(
            { error: 'Se requiere una razón para anular' },
            { status: 400 }
          );
        }
        await prisma.$queryRaw`
          UPDATE payroll_runs
          SET
            status = 'VOID',
            voided_at = NOW(),
            voided_by = ${auth.user.id},
            void_reason = ${voidReason},
            updated_at = NOW()
          WHERE id = ${runId}
        `;
        break;

      default:
        return NextResponse.json(
          { error: 'Acción no válida' },
          { status: 400 }
        );
    }

    // Log de auditoría
    await prisma.$queryRaw`
      INSERT INTO payroll_audit_logs (run_id, action, user_id, details, created_at)
      VALUES (
        ${runId},
        ${auditAction},
        ${auth.user.id},
        ${JSON.stringify({ notes, voidReason })}::jsonb,
        NOW()
      )
    `;

    // Obtener corrida actualizada
    const updated = await prisma.$queryRaw<any[]>`
      SELECT status, approved_at, paid_at, locked_at, voided_at
      FROM payroll_runs WHERE id = ${runId}
    `;

    return NextResponse.json({
      success: true,
      run: updated[0]
    });
  } catch (error) {
    console.error('Error actualizando corrida:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// DELETE - Eliminar corrida (solo si está en DRAFT)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await getPayrollAuth();
    if (!auth || !hasPayrollAccess(auth.user)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const runId = parseInt(params.id);
    if (isNaN(runId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    // Verificar corrida
    const runResult = await prisma.$queryRaw<any[]>`
      SELECT id, status FROM payroll_runs
      WHERE id = ${runId} AND company_id = ${auth.companyId}
    `;

    if (runResult.length === 0) {
      return NextResponse.json({ error: 'Corrida no encontrada' }, { status: 404 });
    }

    if (runResult[0].status !== 'DRAFT' && runResult[0].status !== 'CALCULATED') {
      return NextResponse.json(
        { error: 'Solo se pueden eliminar corridas en borrador o calculadas' },
        { status: 400 }
      );
    }

    // Eliminar líneas de items
    await prisma.$queryRaw`
      DELETE FROM payroll_run_item_lines
      WHERE run_item_id IN (SELECT id FROM payroll_run_items WHERE run_id = ${runId})
    `;

    // Eliminar items
    await prisma.$queryRaw`
      DELETE FROM payroll_run_items WHERE run_id = ${runId}
    `;

    // Eliminar logs de auditoría
    await prisma.$queryRaw`
      DELETE FROM payroll_audit_logs WHERE run_id = ${runId}
    `;

    // Eliminar corrida
    await prisma.$queryRaw`
      DELETE FROM payroll_runs WHERE id = ${runId}
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error eliminando corrida:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
