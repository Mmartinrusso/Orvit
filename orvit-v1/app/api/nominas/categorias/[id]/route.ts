import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getPayrollAuth, hasPayrollAccess } from '@/lib/nominas/auth-helper';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: { id: string };
}

// GET - Obtener una categoría específica
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await getPayrollAuth();
    if (!auth) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const categoryId = parseInt(params.id);
    if (isNaN(categoryId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const result = await prisma.$queryRaw<any[]>`
      SELECT
        ec.id,
        ec.name,
        ec.description,
        ec.is_active as "isActive",
        ec.company_id as "companyId",
        ec.gremio,
        ec.convention_code as "conventionCode",
        ec.payment_schedule_type as "paymentScheduleType",
        ec.payment_rule_json as "paymentRuleJson",
        ec.attendance_policy_json as "attendancePolicyJson",
        ec.created_at as "createdAt",
        ec.updated_at as "updatedAt",
        (
          SELECT COUNT(*)::int
          FROM employees e
          WHERE e.category_id = ec.id AND e.active = true
        ) as "employeeCount"
      FROM employee_categories ec
      WHERE ec.id = ${categoryId}
        AND ec.company_id = ${auth.companyId}
    `;

    if (result.length === 0) {
      return NextResponse.json({ error: 'Categoría no encontrada' }, { status: 404 });
    }

    const category = result[0];
    return NextResponse.json({
      ...category,
      id: Number(category.id),
      companyId: Number(category.companyId),
      employeeCount: Number(category.employeeCount || 0)
    });
  } catch (error) {
    console.error('Error obteniendo categoría:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// PUT - Actualizar categoría
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await getPayrollAuth();
    if (!auth || !hasPayrollAccess(auth.user)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const categoryId = parseInt(params.id);
    if (isNaN(categoryId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const body = await request.json();
    const {
      name,
      description,
      gremio,
      conventionCode,
      paymentScheduleType,
      paymentRuleJson,
      attendancePolicyJson,
      isActive
    } = body;

    // Validar que exista y pertenezca a la empresa
    const existing = await prisma.$queryRaw<any[]>`
      SELECT id FROM employee_categories
      WHERE id = ${categoryId} AND company_id = ${auth.companyId}
    `;

    if (existing.length === 0) {
      return NextResponse.json({ error: 'Categoría no encontrada' }, { status: 404 });
    }

    // Validar paymentScheduleType si se envía
    if (paymentScheduleType) {
      const validTypes = ['BIWEEKLY_FIXED', 'BIWEEKLY_1_15_16_EOM', 'MONTHLY_SAME_MONTH', 'MONTHLY_NEXT_MONTH'];
      if (!validTypes.includes(paymentScheduleType)) {
        return NextResponse.json(
          { error: 'Tipo de pago inválido' },
          { status: 400 }
        );
      }
    }

    const result = await prisma.$queryRaw<any[]>`
      UPDATE employee_categories
      SET
        name = COALESCE(${name}, name),
        description = ${description !== undefined ? description : null},
        gremio = ${gremio !== undefined ? gremio : null},
        convention_code = ${conventionCode !== undefined ? conventionCode : null},
        payment_schedule_type = COALESCE(${paymentScheduleType}, payment_schedule_type),
        payment_rule_json = ${paymentRuleJson ? JSON.stringify(paymentRuleJson) : null}::jsonb,
        attendance_policy_json = ${attendancePolicyJson ? JSON.stringify(attendancePolicyJson) : null}::jsonb,
        is_active = COALESCE(${isActive}, is_active),
        updated_at = NOW()
      WHERE id = ${categoryId} AND company_id = ${auth.companyId}
      RETURNING
        id,
        name,
        description,
        is_active as "isActive",
        company_id as "companyId",
        gremio,
        convention_code as "conventionCode",
        payment_schedule_type as "paymentScheduleType",
        payment_rule_json as "paymentRuleJson",
        attendance_policy_json as "attendancePolicyJson",
        created_at as "createdAt",
        updated_at as "updatedAt"
    `;

    const updated = result[0];
    return NextResponse.json({
      ...updated,
      id: Number(updated.id),
      companyId: Number(updated.companyId)
    });
  } catch (error) {
    console.error('Error actualizando categoría:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// DELETE - Eliminar categoría (soft delete)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await getPayrollAuth();
    if (!auth || !hasPayrollAccess(auth.user)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const categoryId = parseInt(params.id);
    if (isNaN(categoryId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    // Verificar si hay empleados activos en la categoría
    const employeesCount = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count
      FROM employees
      WHERE category_id = ${categoryId} AND active = true
    `;

    if (Number(employeesCount[0].count) > 0) {
      return NextResponse.json(
        { error: 'No se puede eliminar una categoría con empleados activos' },
        { status: 400 }
      );
    }

    // Soft delete
    await prisma.$queryRaw`
      UPDATE employee_categories
      SET is_active = false, updated_at = NOW()
      WHERE id = ${categoryId} AND company_id = ${auth.companyId}
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error eliminando categoría:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
