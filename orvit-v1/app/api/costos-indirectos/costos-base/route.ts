import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/shared-helpers';

export const dynamic = 'force-dynamic';

// ✅ OPTIMIZADO: Usar instancia global de prisma desde @/lib/prisma

// GET /api/costos-indirectos/costos-base - Obtener costos base
export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    const companyId = String(user!.companyId);

    // Usar SQL directo para evitar problemas con modelos
    const costosBase = await prisma.$queryRaw`
      SELECT 
        icb.id,
        icb.name,
        icb.description,
        icb.category_id as "categoryId",
        icc.name as "categoryName",
        icc.type as "categoryType",
        icc.color as "categoryColor",
        icb.created_at as "createdAt",
        icb.updated_at as "updatedAt"
      FROM indirect_cost_base icb
      LEFT JOIN indirect_cost_categories icc ON icb.category_id = icc.id
      WHERE icb.company_id = ${parseInt(companyId)}
      ORDER BY icb.created_at DESC
    `;

    return NextResponse.json(costosBase || []);

  } catch (error) {
    console.error('Error obteniendo costos base:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// POST /api/costos-indirectos/costos-base - Crear nuevo costo base
export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    const body = await request.json();
    const { name, description, categoryId } = body;
    const companyId = String(user!.companyId);

    if (!name) {
      return NextResponse.json(
        { error: 'Nombre es requerido' },
        { status: 400 }
      );
    }

    // Validar que la categoría existe
    const categoryExists = await prisma.$queryRaw`
      SELECT id FROM indirect_cost_categories 
      WHERE id = ${parseInt(categoryId) || 1} AND company_id = ${parseInt(companyId)}
    `;

    if (!categoryExists || (categoryExists as any[]).length === 0) {
      return NextResponse.json(
        { error: 'La categoría especificada no existe para esta empresa' },
        { status: 400 }
      );
    }

    // Crear nuevo costo base en indirect_cost_base
    const newCostoBase = await prisma.$queryRaw`
      INSERT INTO indirect_cost_base (
        name, description, category_id, company_id, created_at, updated_at
      ) VALUES (
        ${name}, 
        ${description || ''}, 
        ${parseInt(categoryId) || 1}, 
        ${parseInt(companyId)}, 
        CURRENT_TIMESTAMP, 
        CURRENT_TIMESTAMP
      ) RETURNING id
    `;

    const costoBaseId = (newCostoBase as any[])[0].id;

    // Crear registro en el historial
    await prisma.$queryRaw`
      INSERT INTO indirect_cost_change_history (
        cost_base_id, change_type, old_amount, new_amount, reason, company_id, created_at
      ) VALUES (
        ${costoBaseId}, 
        'created', 
        0, 
        0, 
        'Costo base creado', 
        ${parseInt(companyId)}, 
        CURRENT_TIMESTAMP
      )
    `;

    return NextResponse.json({
      success: true,
      message: 'Costo base creado exitosamente',
      id: costoBaseId
    }, { status: 201 });

  } catch (error) {
    console.error('Error creando costo base:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// PUT /api/costos-indirectos/costos-base - Actualizar costo base
export async function PUT(request: NextRequest) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    const body = await request.json();
    const { id, name, description, categoryId } = body;
    const companyId = String(user!.companyId);

    if (!id || !name) {
      return NextResponse.json(
        { error: 'ID y nombre son requeridos' },
        { status: 400 }
      );
    }

    // Validar que la categoría existe
    const categoryExists = await prisma.$queryRaw`
      SELECT id FROM indirect_cost_categories 
      WHERE id = ${parseInt(categoryId) || 1} AND company_id = ${parseInt(companyId)}
    `;

    if (!categoryExists || (categoryExists as any[]).length === 0) {
      return NextResponse.json(
        { error: 'La categoría especificada no existe para esta empresa' },
        { status: 400 }
      );
    }

    // Obtener datos anteriores para el historial
    const oldData = await prisma.$queryRaw`
      SELECT name, description, category_id FROM indirect_cost_base 
      WHERE id = ${parseInt(id)} AND company_id = ${parseInt(companyId)}
    `;

    if (!oldData || (oldData as any[]).length === 0) {
      return NextResponse.json(
        { error: 'Costo base no encontrado' },
        { status: 404 }
      );
    }

    const oldRecord = (oldData as any[])[0];

    // Actualizar costo base
    const updatedCostoBase = await prisma.$queryRaw`
      UPDATE indirect_cost_base 
      SET 
        name = ${name},
        description = ${description || ''},
        category_id = ${parseInt(categoryId) || 1},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${parseInt(id)} AND company_id = ${parseInt(companyId)}
      RETURNING id
    `;

    // Crear registro en el historial
    await prisma.$queryRaw`
      INSERT INTO indirect_cost_change_history (
        cost_base_id, change_type, old_amount, new_amount, reason, company_id, created_at
      ) VALUES (
        ${parseInt(id)}, 
        'updated', 
        0, 
        0, 
        'Costo base actualizado', 
        ${parseInt(companyId)}, 
        CURRENT_TIMESTAMP
      )
    `;

    return NextResponse.json({
      success: true,
      message: 'Costo base actualizado exitosamente',
      id: (updatedCostoBase as any[])[0].id
    });

  } catch (error) {
    console.error('Error actualizando costo base:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
