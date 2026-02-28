import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/shared-helpers';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const categoryId = searchParams.get('categoryId');

    console.log('🔍 GET /api/productos/subcategorias - companyId:', companyId, 'categoryId:', categoryId);

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId es requerido' },
        { status: 400 }
      );
    }

    let whereClause = `WHERE ps.company_id = $1`;
    const params = [parseInt(companyId)];

    if (categoryId) {
      whereClause += ` AND ps.category_id = $2`;
      params.push(parseInt(categoryId));
    }

    const subcategories = await prisma.$queryRawUnsafe(`
      SELECT 
        ps.id,
        ps.name,
        ps.description,
        ps.category_id as "categoryId",
        ps.company_id as "companyId",
        pc.name as "categoryName"
      FROM product_subcategories ps
      LEFT JOIN product_categories pc ON ps.category_id = pc.id
      ${whereClause}
      ORDER BY pc.name, ps.name
    `, ...params);

    console.log('📊 Subcategorías encontradas:', subcategories);
    return NextResponse.json(subcategories);

  } catch (error: any) {
    console.error('Error obteniendo subcategorías:', error);
    
    if (error.message.includes('no existe la relación')) {
      // Tabla no existe, retornar array vacío
      return NextResponse.json([]);
    }
    
    return NextResponse.json(
      { error: 'Error interno del servidor', details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    const body = await request.json();
    const { name, description, categoryId, companyId } = body;

    if (!name || !categoryId || !companyId) {
      return NextResponse.json(
        { error: 'Nombre, categoryId y companyId son requeridos' },
        { status: 400 }
      );
    }

    // Verificar si la tabla existe
    try {
      const tableExists = await prisma.$queryRawUnsafe(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'product_subcategories'
        );
      `);

      if (!(tableExists as any[])[0].exists) {
        return NextResponse.json(
          { error: 'Tabla de subcategorías no existe. Ejecuta: npx prisma db push' },
          { status: 503 }
        );
      }

      // Verificar que la categoría existe
      const category = await prisma.$queryRawUnsafe(`
        SELECT id FROM product_categories 
        WHERE id = $1 AND company_id = $2
      `, parseInt(categoryId), parseInt(companyId));

      if (!category || (category as any[]).length === 0) {
        return NextResponse.json(
          { error: 'Categoría no encontrada' },
          { status: 404 }
        );
      }

      const newSubcategory = await prisma.$queryRawUnsafe(`
        INSERT INTO product_subcategories (
          name, description, category_id, company_id, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        ) RETURNING id, name, description, category_id, company_id
      `, name, description || null, parseInt(categoryId), parseInt(companyId));

      return NextResponse.json(newSubcategory[0], { status: 201 });

    } catch (dbError: any) {
      if (dbError.message.includes('no existe la relación')) {
        return NextResponse.json(
          { error: 'Tabla de subcategorías no existe. Ejecuta: npx prisma db push' },
          { status: 503 }
        );
      }
      throw dbError;
    }

  } catch (error: any) {
    console.error('Error creando subcategoría:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor', details: error.message },
      { status: 500 }
    );
  }
}
