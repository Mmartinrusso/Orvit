import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getPayrollAuth, hasPayrollAccess } from '@/lib/nominas/auth-helper';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: { id: string };
}

// GET - Obtener conceptos default de una categoría
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await getPayrollAuth();
    if (!auth) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const categoryId = parseInt(params.id);
    if (isNaN(categoryId)) {
      return NextResponse.json({ error: 'ID de categoría inválido' }, { status: 400 });
    }

    // Verificar que la categoría pertenece a la empresa
    const category = await prisma.$queryRaw<any[]>`
      SELECT id, name FROM employee_categories
      WHERE id = ${categoryId} AND company_id = ${auth.companyId}
    `;

    if (category.length === 0) {
      return NextResponse.json({ error: 'Categoría no encontrada' }, { status: 404 });
    }

    // Obtener conceptos default con info del componente
    const defaults = await prisma.$queryRaw<any[]>`
      SELECT
        cdc.id,
        cdc.category_id as "categoryId",
        cdc.component_id as "componentId",
        cdc.quantity,
        cdc.unit_amount as "unitAmount",
        cdc.comment,
        cdc.no_delete as "noDelete",
        cdc."order",
        cdc.created_at as "createdAt",
        sc.code as "componentCode",
        sc.name as "componentName",
        sc.type as "componentType",
        sc.concept_type as "conceptType",
        sc.is_remunerative as "isRemunerative"
      FROM category_default_concepts cdc
      JOIN salary_components sc ON sc.id = cdc.component_id
      WHERE cdc.category_id = ${categoryId}
      ORDER BY cdc."order" ASC, sc.name ASC
    `;

    const processedDefaults = defaults.map((d: any) => ({
      ...d,
      id: Number(d.id),
      categoryId: Number(d.categoryId),
      componentId: Number(d.componentId),
      quantity: parseFloat(d.quantity),
      unitAmount: parseFloat(d.unitAmount),
      order: Number(d.order)
    }));

    return NextResponse.json({
      category: {
        id: Number(category[0].id),
        name: category[0].name
      },
      defaults: processedDefaults
    });
  } catch (error) {
    console.error('Error obteniendo conceptos default:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// POST - Agregar concepto default a una categoría
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await getPayrollAuth();
    if (!auth || !hasPayrollAccess(auth.user)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const categoryId = parseInt(params.id);
    if (isNaN(categoryId)) {
      return NextResponse.json({ error: 'ID de categoría inválido' }, { status: 400 });
    }

    const body = await request.json();
    const {
      componentId,
      quantity = 1,
      unitAmount = 0,
      comment,
      noDelete = false,
      order = 0
    } = body;

    if (!componentId) {
      return NextResponse.json(
        { error: 'componentId es requerido' },
        { status: 400 }
      );
    }

    // Verificar que la categoría pertenece a la empresa
    const category = await prisma.$queryRaw<any[]>`
      SELECT id FROM employee_categories
      WHERE id = ${categoryId} AND company_id = ${auth.companyId}
    `;

    if (category.length === 0) {
      return NextResponse.json({ error: 'Categoría no encontrada' }, { status: 404 });
    }

    // Verificar que el componente existe y pertenece a la empresa
    const component = await prisma.$queryRaw<any[]>`
      SELECT id, code, name FROM salary_components
      WHERE id = ${parseInt(componentId)} AND company_id = ${auth.companyId}
    `;

    if (component.length === 0) {
      return NextResponse.json({ error: 'Componente no encontrado' }, { status: 404 });
    }

    // Verificar si ya existe
    const existing = await prisma.$queryRaw<any[]>`
      SELECT id FROM category_default_concepts
      WHERE category_id = ${categoryId} AND component_id = ${parseInt(componentId)}
    `;

    if (existing.length > 0) {
      return NextResponse.json(
        { error: 'El concepto ya existe para esta categoría' },
        { status: 400 }
      );
    }

    const result = await prisma.$queryRaw<any[]>`
      INSERT INTO category_default_concepts (
        category_id, component_id, quantity, unit_amount,
        comment, no_delete, "order", created_at
      )
      VALUES (
        ${categoryId},
        ${parseInt(componentId)},
        ${parseFloat(String(quantity))},
        ${parseFloat(String(unitAmount))},
        ${comment || null},
        ${noDelete},
        ${parseInt(String(order))},
        NOW()
      )
      RETURNING
        id,
        category_id as "categoryId",
        component_id as "componentId",
        quantity,
        unit_amount as "unitAmount",
        comment,
        no_delete as "noDelete",
        "order",
        created_at as "createdAt"
    `;

    const newDefault = result[0];
    return NextResponse.json({
      ...newDefault,
      id: Number(newDefault.id),
      categoryId: Number(newDefault.categoryId),
      componentId: Number(newDefault.componentId),
      quantity: parseFloat(newDefault.quantity),
      unitAmount: parseFloat(newDefault.unitAmount),
      order: Number(newDefault.order),
      componentCode: component[0].code,
      componentName: component[0].name
    }, { status: 201 });
  } catch (error) {
    console.error('Error creando concepto default:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// PUT - Actualizar múltiples conceptos default (bulk update)
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await getPayrollAuth();
    if (!auth || !hasPayrollAccess(auth.user)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const categoryId = parseInt(params.id);
    if (isNaN(categoryId)) {
      return NextResponse.json({ error: 'ID de categoría inválido' }, { status: 400 });
    }

    const body = await request.json();
    const { defaults } = body; // Array de { id, quantity, unitAmount, comment, order }

    if (!Array.isArray(defaults)) {
      return NextResponse.json(
        { error: 'Se esperaba un array de defaults' },
        { status: 400 }
      );
    }

    // Verificar categoría
    const category = await prisma.$queryRaw<any[]>`
      SELECT id FROM employee_categories
      WHERE id = ${categoryId} AND company_id = ${auth.companyId}
    `;

    if (category.length === 0) {
      return NextResponse.json({ error: 'Categoría no encontrada' }, { status: 404 });
    }

    // Actualizar cada concepto
    for (const item of defaults) {
      if (!item.id) continue;

      await prisma.$queryRaw`
        UPDATE category_default_concepts
        SET
          quantity = COALESCE(${item.quantity !== undefined ? parseFloat(String(item.quantity)) : null}, quantity),
          unit_amount = COALESCE(${item.unitAmount !== undefined ? parseFloat(String(item.unitAmount)) : null}, unit_amount),
          comment = ${item.comment !== undefined ? item.comment : null},
          "order" = COALESCE(${item.order !== undefined ? parseInt(String(item.order)) : null}, "order")
        WHERE id = ${parseInt(String(item.id))} AND category_id = ${categoryId}
      `;
    }

    return NextResponse.json({ success: true, updated: defaults.length });
  } catch (error) {
    console.error('Error actualizando conceptos default:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// DELETE - Eliminar un concepto default específico
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await getPayrollAuth();
    if (!auth || !hasPayrollAccess(auth.user)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const categoryId = parseInt(params.id);
    const { searchParams } = new URL(request.url);
    const defaultId = searchParams.get('defaultId');

    if (!defaultId) {
      return NextResponse.json(
        { error: 'defaultId es requerido' },
        { status: 400 }
      );
    }

    // Verificar que el concepto existe y no está marcado como no_delete
    const existing = await prisma.$queryRaw<any[]>`
      SELECT id, no_delete FROM category_default_concepts
      WHERE id = ${parseInt(defaultId)} AND category_id = ${categoryId}
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

    await prisma.$queryRaw`
      DELETE FROM category_default_concepts
      WHERE id = ${parseInt(defaultId)} AND category_id = ${categoryId}
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error eliminando concepto default:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
