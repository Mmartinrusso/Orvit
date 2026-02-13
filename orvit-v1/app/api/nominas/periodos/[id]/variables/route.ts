import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getPayrollAuth, hasPayrollAccess } from '@/lib/nominas/auth-helper';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: { id: string };
}

// GET - Obtener conceptos variables de un período
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await getPayrollAuth();
    if (!auth) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const periodId = parseInt(params.id);
    if (isNaN(periodId)) {
      return NextResponse.json({ error: 'ID de período inválido' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId');
    const status = searchParams.get('status');

    // Verificar que el período pertenece a la empresa
    const period = await prisma.$queryRaw<any[]>`
      SELECT pp.id, pp.period_type, pp.year, pp.month, ec.name as category_name
      FROM payroll_periods pp
      LEFT JOIN employee_categories ec ON ec.id = pp.category_id
      WHERE pp.id = ${periodId} AND pp.company_id = ${auth.companyId}
    `;

    if (period.length === 0) {
      return NextResponse.json({ error: 'Período no encontrado' }, { status: 404 });
    }

    // Construir filtros dinámicos
    const employeeFilter = employeeId
      ? Prisma.sql`AND pvc.employee_id = ${employeeId}`
      : Prisma.empty;
    const statusFilter = status
      ? Prisma.sql`AND pvc.status = ${status}`
      : Prisma.empty;

    const variables = await prisma.$queryRaw<any[]>`
      SELECT
        pvc.id,
        pvc.period_id as "periodId",
        pvc.employee_id as "employeeId",
        pvc.component_id as "componentId",
        pvc.quantity,
        pvc.unit_amount as "unitAmount",
        pvc.settlement_date as "settlementDate",
        pvc.transaction_date as "transactionDate",
        pvc.comment,
        pvc.status,
        pvc.source,
        pvc.created_by as "createdBy",
        pvc.approved_by as "approvedBy",
        pvc.approved_at as "approvedAt",
        pvc.created_at as "createdAt",
        e.name as "employeeName",
        sc.code as "componentCode",
        sc.name as "componentName",
        sc.type as "componentType",
        sc.is_remunerative as "isRemunerative"
      FROM payroll_variable_concepts pvc
      JOIN employees e ON e.id = pvc.employee_id
      JOIN salary_components sc ON sc.id = pvc.component_id
      WHERE pvc.period_id = ${periodId}
        ${employeeFilter}
        ${statusFilter}
      ORDER BY e.name ASC, sc."order" ASC
    `;

    const processedVariables = variables.map((v: any) => ({
      ...v,
      id: Number(v.id),
      periodId: Number(v.periodId),
      componentId: Number(v.componentId),
      quantity: parseFloat(v.quantity),
      unitAmount: parseFloat(v.unitAmount),
      total: parseFloat(v.quantity) * parseFloat(v.unitAmount),
      createdBy: v.createdBy ? Number(v.createdBy) : null,
      approvedBy: v.approvedBy ? Number(v.approvedBy) : null
    }));

    // Agrupar por empleado
    const byEmployee = processedVariables.reduce((acc: any, v: any) => {
      if (!acc[v.employeeId]) {
        acc[v.employeeId] = {
          employeeId: v.employeeId,
          employeeName: v.employeeName,
          concepts: [],
          totals: { earnings: 0, deductions: 0 }
        };
      }
      acc[v.employeeId].concepts.push(v);
      if (v.componentType === 'EARNING') {
        acc[v.employeeId].totals.earnings += v.total;
      } else {
        acc[v.employeeId].totals.deductions += v.total;
      }
      return acc;
    }, {});

    return NextResponse.json({
      period: {
        id: periodId,
        periodType: period[0].period_type,
        year: period[0].year,
        month: period[0].month,
        categoryName: period[0].category_name
      },
      variables: processedVariables,
      byEmployee: Object.values(byEmployee),
      summary: {
        total: processedVariables.length,
        draft: processedVariables.filter(v => v.status === 'DRAFT').length,
        approved: processedVariables.filter(v => v.status === 'APPROVED').length,
        void: processedVariables.filter(v => v.status === 'VOID').length
      }
    });
  } catch (error) {
    console.error('Error obteniendo conceptos variables:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// POST - Crear concepto variable
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await getPayrollAuth();
    if (!auth || !hasPayrollAccess(auth.user)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const periodId = parseInt(params.id);
    if (isNaN(periodId)) {
      return NextResponse.json({ error: 'ID de período inválido' }, { status: 400 });
    }

    const body = await request.json();
    const {
      employeeId,
      componentId,
      quantity = 1,
      unitAmount,
      settlementDate,
      transactionDate,
      comment,
      source = 'MANUAL',
      status = 'DRAFT'
    } = body;

    if (!employeeId || !componentId || unitAmount === undefined) {
      return NextResponse.json(
        { error: 'employeeId, componentId y unitAmount son requeridos' },
        { status: 400 }
      );
    }

    // Verificar período
    const period = await prisma.$queryRaw<any[]>`
      SELECT id, is_closed FROM payroll_periods
      WHERE id = ${periodId} AND company_id = ${auth.companyId}
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

    // Verificar empleado
    const employee = await prisma.$queryRaw<any[]>`
      SELECT id, name FROM employees
      WHERE id = ${employeeId} AND company_id = ${auth.companyId}
    `;

    if (employee.length === 0) {
      return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 });
    }

    // Verificar componente
    const component = await prisma.$queryRaw<any[]>`
      SELECT id, code, name, type, is_remunerative
      FROM salary_components
      WHERE id = ${parseInt(componentId)} AND company_id = ${auth.companyId}
    `;

    if (component.length === 0) {
      return NextResponse.json({ error: 'Componente no encontrado' }, { status: 404 });
    }

    const result = await prisma.$queryRaw<any[]>`
      INSERT INTO payroll_variable_concepts (
        period_id, employee_id, component_id,
        quantity, unit_amount, settlement_date, transaction_date,
        comment, status, source, created_by, created_at
      )
      VALUES (
        ${periodId},
        ${employeeId},
        ${parseInt(componentId)},
        ${parseFloat(String(quantity))},
        ${parseFloat(String(unitAmount))},
        ${settlementDate ? new Date(settlementDate) : null}::date,
        ${transactionDate ? new Date(transactionDate) : null}::date,
        ${comment || null},
        ${status},
        ${source},
        ${auth.user.id},
        NOW()
      )
      RETURNING
        id,
        period_id as "periodId",
        employee_id as "employeeId",
        component_id as "componentId",
        quantity,
        unit_amount as "unitAmount",
        settlement_date as "settlementDate",
        transaction_date as "transactionDate",
        comment,
        status,
        source,
        created_at as "createdAt"
    `;

    const newVariable = result[0];
    return NextResponse.json({
      ...newVariable,
      id: Number(newVariable.id),
      periodId: Number(newVariable.periodId),
      componentId: Number(newVariable.componentId),
      quantity: parseFloat(newVariable.quantity),
      unitAmount: parseFloat(newVariable.unitAmount),
      total: parseFloat(newVariable.quantity) * parseFloat(newVariable.unitAmount),
      employeeName: employee[0].name,
      componentCode: component[0].code,
      componentName: component[0].name,
      componentType: component[0].type,
      isRemunerative: component[0].is_remunerative
    }, { status: 201 });
  } catch (error) {
    console.error('Error creando concepto variable:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// PUT - Actualizar/aprobar concepto variable
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await getPayrollAuth();
    if (!auth || !hasPayrollAccess(auth.user)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const periodId = parseInt(params.id);
    const body = await request.json();
    const {
      variableId,
      quantity,
      unitAmount,
      comment,
      status // DRAFT, APPROVED, VOID
    } = body;

    if (!variableId) {
      return NextResponse.json(
        { error: 'variableId es requerido' },
        { status: 400 }
      );
    }

    // Verificar que existe
    const existing = await prisma.$queryRaw<any[]>`
      SELECT pvc.id, pvc.status
      FROM payroll_variable_concepts pvc
      JOIN payroll_periods pp ON pp.id = pvc.period_id
      WHERE pvc.id = ${parseInt(variableId)}
        AND pvc.period_id = ${periodId}
        AND pp.company_id = ${auth.companyId}
    `;

    if (existing.length === 0) {
      return NextResponse.json({ error: 'Concepto no encontrado' }, { status: 404 });
    }

    // Si está cambiando a APPROVED, registrar quién y cuándo
    const shouldSetApproval = status === 'APPROVED' && existing[0].status !== 'APPROVED';
    const approvalClause = shouldSetApproval
      ? Prisma.sql`, approved_by = ${auth.user.id}, approved_at = NOW()`
      : Prisma.empty;

    const result = await prisma.$queryRaw<any[]>`
      UPDATE payroll_variable_concepts
      SET
        quantity = COALESCE(${quantity !== undefined ? parseFloat(String(quantity)) : null}, quantity),
        unit_amount = COALESCE(${unitAmount !== undefined ? parseFloat(String(unitAmount)) : null}, unit_amount),
        comment = ${comment !== undefined ? comment : null},
        status = COALESCE(${status}, status)
        ${approvalClause}
      WHERE id = ${parseInt(variableId)}
      RETURNING
        id,
        quantity,
        unit_amount as "unitAmount",
        comment,
        status,
        approved_by as "approvedBy",
        approved_at as "approvedAt"
    `;

    const updated = result[0];
    return NextResponse.json({
      ...updated,
      id: Number(updated.id),
      quantity: parseFloat(updated.quantity),
      unitAmount: parseFloat(updated.unitAmount),
      total: parseFloat(updated.quantity) * parseFloat(updated.unitAmount)
    });
  } catch (error) {
    console.error('Error actualizando concepto variable:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// DELETE - Eliminar concepto variable
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await getPayrollAuth();
    if (!auth || !hasPayrollAccess(auth.user)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const periodId = parseInt(params.id);
    const { searchParams } = new URL(request.url);
    const variableId = searchParams.get('variableId');

    if (!variableId) {
      return NextResponse.json(
        { error: 'variableId es requerido' },
        { status: 400 }
      );
    }

    // Verificar que existe y no está aprobado
    const existing = await prisma.$queryRaw<any[]>`
      SELECT pvc.id, pvc.status
      FROM payroll_variable_concepts pvc
      JOIN payroll_periods pp ON pp.id = pvc.period_id
      WHERE pvc.id = ${parseInt(variableId)}
        AND pvc.period_id = ${periodId}
        AND pp.company_id = ${auth.companyId}
    `;

    if (existing.length === 0) {
      return NextResponse.json({ error: 'Concepto no encontrado' }, { status: 404 });
    }

    if (existing[0].status === 'APPROVED') {
      // En lugar de eliminar, marcar como VOID
      await prisma.$queryRaw`
        UPDATE payroll_variable_concepts
        SET status = 'VOID'
        WHERE id = ${parseInt(variableId)}
      `;
      return NextResponse.json({ success: true, action: 'voided' });
    }

    // Si está en DRAFT, eliminar directamente
    await prisma.$queryRaw`
      DELETE FROM payroll_variable_concepts
      WHERE id = ${parseInt(variableId)}
    `;

    return NextResponse.json({ success: true, action: 'deleted' });
  } catch (error) {
    console.error('Error eliminando concepto variable:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
