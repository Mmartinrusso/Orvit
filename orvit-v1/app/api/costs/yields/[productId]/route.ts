import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { CreateYieldConfigSchema, UpdateYieldConfigSchema } from '@/lib/validations/costs';
import { z } from 'zod';

// GET /api/costs/yields/[productId] - Get yield config for a product
export async function GET(
  request: NextRequest,
  { params }: { params: { productId: string } }
) {
  try {
    const product = await prisma.costProduct.findUnique({
      where: { id: params.productId },
      include: {
        yieldConfig: true,
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

    if (product.costMethod !== 'BATCH') {
      return NextResponse.json(
        { error: 'La configuración de rendimientos solo aplica para productos con método BATCH' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      product: {
        id: product.id,
        name: product.name,
        costMethod: product.costMethod,
        line: product.line,
      },
      yieldConfig: product.yieldConfig,
    });
  } catch (error) {
    console.error('Error fetching yield config:', error);
    return NextResponse.json(
      { error: 'Error al obtener configuración de rendimientos' },
      { status: 500 }
    );
  }
}

// PUT /api/costs/yields/[productId] - Create or update yield config
export async function PUT(
  request: NextRequest,
  { params }: { params: { productId: string } }
) {
  try {
    const body = await request.json();
    const validatedData = UpdateYieldConfigSchema.parse(body);

    // Check if product exists and is BATCH method
    const product = await prisma.costProduct.findUnique({
      where: { id: params.productId },
    });

    if (!product) {
      return NextResponse.json(
        { error: 'Producto no encontrado' },
        { status: 404 }
      );
    }

    if (product.costMethod !== 'BATCH') {
      return NextResponse.json(
        { error: 'La configuración de rendimientos solo aplica para productos con método BATCH' },
        { status: 400 }
      );
    }

    // Upsert yield config
    const yieldConfig = await prisma.yieldConfig.upsert({
      where: { productId: params.productId },
      update: validatedData,
      create: {
        productId: params.productId,
        ...validatedData,
      },
    });

    return NextResponse.json({
      message: 'Configuración de rendimientos actualizada exitosamente',
      yieldConfig,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error updating yield config:', error);
    return NextResponse.json(
      { error: 'Error al actualizar configuración de rendimientos' },
      { status: 500 }
    );
  }
}
