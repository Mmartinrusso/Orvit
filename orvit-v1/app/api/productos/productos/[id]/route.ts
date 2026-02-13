import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const productId = parseInt(params.id);

    const product = await prisma.$queryRaw`
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
      WHERE p.id = ${productId}
    `;

    if (!product || (product as any[]).length === 0) {
      return NextResponse.json(
        { error: 'Producto no encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json((product as any[])[0]);

  } catch (error) {
    console.error('Error obteniendo producto:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const productId = parseInt(params.id);
    const body = await request.json();
    const { 
      name, 
      description, 
      sku, 
      categoryId,
      subcategoryId,
      isActive 
    } = body;

    if (!name || !sku || !categoryId) {
      return NextResponse.json(
        { error: 'Nombre, SKU y categoría son requeridos' },
        { status: 400 }
      );
    }

    // Verificar que el SKU sea único (excluyendo el producto actual)
    const existingProduct = await prisma.$queryRaw`
      SELECT id FROM products WHERE sku = ${sku} AND id != ${productId}
    `;

    if (existingProduct && (existingProduct as any[]).length > 0) {
      return NextResponse.json(
        { error: 'El SKU ya existe' },
        { status: 400 }
      );
    }

    const updatedProduct = await prisma.$queryRaw`
      UPDATE products 
      SET 
        name = ${name},
        description = ${description || null},
        sku = ${sku},
        category_id = ${parseInt(categoryId)},
        subcategory_id = ${subcategoryId ? parseInt(subcategoryId) : null},
        is_active = ${isActive !== undefined ? isActive : true},
        updated_at = NOW()
      WHERE id = ${productId}
      RETURNING id, name, description, sku, category_id as "categoryId", subcategory_id as "subcategoryId", company_id as "companyId",
                unit_price as "unitPrice", unit_cost as "unitCost", stock_quantity as "stockQuantity",
                min_stock_level as "minStockLevel", is_active as "isActive", created_at as "createdAt", updated_at as "updatedAt"
    `;

    if (!updatedProduct || (updatedProduct as any[]).length === 0) {
      return NextResponse.json(
        { error: 'Producto no encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json((updatedProduct as any[])[0]);

  } catch (error) {
    console.error('Error actualizando producto:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const productId = parseInt(params.id);

    // Verificar que el producto existe
    const existingProduct = await prisma.$queryRaw`
      SELECT id FROM products WHERE id = ${productId}
    `;

    if (!existingProduct || (existingProduct as any[]).length === 0) {
      return NextResponse.json(
        { error: 'Producto no encontrado' },
        { status: 404 }
      );
    }

    // Eliminar el producto
    await prisma.$executeRaw`
      DELETE FROM products WHERE id = ${productId}
    `;

    return NextResponse.json({ message: 'Producto eliminado exitosamente' });

  } catch (error) {
    console.error('Error eliminando producto:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
