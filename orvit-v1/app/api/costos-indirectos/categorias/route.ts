import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// ✅ OPTIMIZADO: Usar instancia global de prisma desde @/lib/prisma

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId es requerido' },
        { status: 400 }
      );
    }

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
    const body = await request.json();
    const { name, description, type, color, icon, companyId } = body;

    if (!name || !type || !companyId) {
      return NextResponse.json(
        { error: 'Nombre, tipo y companyId son requeridos' },
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
