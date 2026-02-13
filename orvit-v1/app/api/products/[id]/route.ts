import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthFromRequest } from '@/lib/auth';
import { validateRequest } from '@/lib/validations/helpers';
import { UpdateProductSchema } from '@/lib/validations/products';
import { invalidateCache } from '@/lib/cache/cache-manager';
import { invalidationPatterns } from '@/lib/cache/cache-keys';

export const dynamic = 'force-dynamic';

// GET /api/products/[id] - Obtener producto por ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await getAuthFromRequest(request);
    if (!auth) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = params;

    const product = await prisma.product.findFirst({
      where: {
        id,
        companyId: auth.companyId,
      },
      include: {
        category: {
          include: {
            parent: {
              select: { id: true, name: true }
            }
          }
        },
        recipe: {
          select: { id: true, name: true, totalCost: true }
        },
        purchaseInput: {
          select: { id: true, name: true, currentPrice: true, supplier: true }
        },
        productionWorkCenter: {
          select: { id: true, name: true, code: true }
        },
        costLogs: {
          take: 5,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            previousCost: true,
            newCost: true,
            changeSource: true,
            createdAt: true,
          }
        },
        createdBy: {
          select: { id: true, name: true }
        }
      }
    });

    if (!product) {
      return NextResponse.json(
        { error: 'Producto no encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json(product);
  } catch (error) {
    console.error('Error in GET /api/products/[id]:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// PUT /api/products/[id] - Actualizar producto
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await getAuthFromRequest(request);
    if (!auth) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = params;
    const body = await request.json();
    const validation = validateRequest(UpdateProductSchema, body);
    if (!validation.success) return validation.response;

    // Verificar que el producto existe y pertenece a la empresa
    const existingProduct = await prisma.product.findFirst({
      where: {
        id,
        companyId: auth.companyId,
      }
    });

    if (!existingProduct) {
      return NextResponse.json(
        { error: 'Producto no encontrado' },
        { status: 404 }
      );
    }

    // Validaciones básicas
    if (!body.name || !body.code) {
      return NextResponse.json(
        { error: 'Nombre y código son requeridos' },
        { status: 400 }
      );
    }

    // Verificar que el código no esté duplicado (si cambió)
    if (body.code !== existingProduct.code) {
      const duplicateCode = await prisma.product.findFirst({
        where: {
          companyId: auth.companyId,
          code: body.code,
          id: { not: id }
        }
      });

      if (duplicateCode) {
        return NextResponse.json(
          { error: 'Ya existe un producto con ese código' },
          { status: 400 }
        );
      }
    }

    // Determinar si hubo cambio de costo para registrar en el log
    const costChanged = body.costPrice !== undefined &&
                        body.costPrice !== existingProduct.costPrice;

    // Actualizar producto
    const updatedProduct = await prisma.product.update({
      where: { id },
      data: {
        name: body.name,
        code: body.code,
        description: body.description || '',
        categoryId: body.categoryId,
        unit: body.unit,
        costPrice: body.costPrice,
        costCurrency: body.costCurrency,
        costType: body.costType,
        recipeId: body.recipeId || null,
        purchaseInputId: body.purchaseInputId || null,
        currentStock: body.currentStock,
        minStock: body.minStock,
        location: body.location || '',
        weight: body.weight,
        volume: body.volume,
        volumeUnit: body.volumeUnit,
        blocksPerM2: body.blocksPerM2,
        isActive: body.isActive ?? true,
        images: body.images || [],
        files: body.files || [],
        image: body.image,
        // Nuevos campos
        salePrice: body.salePrice,
        saleCurrency: body.saleCurrency || 'ARS',
        marginMin: body.marginMin,
        marginMax: body.marginMax,
        barcode: body.barcode,
        sku: body.sku,
        tags: body.tags,
        trackBatches: body.trackBatches ?? false,
        trackExpiration: body.trackExpiration ?? false,
        alertStockEmail: body.alertStockEmail ?? true,
        alertStockDays: body.alertStockDays,
        lastCostUpdate: costChanged ? new Date() : existingProduct.lastCostUpdate,
        // Planta de producción
        productionWorkCenterId: body.productionWorkCenterId !== undefined
          ? (body.productionWorkCenterId ? parseInt(body.productionWorkCenterId) : null)
          : existingProduct.productionWorkCenterId,
        // Sector de producción
        productionSectorId: body.productionSectorId !== undefined
          ? (body.productionSectorId ? parseInt(body.productionSectorId) : null)
          : (existingProduct as any).productionSectorId,
      },
      include: {
        category: true,
        productionWorkCenter: {
          select: { id: true, name: true, code: true }
        },
      }
    });

    // Si el costo cambió, registrar en el historial
    if (costChanged && body.costPrice !== undefined) {
      await prisma.productCostLog.create({
        data: {
          productId: id,
          companyId: auth.companyId,
          previousCost: existingProduct.costPrice,
          newCost: body.costPrice,
          previousStock: existingProduct.currentStock,
          newStock: body.currentStock ?? existingProduct.currentStock,
          changeSource: 'MANUAL',
          createdById: auth.userId,
          notes: 'Actualización manual desde edición de producto',
        }
      });
    }

    // Invalidar cache de catálogo de productos
    await invalidateCache(invalidationPatterns.products(auth.companyId));

    return NextResponse.json(updatedProduct);
  } catch (error) {
    console.error('Error in PUT /api/products/[id]:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// DELETE /api/products/[id] - Eliminar producto (soft delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await getAuthFromRequest(request);
    if (!auth) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = params;

    // Verificar que el producto existe y pertenece a la empresa
    const existingProduct = await prisma.product.findFirst({
      where: {
        id,
        companyId: auth.companyId,
      }
    });

    if (!existingProduct) {
      return NextResponse.json(
        { error: 'Producto no encontrado' },
        { status: 404 }
      );
    }

    // Verificar si el producto está siendo usado en ventas activas
    const productInUse = await prisma.saleItem.findFirst({
      where: {
        productId: id,
        sale: {
          estado: { in: ['BORRADOR', 'CONFIRMADA', 'PARCIALMENTE_ENTREGADA'] }
        }
      }
    });

    if (productInUse) {
      return NextResponse.json(
        { error: 'No se puede eliminar: el producto está siendo usado en ventas activas' },
        { status: 400 }
      );
    }

    // Soft delete: marcar como inactivo
    await prisma.product.update({
      where: { id },
      data: { isActive: false }
    });

    // Invalidar cache de catálogo de productos
    await invalidateCache(invalidationPatterns.products(auth.companyId));

    return NextResponse.json({
      message: 'Producto desactivado correctamente',
      id
    });
  } catch (error) {
    console.error('Error in DELETE /api/products/[id]:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
