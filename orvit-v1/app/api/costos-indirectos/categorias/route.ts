import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/shared-helpers';

export const dynamic = 'force-dynamic';

// ✅ OPTIMIZADO: Usar instancia global de prisma desde @/lib/prisma

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    const companyId = String(user!.companyId);

    const categories = await prisma.$queryRaw`
      SELECT 
        id,
        name,
        description,
        type,
        color,
        icon,
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM indirect_cost_categories 
      WHERE company_id = ${parseInt(companyId)}
      ORDER BY name ASC
    `;

    return NextResponse.json(categories);

  } catch (error) {
    console.error('Error obteniendo categorías:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    const body = await request.json();
    const { name, description, type, color, icon } = body;
    const companyId = String(user!.companyId);

    if (!name || !type) {
      return NextResponse.json(
        { error: 'Nombre y tipo son requeridos' },
        { status: 400 }
      );
    }

    const result = await prisma.$executeRaw`
      INSERT INTO indirect_cost_categories (name, description, type, color, icon, company_id)
      VALUES (${name}, ${description || null}, ${type}, ${color || '#3B82F6'}, ${icon || 'Building2'}, ${parseInt(companyId)})
      RETURNING id
    `;

    // Obtener la categoría creada
    const newCategory = await prisma.$queryRaw`
      SELECT 
        id,
        name,
        description,
        type,
        color,
        icon,
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM indirect_cost_categories 
      WHERE company_id = ${parseInt(companyId)} AND name = ${name}
      ORDER BY id DESC
      LIMIT 1
    `;

    return NextResponse.json(newCategory[0], { status: 201 });

  } catch (error) {
    console.error('Error creando categoría:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
