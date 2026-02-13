import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

// Schema de validación para agregar historial de precio
const AddPriceHistorySchema = z.object({
  price: z.number().positive('El precio debe ser mayor a 0'),
  effectiveFrom: z.string().datetime().optional(), // Si no se proporciona, usa la fecha actual
});

// GET /api/indirect-items/[id]/price-history - Obtener historial de precios
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50;

    // Verificar que el ítem existe
    const indirectItem = await prisma.indirectItem.findUnique({
      where: { id },
      select: { id: true, code: true, label: true },
    });

    if (!indirectItem) {
      return NextResponse.json(
        { error: 'Ítem indirecto no encontrado' },
        { status: 404 }
      );
    }

    // Obtener el historial de precios
    const priceHistory = await prisma.indirectPriceHistory.findMany({
      where: { indirectId: id },
      orderBy: { effectiveFrom: 'desc' },
      take: limit,
    });

    // Calcular porcentajes de cambio
    const historyWithChanges = priceHistory.map((entry, index) => {
      let changePct = null;
      if (index < priceHistory.length - 1) {
        const prevPrice = priceHistory[index + 1].price.toNumber();
        const currentPrice = entry.price.toNumber();
        changePct = ((currentPrice - prevPrice) / prevPrice) * 100;
      }
      
      return {
        ...entry,
        price: entry.price.toNumber(),
        changePct: changePct ? Math.round(changePct * 100) / 100 : null,
      };
    });

    return NextResponse.json({
      indirectItem,
      priceHistory: historyWithChanges,
      total: priceHistory.length,
    });
  } catch (error) {
    console.error('Error fetching price history:', error);
    return NextResponse.json(
      { error: 'Error al obtener historial de precios' },
      { status: 500 }
    );
  }
}

// POST /api/indirect-items/[id]/price-history - Agregar entrada al historial
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();
    
    const validatedData = AddPriceHistorySchema.parse(body);

    // Verificar que el ítem existe
    const indirectItem = await prisma.indirectItem.findUnique({
      where: { id },
    });

    if (!indirectItem) {
      return NextResponse.json(
        { error: 'Ítem indirecto no encontrado' },
        { status: 404 }
      );
    }

    const effectiveFrom = validatedData.effectiveFrom 
      ? new Date(validatedData.effectiveFrom)
      : new Date();

    // Verificar que no haya otra entrada para la misma fecha
    const existingEntry = await prisma.indirectPriceHistory.findFirst({
      where: {
        indirectId: id,
        effectiveFrom: {
          gte: new Date(effectiveFrom.getFullYear(), effectiveFrom.getMonth(), effectiveFrom.getDate()),
          lt: new Date(effectiveFrom.getFullYear(), effectiveFrom.getMonth(), effectiveFrom.getDate() + 1),
        },
      },
    });

    if (existingEntry) {
      return NextResponse.json(
        { error: 'Ya existe una entrada de precio para esta fecha' },
        { status: 400 }
      );
    }

    // Crear la nueva entrada de historial
    const newHistoryEntry = await prisma.indirectPriceHistory.create({
      data: {
        companyId: indirectItem.companyId,
        indirectId: id,
        price: validatedData.price,
        effectiveFrom,
      },
    });

    // Actualizar el precio actual del ítem si esta entrada es la más reciente
    const latestEntry = await prisma.indirectPriceHistory.findFirst({
      where: { indirectId: id },
      orderBy: { effectiveFrom: 'desc' },
    });

    if (latestEntry?.id === newHistoryEntry.id) {
      await prisma.indirectItem.update({
        where: { id },
        data: { currentPrice: validatedData.price },
      });
    }

    return NextResponse.json({
      ...newHistoryEntry,
      price: newHistoryEntry.price.toNumber(),
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error adding price history:', error);
    return NextResponse.json(
      { error: 'Error al agregar entrada al historial' },
      { status: 500 }
    );
  }
}
