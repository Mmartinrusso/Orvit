import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import { logSalePriceChange } from '@/lib/ventas/price-change-alerts';

export const dynamic = 'force-dynamic';

// GET - Obtener producto por ID
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.PRODUCTOS_VIEW);
    if (error) return error;

    const id = params.id;
    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });

    const producto = await prisma.product.findFirst({
      where: { id, companyId: user!.companyId },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            parent: { select: { id: true, name: true } }
          }
        },
        recipe: {
          select: {
            id: true,
            name: true,
            status: true,
            base: true,
            validFrom: true,
            validTo: true,
            isActive: true,
          }
        },
        purchaseInput: {
          select: {
            id: true,
            name: true,
            currentPrice: true,
            supplier: { select: { id: true, name: true } }
          }
        },
        createdBy: { select: { id: true, name: true } },
      }
    });

    if (!producto) {
      return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });
    }

    return NextResponse.json(producto);
  } catch (error) {
    console.error('Error fetching producto:', error);
    return NextResponse.json({ error: 'Error al obtener producto' }, { status: 500 });
  }
}

// PUT - Actualizar producto
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.PRODUCTOS_EDIT);
    if (error) return error;

    const id = params.id;
    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });

    // Verificar que existe
    const existing = await prisma.product.findFirst({
      where: { id, companyId: user!.companyId }
    });
    if (!existing) {
      return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });
    }

    const body = await request.json();
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
    } = body;

    // Si cambia el código, verificar que sea único
    if (code && code !== existing.code) {
      const existingCode = await prisma.product.findFirst({
        where: { companyId: user!.companyId, code, id: { not: id } }
      });
      if (existingCode) {
        return NextResponse.json({ error: 'Ya existe otro producto con ese código' }, { status: 400 });
      }
    }

    // Detect salePrice change for audit logging
    const oldSalePrice = existing.salePrice;
    const newSalePrice = salePrice !== undefined ? (salePrice ? parseFloat(salePrice) : null) : undefined;

    const producto = await prisma.product.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(code !== undefined && { code }),
        ...(description !== undefined && { description }),
        ...(categoryId !== undefined && { categoryId: parseInt(categoryId) }),
        ...(unit !== undefined && { unit }),
        ...(costPrice !== undefined && { costPrice: parseFloat(costPrice) }),
        ...(costCurrency !== undefined && { costCurrency }),
        ...(minStock !== undefined && { minStock: parseInt(minStock) }),
        ...(currentStock !== undefined && { currentStock: parseInt(currentStock) }),
        ...(volume !== undefined && { volume: parseFloat(volume) }),
        ...(weight !== undefined && { weight: parseFloat(weight) }),
        ...(location !== undefined && { location }),
        ...(blocksPerM2 !== undefined && { blocksPerM2: blocksPerM2 ? parseInt(blocksPerM2) : null }),
        ...(isActive !== undefined && { isActive }),
        ...(images !== undefined && { images }),
        ...(volumeUnit !== undefined && { volumeUnit }),
        ...(salePrice !== undefined && { salePrice: salePrice ? parseFloat(salePrice) : null }),
        ...(marginMin !== undefined && { marginMin: marginMin ? parseFloat(marginMin) : null }),
        ...(marginMax !== undefined && { marginMax: marginMax ? parseFloat(marginMax) : null }),
        ...(barcode !== undefined && { barcode }),
        ...(sku !== undefined && { sku }),
        ...(costType !== undefined && { costType }),
        ...(recipeId !== undefined && { recipeId }),
        ...(purchaseInputId !== undefined && { purchaseInputId }),
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            parent: { select: { id: true, name: true } }
          }
        },
      }
    });

    // Log sale price change if it actually changed
    if (newSalePrice !== undefined && oldSalePrice !== newSalePrice) {
      await logSalePriceChange({
        productId: id,
        companyId: user!.companyId,
        previousPrice: oldSalePrice ?? undefined,
        newPrice: newSalePrice ?? 0,
        salesPriceListId: undefined,
        changeSource: 'PRODUCT_DIRECT',
        createdById: user!.id,
      });
    }

    return NextResponse.json(producto);
  } catch (error) {
    console.error('Error updating producto:', error);
    return NextResponse.json({ error: 'Error al actualizar producto' }, { status: 500 });
  }
}

// DELETE - Eliminar producto (soft delete - desactivar)
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.PRODUCTOS_DELETE);
    if (error) return error;

    const id = params.id;
    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });

    // Verificar que existe
    const existing = await prisma.product.findFirst({
      where: { id, companyId: user!.companyId }
    });
    if (!existing) {
      return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });
    }

    // Soft delete - desactivar en lugar de eliminar
    await prisma.product.update({
      where: { id },
      data: { isActive: false }
    });

    return NextResponse.json({ message: 'Producto desactivado' });
  } catch (error) {
    console.error('Error deleting producto:', error);
    return NextResponse.json({ error: 'Error al eliminar producto' }, { status: 500 });
  }
}
