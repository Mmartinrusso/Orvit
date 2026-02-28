import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/shared-helpers';
import { CreateVolumetricParamSchema, UpdateVolumetricParamSchema } from '@/lib/validations/costs';
import { z } from 'zod';

// GET /api/costs/volumetric/[productId] - Get volumetric params for a product
export async function GET(
  request: NextRequest,
  { params }: { params: { productId: string } }
) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    const product = await prisma.costProduct.findUnique({
      where: { id: params.productId },
      include: {
        volumetricParam: true,
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

    if (product.costMethod !== 'VOLUMETRIC') {
      return NextResponse.json(
        { error: 'La configuración volumétrica solo aplica para productos con método VOLUMETRIC' },
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
      volumetricParam: product.volumetricParam,
    });
  } catch (error) {
    console.error('Error fetching volumetric params:', error);
    return NextResponse.json(
      { error: 'Error al obtener parámetros volumétricos' },
      { status: 500 }
    );
  }
}

// PUT /api/costs/volumetric/[productId] - Create or update volumetric params
export async function PUT(
  request: NextRequest,
  { params }: { params: { productId: string } }
) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    const body = await request.json();
    const validatedData = UpdateVolumetricParamSchema.parse(body);

    // Check if product exists and is VOLUMETRIC method
    const product = await prisma.costProduct.findUnique({
      where: { id: params.productId },
    });

    if (!product) {
      return NextResponse.json(
        { error: 'Producto no encontrado' },
        { status: 404 }
      );
    }

    if (product.costMethod !== 'VOLUMETRIC') {
      return NextResponse.json(
        { error: 'La configuración volumétrica solo aplica para productos con método VOLUMETRIC' },
        { status: 400 }
      );
    }

    // Upsert volumetric param
    const volumetricParam = await prisma.volumetricParam.upsert({
      where: { productId: params.productId },
      update: validatedData,
      create: {
        productId: params.productId,
        ...validatedData,
      },
    });

    return NextResponse.json({
      message: 'Parámetros volumétricos actualizados exitosamente',
      volumetricParam,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error updating volumetric params:', error);
    return NextResponse.json(
      { error: 'Error al actualizar parámetros volumétricos' },
      { status: 500 }
    );
  }
}
