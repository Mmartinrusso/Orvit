import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import { createProductSchema } from '@/lib/ventas/validation-schemas';
import {
  getIdempotencyKey,
  withIdempotency,
  handleIdempotencyError,
  idempotencyHeaders,
} from '@/lib/ventas/idempotency-helper';

export const dynamic = 'force-dynamic';

// GET - Listar productos
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.PRODUCTOS_VIEW);
    if (error) return error;

    const companyId = user!.companyId;

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search');
    const categoryId = searchParams.get('categoryId');
    const activeOnly = searchParams.get('active') !== 'false';

    const where: any = {
      companyId,
      ...(activeOnly && { isActive: true }),
      ...(categoryId && { categoryId: parseInt(categoryId) }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { code: { contains: search, mode: 'insensitive' } },
          { sku: { contains: search, mode: 'insensitive' } },
        ]
      }),
    };

    const [productos, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          category: { select: { id: true, name: true } },
        },
        orderBy: { name: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.product.count({ where })
    ]);

    return NextResponse.json({
      data: productos,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    });
  } catch (error) {
    console.error('Error fetching productos:', error);
    return NextResponse.json({ error: 'Error al obtener productos' }, { status: 500 });
  }
}

// POST - Crear producto
export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.PRODUCTOS_CREATE);
    if (error) return error;

    const companyId = user!.companyId;

    // Get idempotency key (optional but recommended)
    const idempotencyKey = getIdempotencyKey(request);

    const body = await request.json();

    // Validar con Zod
    const validation = createProductSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const {
      name,
      code,
      description,
      categoryId,
      unit,
      costPrice,
      costCurrency,
      minStock,
      currentStock,
      volume,
      weight,
      location,
      blocksPerM2,
      isActive,
      images,
      volumeUnit,
      salePrice,
      marginMin,
      marginMax,
      barcode,
      sku,
      costType,
      recipeId,
      purchaseInputId,
      aplicaComision,
    } = validation.data;

    // Execute with idempotency support
    const idempotencyResult = await withIdempotency(
      idempotencyKey,
      companyId,
      'CREATE_PRODUCT',
      async () => {
        // Verificar código único en la empresa
        const existingCode = await prisma.product.findFirst({
          where: { companyId, code }
        });
        if (existingCode) {
          throw new Error('DUPLICATE_CODE');
        }

        const producto = await prisma.product.create({
          data: {
            name,
            code,
            description,
            categoryId: parseInt(categoryId),
            unit,
            costPrice: parseFloat(costPrice),
            costCurrency,
            minStock: parseInt(minStock),
            currentStock: parseInt(currentStock),
            volume: parseFloat(volume),
            weight: parseFloat(weight),
            location,
            blocksPerM2: blocksPerM2 ? parseInt(blocksPerM2) : null,
            isActive,
            aplicaComision: aplicaComision ?? true,
            images: images,
            volumeUnit,
            salePrice: salePrice ? parseFloat(salePrice) : null,
            marginMin: marginMin ? parseFloat(marginMin) : null,
            marginMax: marginMax ? parseFloat(marginMax) : null,
            barcode,
            sku,
            costType: costType || 'MANUAL',
            recipeId: recipeId || null,
            purchaseInputId: purchaseInputId || null,
            companyId,
            createdById: user!.id,
          },
          include: {
            category: { select: { id: true, name: true } },
          }
        });

        return producto;
      },
      {
        entityType: 'Product',
        getEntityId: (result) => result.id,
      }
    );

    return NextResponse.json(idempotencyResult.response, {
      status: idempotencyResult.isReplay ? 200 : 201,
      headers: idempotencyHeaders(idempotencyResult.idempotencyKey, idempotencyResult.isReplay),
    });
  } catch (error) {
    console.error('Error creating producto:', error);

    // Handle idempotency conflict error
    const idempotencyError = handleIdempotencyError(error);
    if (idempotencyError) return idempotencyError;

    // Handle duplicate code error
    if (error instanceof Error && error.message === 'DUPLICATE_CODE') {
      return NextResponse.json({ error: 'Ya existe un producto con ese código' }, { status: 400 });
    }

    return NextResponse.json({ error: 'Error al crear producto' }, { status: 500 });
  }
}
