import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/shared-helpers';

// Schemas de validación
const UpdateIndirectItemSchema = z.object({
  code: z.string().min(1, 'Código requerido').max(50, 'Código muy largo').optional(),
  label: z.string().min(1, 'Etiqueta requerida').max(100, 'Etiqueta muy larga').optional(),
  category: z.enum(['IMP_SERV', 'SOCIAL', 'VEHICLES', 'MKT', 'UTILITIES', 'OTHER']).optional(),
  currentPrice: z.number().optional().nullable(),
});

// GET /api/indirect-items/[id] - Obtener un ítem indirecto específico
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    const { id } = params;

    const indirectItem = await prisma.indirectItem.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            monthlyIndirects: true,
            priceHistory: true,
          },
        },
        priceHistory: {
          orderBy: { effectiveFrom: 'desc' },
          take: 5, // Últimos 5 cambios de precio
        },
      },
    });

    if (!indirectItem) {
      return NextResponse.json(
        { error: 'Ítem indirecto no encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json(indirectItem);
  } catch (error) {
    console.error('Error fetching indirect item:', error);
    return NextResponse.json(
      { error: 'Error al obtener ítem indirecto' },
      { status: 500 }
    );
  }
}

// PUT /api/indirect-items/[id] - Actualizar ítem indirecto
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    const { id } = params;
    const body = await request.json();
    
    const validatedData = UpdateIndirectItemSchema.parse(body);

    // Verificar que el ítem existe
    const existingItem = await prisma.indirectItem.findUnique({
      where: { id },
    });

    if (!existingItem) {
      return NextResponse.json(
        { error: 'Ítem indirecto no encontrado' },
        { status: 404 }
      );
    }

    // Si se está actualizando el precio, crear un nuevo registro en el historial
    let priceHistoryCreated = false;
    if (validatedData.currentPrice != null && validatedData.currentPrice !== existingItem.currentPrice?.toNumber()) {
      await prisma.indirectPriceHistory.create({
        data: {
          companyId: existingItem.companyId,
          indirectId: id,
          price: validatedData.currentPrice,
          effectiveFrom: new Date(),
        },
      });
      priceHistoryCreated = true;
    }

    // Actualizar el ítem
    const updatedItem = await prisma.indirectItem.update({
      where: { id },
      data: validatedData,
      include: {
        _count: {
          select: {
            monthlyIndirects: true,
            priceHistory: true,
          },
        },
      },
    });

    return NextResponse.json({
      ...updatedItem,
      priceHistoryCreated,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error updating indirect item:', error);
    return NextResponse.json(
      { error: 'Error al actualizar ítem indirecto' },
      { status: 500 }
    );
  }
}

// DELETE /api/indirect-items/[id] - Eliminar ítem indirecto
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    const { id } = params;

    // Verificar que el ítem existe
    const existingItem = await prisma.indirectItem.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            monthlyIndirects: true,
          },
        },
      },
    });

    if (!existingItem) {
      return NextResponse.json(
        { error: 'Ítem indirecto no encontrado' },
        { status: 404 }
      );
    }

    // Verificar si tiene registros mensuales asociados
    if (existingItem._count.monthlyIndirects > 0) {
      return NextResponse.json(
        { error: 'No se puede eliminar: el ítem tiene registros mensuales asociados' },
        { status: 400 }
      );
    }

    // Eliminar el ítem (el historial de precios se elimina automáticamente por CASCADE)
    await prisma.indirectItem.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting indirect item:', error);
    return NextResponse.json(
      { error: 'Error al eliminar ítem indirecto' },
      { status: 500 }
    );
  }
}
