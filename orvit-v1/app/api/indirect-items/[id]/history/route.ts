import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/shared-helpers';

export const dynamic = 'force-dynamic';

// GET /api/indirect-items/[id]/history - Obtener historial de un ítem indirecto por meses
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '12'); // Por defecto 12 meses

    // Verificar que el ítem indirecto existe
    const indirectItem = await prisma.indirectItem.findUnique({
      where: { id: params.id },
      select: { 
        id: true, 
        code: true, 
        label: true, 
        category: true,
        companyId: true,
      },
    });

    if (!indirectItem) {
      return NextResponse.json(
        { error: 'Ítem indirecto no encontrado' },
        { status: 404 }
      );
    }

    // Obtener historial mensual agrupado por mes
    const [monthlyHistory, total] = await Promise.all([
      prisma.monthlyIndirect.findMany({
        where: { itemId: params.id },
        orderBy: { month: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.monthlyIndirect.count({
        where: { itemId: params.id },
      }),
    ]);

    // Calcular estadísticas
    let totalAmount = 0;
    let maxAmount = 0;
    let minAmount = Infinity;
    let avgAmount = 0;

    if (monthlyHistory.length > 0) {
      monthlyHistory.forEach(record => {
        const amount = record.amount.toNumber();
        totalAmount += amount;
        maxAmount = Math.max(maxAmount, amount);
        minAmount = Math.min(minAmount, amount);
      });
      avgAmount = totalAmount / monthlyHistory.length;
      if (minAmount === Infinity) minAmount = 0;
    }

    // Formatear historial con cálculo de variaciones
    const historyWithVariations = monthlyHistory.map((record, index) => {
      const previousRecord = monthlyHistory[index + 1];
      let variation = null;
      let variationPct = null;

      if (previousRecord) {
        const currentAmount = record.amount.toNumber();
        const previousAmount = previousRecord.amount.toNumber();
        variation = currentAmount - previousAmount;
        if (previousAmount !== 0) {
          variationPct = (variation / previousAmount) * 100;
        }
      }

      return {
        ...record,
        amount: record.amount.toNumber(),
        variation,
        variationPct,
      };
    });

    return NextResponse.json({
      indirectItem: {
        id: indirectItem.id,
        code: indirectItem.code,
        label: indirectItem.label,
        category: indirectItem.category,
      },
      history: historyWithVariations,
      statistics: {
        totalRecords: total,
        totalAmount,
        avgAmount,
        maxAmount,
        minAmount,
      },
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching indirect item history:', error);
    return NextResponse.json(
      { error: 'Error al obtener historial del ítem indirecto' },
      { status: 500 }
    );
  }
}
