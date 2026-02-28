import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/shared-helpers';

export const dynamic = 'force-dynamic';

const CreatePriceHistorySchema = z.object({
  effectiveFrom: z.coerce.date(),
  price: z.number().positive('Precio debe ser positivo'),
});

// GET /api/inputs/[id]/history - Obtener historial de precios
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    // Verificar que el insumo existe
    const input = await prisma.inputItem.findUnique({
      where: { id: params.id },
      select: { id: true, name: true, companyId: true },
    });

    if (!input) {
      return NextResponse.json(
        { error: 'Insumo no encontrado' },
        { status: 404 }
      );
    }

    const [history, total] = await Promise.all([
      prisma.inputPriceHistory.findMany({
        where: { inputId: params.id },
        orderBy: { effectiveFrom: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.inputPriceHistory.count({
        where: { inputId: params.id },
      }),
    ]);

    // Marcar cuál es el precio vigente actual
    const now = new Date();
    const historyWithStatus = history.map((record, index) => ({
      ...record,
      isCurrent: index === 0 && record.effectiveFrom <= now,
      price: record.price.toNumber(),
    }));

    return NextResponse.json({
      input: {
        id: input.id,
        name: input.name,
      },
      history: historyWithStatus,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching price history:', error);
    return NextResponse.json(
      { error: 'Error al obtener historial de precios' },
      { status: 500 }
    );
  }
}

// POST /api/inputs/[id]/history - Agregar nuevo precio
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    const body = await request.json();
    const validatedData = CreatePriceHistorySchema.parse(body);

    // Verificar que el insumo existe
    const input = await prisma.inputItem.findUnique({
      where: { id: params.id },
    });

    if (!input) {
      return NextResponse.json(
        { error: 'Insumo no encontrado' },
        { status: 404 }
      );
    }

    // Verificar que no existe ya un precio para la misma fecha
    const existingPrice = await prisma.inputPriceHistory.findFirst({
      where: {
        inputId: params.id,
        effectiveFrom: validatedData.effectiveFrom,
      },
    });

    if (existingPrice) {
      return NextResponse.json(
        { error: 'Ya existe un precio para esta fecha' },
        { status: 400 }
      );
    }

    // Crear el registro en una transacción
    const result = await prisma.$transaction(async (tx) => {
      // Crear el registro de historial
      const newPriceHistory = await tx.inputPriceHistory.create({
        data: {
          companyId: input.companyId,
          inputId: params.id,
          effectiveFrom: validatedData.effectiveFrom,
          price: validatedData.price,
        },
      });

      // Si la fecha efectiva es actual o pasada, actualizar el precio actual del insumo
      const now = new Date();
      if (validatedData.effectiveFrom <= now) {
        // Buscar el precio más reciente vigente
        const latestPrice = await tx.inputPriceHistory.findFirst({
          where: {
            inputId: params.id,
            effectiveFrom: { lte: now },
          },
          orderBy: { effectiveFrom: 'desc' },
        });

        if (latestPrice) {
          await tx.inputItem.update({
            where: { id: params.id },
            data: { currentPrice: latestPrice.price },
          });
        }
      }

      return newPriceHistory;
    });

    return NextResponse.json({
      ...result,
      price: result.price.toNumber(),
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error creating price history:', error);
    return NextResponse.json(
      { error: 'Error al crear historial de precio' },
      { status: 500 }
    );
  }
}
