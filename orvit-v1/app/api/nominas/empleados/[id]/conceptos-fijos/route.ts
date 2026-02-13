import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getPayrollAuth, hasPayrollAccess } from '@/lib/nominas/auth-helper';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: { id: string };
}

// GET - Obtener conceptos fijos de un empleado
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await getPayrollAuth();
    if (!auth) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const employeeId = params.id;
    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get('includeInactive') === 'true';
    const asOfDate = searchParams.get('asOfDate'); // Para ver conceptos vigentes en una fecha específica

    // Verificar que el empleado pertenece a la empresa y obtener datos de gremio/categoría
    const employee = await prisma.$queryRaw<any[]>`
      SELECT
        e.id,
        e.name,
        e.union_category_id as "unionCategoryId",
        uc.name as "unionCategoryName",
        uc.union_id as "unionId",
        pu.name as "unionName",
        e.work_sector_id as "workSectorId",
        ws.name as "workSectorName"
      FROM employees e
      LEFT JOIN union_categories uc ON uc.id = e.union_category_id
      LEFT JOIN payroll_unions pu ON pu.id = uc.union_id
      LEFT JOIN work_sectors ws ON ws.id = e.work_sector_id
      WHERE e.id = ${employeeId} AND e.company_id = ${auth.companyId}
    `;

    if (employee.length === 0) {
      return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 });
    }

    // Obtener tasa de convenio vigente si tiene categoría
    let currentRate = null;
    if (employee[0].unionCategoryId) {
      const rates = await prisma.$queryRaw<any[]>`
        SELECT
          ar.daily_rate as "dailyRate",
          ar.hourly_rate as "hourlyRate",
          ar.presenteeism_rate as "presenteeismRate",
          ar.seniority_pct as "seniorityPct",
          ar.effective_from as "effectiveFrom"
        FROM agreement_rates ar
        WHERE ar.union_category_id = ${employee[0].unionCategoryId}
          AND ar.effective_from <= CURRENT_DATE
          AND (ar.effective_to IS NULL OR ar.effective_to >= CURRENT_DATE)
        ORDER BY ar.effective_from DESC
        LIMIT 1
      `;
      if (rates.length > 0) {
        currentRate = {
          dailyRate: parseFloat(rates[0].dailyRate),
          hourlyRate: rates[0].hourlyRate ? parseFloat(rates[0].hourlyRate) : null,
          presenteeismRate: rates[0].presenteeismRate ? parseFloat(rates[0].presenteeismRate) : null,
          seniorityPct: rates[0].seniorityPct ? parseFloat(rates[0].seniorityPct) : null,
          effectiveFrom: rates[0].effectiveFrom
        };
      }
    }

    // Query base para conceptos fijos
    const activeFilter = includeInactive
      ? Prisma.empty
      : Prisma.sql`AND efc.is_active = true`;

    const concepts = await prisma.$queryRaw<any[]>`
      SELECT
        efc.id,
        efc.employee_id as "employeeId",
        efc.component_id as "componentId",
        efc.quantity,
        efc.unit_amount as "unitAmount",
        efc.comment,
        efc.no_delete as "noDelete",
        efc.effective_from as "effectiveFrom",
        efc.effective_to as "effectiveTo",
        efc.source,
        efc.is_active as "isActive",
        efc.created_at as "createdAt",
        efc.updated_at as "updatedAt",
        sc.code as "componentCode",
        sc.name as "componentName",
        sc.type as "componentType",
        sc.concept_type as "conceptType",
        sc.is_remunerative as "isRemunerative",
        CASE
          WHEN efc.effective_from <= CURRENT_DATE
            AND (efc.effective_to IS NULL OR efc.effective_to >= CURRENT_DATE)
            AND efc.is_active = true
          THEN true
          ELSE false
        END as "isCurrent"
      FROM employee_fixed_concepts efc
      JOIN salary_components sc ON sc.id = efc.component_id
      WHERE efc.employee_id = ${employeeId}
        ${activeFilter}
      ORDER BY sc."order" ASC, efc.effective_from DESC
    `;

    const processedConcepts = concepts.map((c: any) => ({
      ...c,
      id: Number(c.id),
      componentId: Number(c.componentId),
      quantity: parseFloat(c.quantity),
      unitAmount: parseFloat(c.unitAmount),
      total: parseFloat(c.quantity) * parseFloat(c.unitAmount)
    }));

    // Calcular totales por tipo
    const currentConcepts = processedConcepts.filter(c => c.isCurrent);
    const totals = {
      earnings: currentConcepts
        .filter(c => c.componentType === 'EARNING')
        .reduce((sum, c) => sum + c.total, 0),
      deductions: currentConcepts
        .filter(c => c.componentType === 'DEDUCTION')
        .reduce((sum, c) => sum + c.total, 0),
      remunerative: currentConcepts
        .filter(c => c.isRemunerative && c.componentType === 'EARNING')
        .reduce((sum, c) => sum + c.total, 0)
    };

    return NextResponse.json({
      employee: {
        id: employee[0].id,
        name: employee[0].name,
        unionCategoryId: employee[0].unionCategoryId ? Number(employee[0].unionCategoryId) : null,
        unionCategoryName: employee[0].unionCategoryName,
        unionId: employee[0].unionId ? Number(employee[0].unionId) : null,
        unionName: employee[0].unionName,
        workSectorId: employee[0].workSectorId ? Number(employee[0].workSectorId) : null,
        workSectorName: employee[0].workSectorName,
        currentRate
      },
      concepts: processedConcepts,
      totals
    });
  } catch (error) {
    console.error('Error obteniendo conceptos fijos:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// POST - Agregar concepto fijo a un empleado
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await getPayrollAuth();
    if (!auth || !hasPayrollAccess(auth.user)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const employeeId = params.id;
    const body = await request.json();
    const {
      componentId,
      quantity = 1,
      unitAmount,
      comment,
      noDelete = false,
      effectiveFrom,
      effectiveTo,
      source = 'MANUAL'
    } = body;

    if (!componentId || unitAmount === undefined || !effectiveFrom) {
      return NextResponse.json(
        { error: 'componentId, unitAmount y effectiveFrom son requeridos' },
        { status: 400 }
      );
    }

    // Verificar empleado
    const employee = await prisma.$queryRaw<any[]>`
      SELECT id FROM employees
      WHERE id = ${employeeId} AND company_id = ${auth.companyId}
    `;

    if (employee.length === 0) {
      return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 });
    }

    // Verificar componente
    const component = await prisma.$queryRaw<any[]>`
      SELECT id, code, name, type, concept_type, is_remunerative
      FROM salary_components
      WHERE id = ${parseInt(componentId)} AND company_id = ${auth.companyId}
    `;

    if (component.length === 0) {
      return NextResponse.json({ error: 'Componente no encontrado' }, { status: 404 });
    }

    // Cerrar concepto anterior del mismo componente si existe
    await prisma.$queryRaw`
      UPDATE employee_fixed_concepts
      SET
        effective_to = ${new Date(effectiveFrom)}::date - interval '1 day',
        updated_at = NOW()
      WHERE employee_id = ${employeeId}
        AND component_id = ${parseInt(componentId)}
        AND is_active = true
        AND effective_to IS NULL
        AND effective_from < ${new Date(effectiveFrom)}::date
    `;

    const result = await prisma.$queryRaw<any[]>`
      INSERT INTO employee_fixed_concepts (
        employee_id, component_id, quantity, unit_amount, comment,
        no_delete, effective_from, effective_to, source, is_active,
        created_at, updated_at, created_by
      )
      VALUES (
        ${employeeId},
        ${parseInt(componentId)},
        ${parseFloat(String(quantity))},
        ${parseFloat(String(unitAmount))},
        ${comment || null},
        ${noDelete},
        ${new Date(effectiveFrom)}::date,
        ${effectiveTo ? new Date(effectiveTo) : null}::date,
        ${source},
        true,
        NOW(),
        NOW(),
        ${auth.user.id}
      )
      RETURNING
        id,
        employee_id as "employeeId",
        component_id as "componentId",
        quantity,
        unit_amount as "unitAmount",
        comment,
        no_delete as "noDelete",
        effective_from as "effectiveFrom",
        effective_to as "effectiveTo",
        source,
        is_active as "isActive",
        created_at as "createdAt"
    `;

    const newConcept = result[0];
    return NextResponse.json({
      ...newConcept,
      id: Number(newConcept.id),
      componentId: Number(newConcept.componentId),
      quantity: parseFloat(newConcept.quantity),
      unitAmount: parseFloat(newConcept.unitAmount),
      total: parseFloat(newConcept.quantity) * parseFloat(newConcept.unitAmount),
      componentCode: component[0].code,
      componentName: component[0].name,
      componentType: component[0].type,
      conceptType: component[0].concept_type,
      isRemunerative: component[0].is_remunerative,
      isCurrent: true
    }, { status: 201 });
  } catch (error) {
    console.error('Error creando concepto fijo:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// PUT - Actualizar un concepto fijo
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await getPayrollAuth();
    if (!auth || !hasPayrollAccess(auth.user)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const employeeId = params.id;
    const body = await request.json();
    const {
      conceptId,
      quantity,
      unitAmount,
      comment,
      effectiveTo,
      isActive
    } = body;

    if (!conceptId) {
      return NextResponse.json(
        { error: 'conceptId es requerido' },
        { status: 400 }
      );
    }

    // Verificar que el concepto existe y pertenece al empleado
    const existing = await prisma.$queryRaw<any[]>`
      SELECT efc.id, efc.no_delete
      FROM employee_fixed_concepts efc
      JOIN employees e ON e.id = efc.employee_id
      WHERE efc.id = ${parseInt(conceptId)}
        AND efc.employee_id = ${employeeId}
        AND e.company_id = ${auth.companyId}
    `;

    if (existing.length === 0) {
      return NextResponse.json({ error: 'Concepto no encontrado' }, { status: 404 });
    }

    const result = await prisma.$queryRaw<any[]>`
      UPDATE employee_fixed_concepts
      SET
        quantity = COALESCE(${quantity !== undefined ? parseFloat(String(quantity)) : null}, quantity),
        unit_amount = COALESCE(${unitAmount !== undefined ? parseFloat(String(unitAmount)) : null}, unit_amount),
        comment = ${comment !== undefined ? comment : null},
        effective_to = ${effectiveTo !== undefined ? (effectiveTo ? new Date(effectiveTo) : null) : null}::date,
        is_active = COALESCE(${isActive}, is_active),
        updated_at = NOW()
      WHERE id = ${parseInt(conceptId)} AND employee_id = ${employeeId}
      RETURNING
        id,
        employee_id as "employeeId",
        component_id as "componentId",
        quantity,
        unit_amount as "unitAmount",
        comment,
        effective_from as "effectiveFrom",
        effective_to as "effectiveTo",
        is_active as "isActive",
        updated_at as "updatedAt"
    `;

    const updated = result[0];
    return NextResponse.json({
      ...updated,
      id: Number(updated.id),
      componentId: Number(updated.componentId),
      quantity: parseFloat(updated.quantity),
      unitAmount: parseFloat(updated.unitAmount),
      total: parseFloat(updated.quantity) * parseFloat(updated.unitAmount)
    });
  } catch (error) {
    console.error('Error actualizando concepto fijo:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// DELETE - Eliminar/desactivar un concepto fijo
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await getPayrollAuth();
    if (!auth || !hasPayrollAccess(auth.user)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const employeeId = params.id;
    const { searchParams } = new URL(request.url);
    const conceptId = searchParams.get('conceptId');

    if (!conceptId) {
      return NextResponse.json(
        { error: 'conceptId es requerido' },
        { status: 400 }
      );
    }

    // Verificar que el concepto existe y no está protegido
    const existing = await prisma.$queryRaw<any[]>`
      SELECT efc.id, efc.no_delete
      FROM employee_fixed_concepts efc
      JOIN employees e ON e.id = efc.employee_id
      WHERE efc.id = ${parseInt(conceptId)}
        AND efc.employee_id = ${employeeId}
        AND e.company_id = ${auth.companyId}
    `;

    if (existing.length === 0) {
      return NextResponse.json({ error: 'Concepto no encontrado' }, { status: 404 });
    }

    if (existing[0].no_delete) {
      return NextResponse.json(
        { error: 'Este concepto es obligatorio y no puede eliminarse' },
        { status: 400 }
      );
    }

    // Soft delete
    await prisma.$queryRaw`
      UPDATE employee_fixed_concepts
      SET is_active = false, effective_to = CURRENT_DATE, updated_at = NOW()
      WHERE id = ${parseInt(conceptId)} AND employee_id = ${employeeId}
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error eliminando concepto fijo:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
