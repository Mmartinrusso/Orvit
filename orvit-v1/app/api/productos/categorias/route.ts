import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/shared-helpers';

export const dynamic = 'force-dynamic';

// ✅ OPTIMIZADO: Usar instancia global de prisma desde @/lib/prisma

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId es requerido' },
        { status: 400 }
      );
    }

    const categories = await prisma.$queryRawUnsafe(`
      SELECT 
        id,
        name,
        description,
        company_id as "companyId",
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM product_categories
      WHERE company_id = $1
      ORDER BY name
    `, parseInt(companyId));

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
    const { name, description, companyId } = body;

    if (!name || !companyId) {
      return NextResponse.json(
        { error: 'Nombre y companyId son requeridos' },
        { status: 400 }
      );
    }

    const newCategory = await prisma.$queryRawUnsafe(`
      INSERT INTO product_categories (name, description, company_id)
      VALUES ($1, $2, $3)
      RETURNING id, name, description, company_id as "companyId", created_at as "createdAt", updated_at as "updatedAt"
    `, name, description || null, parseInt(companyId));

    return NextResponse.json((newCategory as any[])[0]);

  } catch (error) {
    console.error('Error creando categoría:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
