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

    const products = await prisma.$queryRaw`
      SELECT 
        p.id,
        p.name,
        p.description,
        p.sku,
        p.category_id as "categoryId",
        p.subcategory_id as "subcategoryId",
        p.company_id as "companyId",
        p.unit_price as "unitPrice",
        p.unit_cost as "unitCost",
        p.stock_quantity as "stockQuantity",
        p.min_stock_level as "minStockLevel",
        p.is_active as "isActive",
        p.created_at as "createdAt",
        p.updated_at as "updatedAt",
        pc.name as "categoryName",
        pc.description as "categoryDescription",
        ps.name as "subcategoryName",
        ps.description as "subcategoryDescription"
      FROM products p
      INNER JOIN product_categories pc ON p.category_id = pc.id
      LEFT JOIN product_subcategories ps ON p.subcategory_id = ps.id
      WHERE p.company_id = ${parseInt(companyId)}
      ORDER BY p.name
    `;

    return NextResponse.json(products);

  } catch (error) {
    console.error('Error obteniendo productos:', error);
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
    const { 
      name, 
      description, 
      sku, 
      categoryId, 
      subcategoryId,
      companyId
    } = body;

    if (!name || !sku || !categoryId || !companyId) {
      return NextResponse.json(
        { error: 'Nombre, SKU, categoría y companyId son requeridos' },
        { status: 400 }
      );
    }

    // Verificar que el SKU sea único
    const existingProduct = await prisma.$queryRaw`
      SELECT id FROM products WHERE sku = ${sku}
    `;

    if (existingProduct && (existingProduct as any[]).length > 0) {
      return NextResponse.json(
        { error: 'El SKU ya existe' },
        { status: 400 }
      );
    }

    const newProduct = await prisma.$queryRaw`
      INSERT INTO products (
        name, description, sku, category_id, subcategory_id, company_id
      )
      VALUES (
        ${name}, ${description || null}, ${sku}, ${parseInt(categoryId)}, ${subcategoryId ? parseInt(subcategoryId) : null}, ${parseInt(companyId)}
      )
      RETURNING id, name, description, sku, category_id as "categoryId", subcategory_id as "subcategoryId", company_id as "companyId",
                unit_price as "unitPrice", unit_cost as "unitCost", stock_quantity as "stockQuantity",
                min_stock_level as "minStockLevel", is_active as "isActive", created_at as "createdAt", updated_at as "updatedAt"
    `;

    return NextResponse.json((newProduct as any[])[0]);

  } catch (error) {
    console.error('Error creando producto:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
