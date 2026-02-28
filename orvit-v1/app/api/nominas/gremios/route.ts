import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getPayrollAuth, hasPayrollAccess } from '@/lib/nominas/auth-helper';
import { hasUserPermission } from '@/lib/permissions-helpers';

export const dynamic = 'force-dynamic';

// GET - Listar gremios de la empresa
export async function GET(request: NextRequest) {
  try {
    const auth = await getPayrollAuth();
    if (!auth) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get('includeInactive') === 'true';
    const includeCategories = searchParams.get('includeCategories') === 'true';

    const activeCondition = !includeInactive
      ? Prisma.sql`AND pu.is_active = true`
      : Prisma.empty;

    const unions = await prisma.$queryRaw<any[]>`
      SELECT
        pu.id,
        pu.company_id as "companyId",
        pu.name,
        pu.code,
        pu.convention_code as "conventionCode",
        pu.payment_schedule_type as "paymentScheduleType",
        pu.payment_rule_json as "paymentRuleJson",
        pu.attendance_policy_json as "attendancePolicyJson",
        pu.contribution_rules_json as "contributionRulesJson",
        pu.is_active as "isActive",
        pu.created_at as "createdAt",
        pu.updated_at as "updatedAt",
        (
          SELECT COUNT(*)::int
          FROM union_categories uc
          WHERE uc.union_id = pu.id AND uc.is_active = true
        ) as "categoryCount",
        (
          SELECT COUNT(*)::int
          FROM employees e
          JOIN union_categories uc ON uc.id = e.union_category_id
          WHERE uc.union_id = pu.id AND e.active = true
        ) as "employeeCount"
      FROM payroll_unions pu
      WHERE pu.company_id = ${auth.companyId}
        ${activeCondition}
      ORDER BY pu.name ASC
    `;

    // Si se solicitan las categorías, obtenerlas
    let categoriesByUnion: Record<number, any[]> = {};
    if (includeCategories) {
      const categories = await prisma.$queryRaw<any[]>`
        SELECT
          uc.id,
          uc.union_id as "unionId",
          uc.name,
          uc.code,
          uc.description,
          uc.level,
          uc.is_active as "isActive",
          (
            SELECT COUNT(*)::int
            FROM employees e
            WHERE e.union_category_id = uc.id AND e.active = true
          ) as "employeeCount"
        FROM union_categories uc
        JOIN payroll_unions pu ON pu.id = uc.union_id
        WHERE pu.company_id = ${auth.companyId}
        ORDER BY uc.union_id, uc.level, uc.name
      `;

      // Agrupar por union_id
      for (const cat of categories) {
        if (!categoriesByUnion[cat.unionId]) {
          categoriesByUnion[cat.unionId] = [];
        }
        categoriesByUnion[cat.unionId].push({
          ...cat,
          id: Number(cat.id),
          unionId: Number(cat.unionId)
        });
      }
    }

    const processedUnions = unions.map((u: any) => ({
      ...u,
      id: Number(u.id),
      companyId: Number(u.companyId),
      categories: includeCategories ? (categoriesByUnion[u.id] || []) : undefined
    }));

    return NextResponse.json({
      unions: processedUnions,
      total: processedUnions.length
    });
  } catch (error) {
    console.error('Error obteniendo gremios:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// POST - Crear nuevo gremio
export async function POST(request: NextRequest) {
  try {
    const auth = await getPayrollAuth();
    if (!auth || !hasPayrollAccess(auth.user)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Permission check: ingresar_nominas
    const hasPerm = await hasUserPermission(auth.user.id, auth.companyId, 'ingresar_nominas');
    if (!hasPerm) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });

    const body = await request.json();
    const {
      name,
      code,
      conventionCode,
      paymentScheduleType = 'BIWEEKLY_FIXED',
      paymentRuleJson,
      attendancePolicyJson,
      contributionRulesJson
    } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'El nombre es requerido' },
        { status: 400 }
      );
    }

    // Verificar que no exista uno con el mismo nombre
    const existing = await prisma.$queryRaw<any[]>`
      SELECT id FROM payroll_unions
      WHERE company_id = ${auth.companyId} AND LOWER(name) = LOWER(${name})
    `;

    if (existing.length > 0) {
      return NextResponse.json(
        { error: 'Ya existe un gremio con ese nombre' },
        { status: 400 }
      );
    }

    const result = await prisma.$queryRaw<any[]>`
      INSERT INTO payroll_unions (
        company_id, name, code, convention_code,
        payment_schedule_type, payment_rule_json,
        attendance_policy_json, contribution_rules_json,
        is_active, created_at, updated_at
      )
      VALUES (
        ${auth.companyId},
        ${name},
        ${code || null},
        ${conventionCode || null},
        ${paymentScheduleType},
        ${paymentRuleJson ? JSON.stringify(paymentRuleJson) : null}::jsonb,
        ${attendancePolicyJson ? JSON.stringify(attendancePolicyJson) : null}::jsonb,
        ${contributionRulesJson ? JSON.stringify(contributionRulesJson) : null}::jsonb,
        true,
        NOW(),
        NOW()
      )
      RETURNING
        id,
        company_id as "companyId",
        name,
        code,
        convention_code as "conventionCode",
        payment_schedule_type as "paymentScheduleType",
        payment_rule_json as "paymentRuleJson",
        attendance_policy_json as "attendancePolicyJson",
        contribution_rules_json as "contributionRulesJson",
        is_active as "isActive",
        created_at as "createdAt"
    `;

    const newUnion = result[0];
    return NextResponse.json({
      ...newUnion,
      id: Number(newUnion.id),
      companyId: Number(newUnion.companyId)
    }, { status: 201 });
  } catch (error) {
    console.error('Error creando gremio:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// PUT - Actualizar gremio
export async function PUT(request: NextRequest) {
  try {
    const auth = await getPayrollAuth();
    if (!auth || !hasPayrollAccess(auth.user)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Permission check: ingresar_nominas
    const hasPermPut = await hasUserPermission(auth.user.id, auth.companyId, 'ingresar_nominas');
    if (!hasPermPut) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });

    const body = await request.json();
    const {
      id,
      name,
      code,
      conventionCode,
      paymentScheduleType,
      paymentRuleJson,
      attendancePolicyJson,
      contributionRulesJson,
      isActive
    } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'El ID es requerido' },
        { status: 400 }
      );
    }

    // Verificar que existe y pertenece a la empresa
    const existing = await prisma.$queryRaw<any[]>`
      SELECT id FROM payroll_unions
      WHERE id = ${parseInt(id)} AND company_id = ${auth.companyId}
    `;

    if (existing.length === 0) {
      return NextResponse.json(
        { error: 'Gremio no encontrado' },
        { status: 404 }
      );
    }

    // Si cambia el nombre, verificar que no exista otro con ese nombre
    if (name) {
      const duplicate = await prisma.$queryRaw<any[]>`
        SELECT id FROM payroll_unions
        WHERE company_id = ${auth.companyId}
          AND LOWER(name) = LOWER(${name})
          AND id != ${parseInt(id)}
      `;

      if (duplicate.length > 0) {
        return NextResponse.json(
          { error: 'Ya existe otro gremio con ese nombre' },
          { status: 400 }
        );
      }
    }

    const result = await prisma.$queryRaw<any[]>`
      UPDATE payroll_unions
      SET
        name = COALESCE(${name}, name),
        code = ${code !== undefined ? code : null},
        convention_code = ${conventionCode !== undefined ? conventionCode : null},
        payment_schedule_type = COALESCE(${paymentScheduleType}, payment_schedule_type),
        payment_rule_json = ${paymentRuleJson !== undefined ? JSON.stringify(paymentRuleJson) : null}::jsonb,
        attendance_policy_json = ${attendancePolicyJson !== undefined ? JSON.stringify(attendancePolicyJson) : null}::jsonb,
        contribution_rules_json = ${contributionRulesJson !== undefined ? JSON.stringify(contributionRulesJson) : null}::jsonb,
        is_active = COALESCE(${isActive}, is_active),
        updated_at = NOW()
      WHERE id = ${parseInt(id)} AND company_id = ${auth.companyId}
      RETURNING
        id,
        company_id as "companyId",
        name,
        code,
        convention_code as "conventionCode",
        payment_schedule_type as "paymentScheduleType",
        payment_rule_json as "paymentRuleJson",
        attendance_policy_json as "attendancePolicyJson",
        contribution_rules_json as "contributionRulesJson",
        is_active as "isActive",
        updated_at as "updatedAt"
    `;

    const updated = result[0];
    return NextResponse.json({
      ...updated,
      id: Number(updated.id),
      companyId: Number(updated.companyId)
    });
  } catch (error) {
    console.error('Error actualizando gremio:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// DELETE - Desactivar gremio (soft delete)
export async function DELETE(request: NextRequest) {
  try {
    const auth = await getPayrollAuth();
    if (!auth || !hasPayrollAccess(auth.user)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Permission check: ingresar_nominas
    const hasPermDel = await hasUserPermission(auth.user.id, auth.companyId, 'ingresar_nominas');
    if (!hasPermDel) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'El ID es requerido' },
        { status: 400 }
      );
    }

    // Verificar que existe
    const existing = await prisma.$queryRaw<any[]>`
      SELECT id FROM payroll_unions
      WHERE id = ${parseInt(id)} AND company_id = ${auth.companyId}
    `;

    if (existing.length === 0) {
      return NextResponse.json(
        { error: 'Gremio no encontrado' },
        { status: 404 }
      );
    }

    // Verificar que no tiene empleados activos
    const employeeCount = await prisma.$queryRaw<any[]>`
      SELECT COUNT(*)::int as count
      FROM employees e
      JOIN union_categories uc ON uc.id = e.union_category_id
      WHERE uc.union_id = ${parseInt(id)} AND e.active = true
    `;

    if (employeeCount[0].count > 0) {
      return NextResponse.json(
        { error: `No se puede eliminar: hay ${employeeCount[0].count} empleados activos en este gremio` },
        { status: 400 }
      );
    }

    // Soft delete
    await prisma.$queryRaw`
      UPDATE payroll_unions
      SET is_active = false, updated_at = NOW()
      WHERE id = ${parseInt(id)} AND company_id = ${auth.companyId}
    `;

    // También desactivar las categorías del gremio
    await prisma.$queryRaw`
      UPDATE union_categories
      SET is_active = false, updated_at = NOW()
      WHERE union_id = ${parseInt(id)}
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error eliminando gremio:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
