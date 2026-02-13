import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentPortalSession } from '@/lib/portal/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/portal/precios
 * Obtener lista de precios para el cliente del portal
 * Usa el salePrice del producto directamente
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getCurrentPortalSession();

    if (!session) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    // Verificar permiso
    if (!session.permissions.canViewPrices) {
      return NextResponse.json(
        { error: 'No tiene permisos para ver precios' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const categoryId = searchParams.get('categoryId');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = (page - 1) * limit;

    // Construir filtro de productos
    const where: any = {
      companyId: session.companyId,
      isActive: true,
      // Solo productos con precio de venta definido
      salePrice: { not: null },
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (categoryId) {
      where.categoryId = parseInt(categoryId);
    }

    // Obtener productos con sus precios
    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
        select: {
          id: true,
          code: true,
          name: true,
          description: true,
          unit: true,
          categoryId: true,
          salePrice: true,
          saleCurrency: true,
          category: {
            select: { id: true, name: true },
          },
        },
      }),
      prisma.product.count({ where }),
    ]);

    // Transformar datos
    const formattedProducts = products.map((p) => ({
      id: p.id,
      codigo: p.code,
      nombre: p.name,
      descripcion: p.description,
      unidad: p.unit,
      categoria: p.category,
      precio: p.salePrice ? Number(p.salePrice) : null,
      moneda: p.saleCurrency || 'ARS',
    }));

    // Obtener categorías disponibles (solo las que tienen productos con precio)
    const categories = await prisma.category.findMany({
      where: {
        companyId: session.companyId,
        isActive: true,
        products: {
          some: {
            isActive: true,
            salePrice: { not: null },
          },
        },
      },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({
      productos: formattedProducts,
      categorias: categories,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error obteniendo precios del portal:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
