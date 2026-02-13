import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { CreatePerUnitBOMSchema } from '@/lib/validations/costs';
import { z } from 'zod';

// GET /api/costs/bom/[productId] - Get BOM for a product
export async function GET(
  request: NextRequest,
  { params }: { params: { productId: string } }
) {
  try {
    const product = await prisma.costProduct.findUnique({
      where: { id: params.productId },
      include: {
        perUnitBOM: {
          include: {
            input: true,
          },
        },
        line: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!product) {
      return NextResponse.json(
        { error: 'Producto no encontrado' },
        { status: 404 }
      );
    }

    if (product.costMethod !== 'PER_UNIT_BOM') {
      return NextResponse.json(
        { error: 'La configuración de BOM solo aplica para productos con método PER_UNIT_BOM' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      product: {
        id: product.id,
        name: product.name,
        costMethod: product.costMethod,
        unitLabel: product.unitLabel,
        line: product.line,
      },
      bomItems: product.perUnitBOM,
    });
  } catch (error) {
    console.error('Error fetching BOM:', error);
    return NextResponse.json(
      { error: 'Error al obtener BOM' },
      { status: 500 }
    );
  }
}

// PUT /api/costs/bom/[productId] - Replace BOM for a product
export async function PUT(
  request: NextRequest,
  { params }: { params: { productId: string } }
) {
  try {
    const body = await request.json();
    const validatedData = CreatePerUnitBOMSchema.parse({
      productId: params.productId,
      items: body.items,
    });

    // Check if product exists and is PER_UNIT_BOM method
    const product = await prisma.costProduct.findUnique({
      where: { id: params.productId },
    });

    if (!product) {
      return NextResponse.json(
        { error: 'Producto no encontrado' },
        { status: 404 }
      );
    }

    if (product.costMethod !== 'PER_UNIT_BOM') {
      return NextResponse.json(
        { error: 'La configuración de BOM solo aplica para productos con método PER_UNIT_BOM' },
        { status: 400 }
      );
    }

    // Validate all input items exist
    const inputIds = validatedData.items.map(item => item.inputId);
    const existingInputs = await prisma.inputItem.findMany({
      where: { id: { in: inputIds } },
      select: { id: true },
    });

    if (existingInputs.length !== inputIds.length) {
      return NextResponse.json(
        { error: 'Uno o más insumos no existen' },
        { status: 400 }
      );
    }

    // Replace BOM items using transaction
    const result = await prisma.$transaction(async (tx) => {
      // Delete existing BOM items
      await tx.perUnitBOM.deleteMany({
        where: { productId: params.productId },
      });

      // Create new BOM items
      const bomItems = await Promise.all(
        validatedData.items.map(item =>
          tx.perUnitBOM.create({
            data: {
              productId: params.productId,
              inputId: item.inputId,
              qtyPerOut: item.qtyPerOut,
              unitLabel: item.unitLabel,
            },
            include: {
              input: true,
            },
          })
        )
      );

      return bomItems;
    });

    return NextResponse.json({
      message: 'BOM actualizado exitosamente',
      bomItems: result,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error updating BOM:', error);
    return NextResponse.json(
      { error: 'Error al actualizar BOM' },
      { status: 500 }
    );
  }
}
