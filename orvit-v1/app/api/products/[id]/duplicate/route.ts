import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthFromRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// POST /api/products/[id]/duplicate - Duplicar un producto
export async function POST(
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

    // Obtener el producto original
    const originalProduct = await prisma.product.findFirst({
      where: {
        id,
        companyId: auth.companyId,
      }
    });

    if (!originalProduct) {
      return NextResponse.json(
        { error: 'Producto no encontrado' },
        { status: 404 }
      );
    }

    // Generar nuevo codigo unico
    let newCode = body.code || `${originalProduct.code}-COPIA`;
    let codeExists = true;
    let attempts = 0;

    while (codeExists && attempts < 10) {
      const existing = await prisma.product.findFirst({
        where: {
          companyId: auth.companyId,
          code: newCode,
        }
      });

      if (!existing) {
        codeExists = false;
      } else {
        attempts++;
        newCode = `${originalProduct.code}-COPIA-${attempts}`;
      }
    }

    if (codeExists) {
      return NextResponse.json(
        { error: 'No se pudo generar un codigo unico para el producto' },
        { status: 400 }
      );
    }

    // Crear el producto duplicado
    const duplicatedProduct = await prisma.product.create({
      data: {
        // Datos basicos
        name: body.name || `${originalProduct.name} (Copia)`,
        code: newCode,
        description: originalProduct.description,
        categoryId: originalProduct.categoryId,
        unit: originalProduct.unit,
        isActive: true,
        companyId: auth.companyId,
        createdById: auth.userId,

        // Costos
        costPrice: originalProduct.costPrice,
        costCurrency: originalProduct.costCurrency,
        costType: originalProduct.costType,
        recipeId: originalProduct.recipeId,
        purchaseInputId: originalProduct.purchaseInputId,
        weightedAverageCost: originalProduct.weightedAverageCost,
        costCalculationStock: null,
        lastCostUpdate: new Date(),

        // Precios de venta
        salePrice: originalProduct.salePrice,
        saleCurrency: originalProduct.saleCurrency,
        marginMin: originalProduct.marginMin,
        marginMax: originalProduct.marginMax,

        // Stock (empezar en 0)
        currentStock: 0,
        minStock: originalProduct.minStock,
        location: originalProduct.location,

        // Medidas
        weight: originalProduct.weight,
        volume: originalProduct.volume,
        volumeUnit: originalProduct.volumeUnit,
        blocksPerM2: originalProduct.blocksPerM2,

        // Codigos
        barcode: null, // No copiar barcode (debe ser unico)
        sku: null, // No copiar SKU (debe ser unico)

        // Configuracion
        trackBatches: originalProduct.trackBatches,
        trackExpiration: originalProduct.trackExpiration,
        alertStockEmail: originalProduct.alertStockEmail,
        alertStockDays: originalProduct.alertStockDays,
        tags: originalProduct.tags,

        // Multimedia
        images: originalProduct.images,
        files: originalProduct.files,
        image: originalProduct.image,
      },
      include: {
        category: true,
      }
    });

    return NextResponse.json({
      message: 'Producto duplicado exitosamente',
      product: duplicatedProduct,
      originalId: id,
    }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/products/[id]/duplicate:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
