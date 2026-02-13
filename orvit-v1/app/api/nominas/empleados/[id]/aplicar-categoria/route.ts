import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getPayrollAuth, hasPayrollAccess } from '@/lib/nominas/auth-helper';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: { id: string };
}

// POST - Aplicar conceptos default de una categoría a un empleado
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await getPayrollAuth();
    if (!auth || !hasPayrollAccess(auth.user)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const employeeId = params.id;
    const body = await request.json();
    const {
      categoryId,
      effectiveFrom,
      replaceExisting = false // Si true, desactiva conceptos existentes
    } = body;

    if (!categoryId || !effectiveFrom) {
      return NextResponse.json(
        { error: 'categoryId y effectiveFrom son requeridos' },
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

    // Verificar categoría y obtener sus conceptos default
    const categoryDefaults = await prisma.$queryRaw<any[]>`
      SELECT
        cdc.component_id,
        cdc.quantity,
        cdc.unit_amount,
        cdc.comment,
        cdc.no_delete,
        sc.code as component_code,
        sc.name as component_name
      FROM category_default_concepts cdc
      JOIN salary_components sc ON sc.id = cdc.component_id
      JOIN employee_categories ec ON ec.id = cdc.category_id
      WHERE cdc.category_id = ${parseInt(categoryId)}
        AND ec.company_id = ${auth.companyId}
      ORDER BY cdc."order" ASC
    `;

    if (categoryDefaults.length === 0) {
      return NextResponse.json(
        { error: 'La categoría no tiene conceptos default definidos' },
        { status: 400 }
      );
    }

    // Si replaceExisting, desactivar conceptos actuales
    if (replaceExisting) {
      await prisma.$queryRaw`
        UPDATE employee_fixed_concepts
        SET
          is_active = false,
          effective_to = ${new Date(effectiveFrom)}::date - interval '1 day',
          updated_at = NOW()
        WHERE employee_id = ${employeeId}
          AND is_active = true
          AND effective_to IS NULL
      `;
    }

    // Obtener tasa de convenio vigente para la categoría
    const currentRate = await prisma.$queryRaw<any[]>`
      SELECT daily_rate, presenteeism_rate
      FROM agreement_rates
      WHERE category_id = ${parseInt(categoryId)}
        AND effective_from <= ${new Date(effectiveFrom)}::date
        AND (effective_to IS NULL OR effective_to >= ${new Date(effectiveFrom)}::date)
      ORDER BY effective_from DESC
      LIMIT 1
    `;

    const dailyRate = currentRate.length > 0 ? parseFloat(currentRate[0].daily_rate) : 0;
    const presenteeismRate = currentRate.length > 0 && currentRate[0].presenteeism_rate
      ? parseFloat(currentRate[0].presenteeism_rate)
      : 0;

    // Crear conceptos fijos para el empleado
    const createdConcepts = [];
    for (const def of categoryDefaults) {
      // Determinar el valor unitario
      let unitAmount = parseFloat(def.unit_amount);

      // Si el componente está vinculado a convenio, usar la tasa
      const componentCode = def.component_code.toUpperCase();
      if (componentCode.includes('FIJO') || componentCode.includes('BASICO') || componentCode.includes('DIARIO')) {
        if (dailyRate > 0) {
          unitAmount = dailyRate;
        }
      } else if (componentCode.includes('PRESENT')) {
        if (presenteeismRate > 0) {
          unitAmount = presenteeismRate;
        }
      }

      // Verificar si ya existe un concepto activo para este componente
      const existingConcept = await prisma.$queryRaw<any[]>`
        SELECT id FROM employee_fixed_concepts
        WHERE employee_id = ${employeeId}
          AND component_id = ${def.component_id}
          AND is_active = true
          AND effective_to IS NULL
      `;

      // Solo crear si no existe o si replaceExisting
      if (existingConcept.length === 0 || replaceExisting) {
        const result = await prisma.$queryRaw<any[]>`
          INSERT INTO employee_fixed_concepts (
            employee_id, component_id, quantity, unit_amount, comment,
            no_delete, effective_from, source, is_active,
            created_at, updated_at, created_by
          )
          VALUES (
            ${employeeId},
            ${def.component_id},
            ${parseFloat(def.quantity)},
            ${unitAmount},
            ${def.comment || `Aplicado desde categoría`},
            ${def.no_delete},
            ${new Date(effectiveFrom)}::date,
            'CATEGORY_DEFAULT',
            true,
            NOW(),
            NOW(),
            ${auth.user.id}
          )
          RETURNING id, component_id as "componentId"
        `;

        createdConcepts.push({
          id: Number(result[0].id),
          componentId: Number(result[0].componentId),
          componentCode: def.component_code,
          componentName: def.component_name,
          quantity: parseFloat(def.quantity),
          unitAmount
        });
      }
    }

    // Actualizar la categoría del empleado
    await prisma.$queryRaw`
      UPDATE employees
      SET category_id = ${parseInt(categoryId)}, updated_at = NOW()
      WHERE id = ${employeeId}
    `;

    return NextResponse.json({
      success: true,
      employeeId,
      categoryId: parseInt(categoryId),
      createdConcepts,
      ratesApplied: {
        dailyRate,
        presenteeismRate
      }
    });
  } catch (error) {
    console.error('Error aplicando categoría:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
