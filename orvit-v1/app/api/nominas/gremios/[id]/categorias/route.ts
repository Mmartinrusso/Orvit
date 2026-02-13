import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getPayrollAuth, hasPayrollAccess } from '@/lib/nominas/auth-helper';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: { id: string };
}

// GET - Listar categorías de un gremio
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await getPayrollAuth();
    if (!auth) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const unionId = parseInt(params.id);
    if (isNaN(unionId)) {
      return NextResponse.json({ error: 'ID de gremio inválido' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get('includeInactive') === 'true';
    const includeRates = searchParams.get('includeRates') === 'true';

    // Verificar que el gremio existe y pertenece a la empresa
    const union = await prisma.$queryRaw<any[]>`
      SELECT id, name, convention_code as "conventionCode"
      FROM payroll_unions
      WHERE id = ${unionId} AND company_id = ${auth.companyId}
    `;

    if (union.length === 0) {
      return NextResponse.json({ error: 'Gremio no encontrado' }, { status: 404 });
    }

    const activeCondition = !includeInactive
      ? Prisma.sql`AND uc.is_active = true`
      : Prisma.empty;

    const categories = await prisma.$queryRaw<any[]>`
      SELECT
        uc.id,
        uc.union_id as "unionId",
        uc.name,
        uc.code,
        uc.description,
        uc.level,
        uc.is_active as "isActive",
        uc.created_at as "createdAt",
        uc.updated_at as "updatedAt",
        (
          SELECT COUNT(*)::int
          FROM employees e
          WHERE e.union_category_id = uc.id AND e.active = true
        ) as "employeeCount"
      FROM union_categories uc
      WHERE uc.union_id = ${unionId}
        ${activeCondition}
      ORDER BY uc.level ASC, uc.name ASC
    `;

    // Si se solicitan las tasas vigentes, obtenerlas
    let ratesByCategory: Record<number, any> = {};
    if (includeRates) {
      const rates = await prisma.$queryRaw<any[]>`
        SELECT
          ar.id,
          ar.union_category_id as "unionCategoryId",
          ar.effective_from as "effectiveFrom",
          ar.effective_to as "effectiveTo",
          ar.daily_rate as "dailyRate",
          ar.hourly_rate as "hourlyRate",
          ar.presenteeism_rate as "presenteeismRate",
          ar.seniority_pct as "seniorityPct",
          ar.notes
        FROM agreement_rates ar
        WHERE ar.union_category_id IN (
          SELECT id FROM union_categories WHERE union_id = ${unionId}
        )
        AND ar.effective_from <= CURRENT_DATE
        AND (ar.effective_to IS NULL OR ar.effective_to >= CURRENT_DATE)
        ORDER BY ar.effective_from DESC
      `;

      for (const rate of rates) {
        if (!ratesByCategory[rate.unionCategoryId]) {
          ratesByCategory[rate.unionCategoryId] = {
            ...rate,
            id: Number(rate.id),
            unionCategoryId: Number(rate.unionCategoryId),
            dailyRate: parseFloat(rate.dailyRate),
            hourlyRate: rate.hourlyRate ? parseFloat(rate.hourlyRate) : null,
            presenteeismRate: rate.presenteeismRate ? parseFloat(rate.presenteeismRate) : null,
            seniorityPct: rate.seniorityPct ? parseFloat(rate.seniorityPct) : null
          };
        }
      }
    }

    const processedCategories = categories.map((c: any) => ({
      ...c,
      id: Number(c.id),
      unionId: Number(c.unionId),
      currentRate: includeRates ? (ratesByCategory[c.id] || null) : undefined
    }));

    return NextResponse.json({
      union: {
        id: Number(union[0].id),
        name: union[0].name,
        conventionCode: union[0].conventionCode
      },
      categories: processedCategories,
      total: processedCategories.length
    });
  } catch (error) {
    console.error('Error obteniendo categorías del gremio:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// POST - Crear nueva categoría en el gremio
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await getPayrollAuth();
    if (!auth || !hasPayrollAccess(auth.user)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const unionId = parseInt(params.id);
    if (isNaN(unionId)) {
      return NextResponse.json({ error: 'ID de gremio inválido' }, { status: 400 });
    }

    const body = await request.json();
    const { name, code, description, level = 0 } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'El nombre es requerido' },
        { status: 400 }
      );
    }

    // Verificar que el gremio existe
    const union = await prisma.$queryRaw<any[]>`
      SELECT id FROM payroll_unions
      WHERE id = ${unionId} AND company_id = ${auth.companyId}
    `;

    if (union.length === 0) {
      return NextResponse.json({ error: 'Gremio no encontrado' }, { status: 404 });
    }

    // Verificar que no exista una categoría con el mismo nombre en este gremio
    const existing = await prisma.$queryRaw<any[]>`
      SELECT id FROM union_categories
      WHERE union_id = ${unionId} AND LOWER(name) = LOWER(${name})
    `;

    if (existing.length > 0) {
      return NextResponse.json(
        { error: 'Ya existe una categoría con ese nombre en este gremio' },
        { status: 400 }
      );
    }

    const result = await prisma.$queryRaw<any[]>`
      INSERT INTO union_categories (
        union_id, name, code, description, level,
        is_active, created_at, updated_at
      )
      VALUES (
        ${unionId},
        ${name},
        ${code || null},
        ${description || null},
        ${level},
        true,
        NOW(),
        NOW()
      )
      RETURNING
        id,
        union_id as "unionId",
        name,
        code,
        description,
        level,
        is_active as "isActive",
        created_at as "createdAt"
    `;

    const newCategory = result[0];
    return NextResponse.json({
      ...newCategory,
      id: Number(newCategory.id),
      unionId: Number(newCategory.unionId)
    }, { status: 201 });
  } catch (error) {
    console.error('Error creando categoría:', error);
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

    const unionId = parseInt(params.id);
    if (isNaN(unionId)) {
      return NextResponse.json({ error: 'ID de gremio inválido' }, { status: 400 });
    }

    const body = await request.json();
    const { categoryId, name, code, description, level, isActive } = body;

    if (!categoryId) {
      return NextResponse.json(
        { error: 'El ID de categoría es requerido' },
        { status: 400 }
      );
    }

    // Verificar que existe y pertenece al gremio correcto
    const existing = await prisma.$queryRaw<any[]>`
      SELECT uc.id
      FROM union_categories uc
      JOIN payroll_unions pu ON pu.id = uc.union_id
      WHERE uc.id = ${parseInt(categoryId)}
        AND uc.union_id = ${unionId}
        AND pu.company_id = ${auth.companyId}
    `;

    if (existing.length === 0) {
      return NextResponse.json(
        { error: 'Categoría no encontrada' },
        { status: 404 }
      );
    }

    // Si cambia el nombre, verificar duplicados
    if (name) {
      const duplicate = await prisma.$queryRaw<any[]>`
        SELECT id FROM union_categories
        WHERE union_id = ${unionId}
          AND LOWER(name) = LOWER(${name})
          AND id != ${parseInt(categoryId)}
      `;

      if (duplicate.length > 0) {
        return NextResponse.json(
          { error: 'Ya existe otra categoría con ese nombre en este gremio' },
          { status: 400 }
        );
      }
    }

    const result = await prisma.$queryRaw<any[]>`
      UPDATE union_categories
      SET
        name = COALESCE(${name}, name),
        code = ${code !== undefined ? code : null},
        description = ${description !== undefined ? description : null},
        level = COALESCE(${level}, level),
        is_active = COALESCE(${isActive}, is_active),
        updated_at = NOW()
      WHERE id = ${parseInt(categoryId)} AND union_id = ${unionId}
      RETURNING
        id,
        union_id as "unionId",
        name,
        code,
        description,
        level,
        is_active as "isActive",
        updated_at as "updatedAt"
    `;

    const updated = result[0];
    return NextResponse.json({
      ...updated,
      id: Number(updated.id),
      unionId: Number(updated.unionId)
    });
  } catch (error) {
    console.error('Error actualizando categoría:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// DELETE - Desactivar categoría
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await getPayrollAuth();
    if (!auth || !hasPayrollAccess(auth.user)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const unionId = parseInt(params.id);
    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get('categoryId');

    if (!categoryId) {
      return NextResponse.json(
        { error: 'El ID de categoría es requerido' },
        { status: 400 }
      );
    }

    // Verificar que existe
    const existing = await prisma.$queryRaw<any[]>`
      SELECT uc.id
      FROM union_categories uc
      JOIN payroll_unions pu ON pu.id = uc.union_id
      WHERE uc.id = ${parseInt(categoryId)}
        AND uc.union_id = ${unionId}
        AND pu.company_id = ${auth.companyId}
    `;

    if (existing.length === 0) {
      return NextResponse.json(
        { error: 'Categoría no encontrada' },
        { status: 404 }
      );
    }

    // Verificar que no tiene empleados activos
    const employeeCount = await prisma.$queryRaw<any[]>`
      SELECT COUNT(*)::int as count
      FROM employees
      WHERE union_category_id = ${parseInt(categoryId)} AND status = 'ACTIVE'
    `;

    if (employeeCount[0].count > 0) {
      return NextResponse.json(
        { error: `No se puede eliminar: hay ${employeeCount[0].count} empleados activos con esta categoría` },
        { status: 400 }
      );
    }

    // Soft delete
    await prisma.$queryRaw`
      UPDATE union_categories
      SET is_active = false, updated_at = NOW()
      WHERE id = ${parseInt(categoryId)} AND union_id = ${unionId}
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
