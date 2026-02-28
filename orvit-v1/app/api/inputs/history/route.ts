import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/shared-helpers';

export const dynamic = 'force-dynamic';

// GET /api/inputs/history - Obtener historial completo de precios de insumos
export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId es requerido' },
        { status: 400 }
      );
    }

    // Obtener historial de precios con información del insumo
    const [history, total] = await Promise.all([
      prisma.inputPriceHistory.findMany({
        where: { companyId: parseInt(companyId) },
        include: {
          input: {
            select: {
              id: true,
              name: true,
              unitLabel: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.inputPriceHistory.count({
        where: { companyId: parseInt(companyId) },
      }),
    ]);

    // Calcular porcentajes de cambio
    const enrichedHistory = await Promise.all(
      history.map(async (entry) => {
        // Buscar el precio anterior
        const previousEntry = await prisma.inputPriceHistory.findFirst({
          where: {
            inputId: entry.inputId,
            effectiveFrom: {
              lt: entry.effectiveFrom,
            },
          },
          orderBy: { effectiveFrom: 'desc' },
        });

        let changePercent: number | undefined;
        let previousPrice: number | undefined;

        if (previousEntry) {
          previousPrice = previousEntry.price.toNumber();
          const currentPrice = entry.price.toNumber();
          changePercent = ((currentPrice - previousPrice) / previousPrice) * 100;
        }

        return {
          id: entry.id,
          inputId: entry.inputId,
          inputName: entry.input.name,
          unitLabel: entry.input.unitLabel,
          price: entry.price.toNumber(),
          effectiveFrom: entry.effectiveFrom.toISOString(),
          createdAt: entry.createdAt.toISOString(),
          previousPrice,
          changePercent,
        };
      })
    );

    // Calcular estadísticas
    const increases = enrichedHistory.filter(h => h.changePercent && h.changePercent > 0);
    const decreases = enrichedHistory.filter(h => h.changePercent && h.changePercent < 0);
    const uniqueInputs = new Set(enrichedHistory.map(h => h.inputId)).size;
    
    const avgChange = enrichedHistory.filter(h => h.changePercent !== undefined).length > 0
      ? enrichedHistory
          .filter(h => h.changePercent !== undefined)
          .reduce((sum, h) => sum + (h.changePercent || 0), 0) / 
        enrichedHistory.filter(h => h.changePercent !== undefined).length
      : 0;

    return NextResponse.json({
      history: enrichedHistory,
      statistics: {
        totalRecords: total,
        totalDisplayed: enrichedHistory.length,
        uniqueInputs,
        increases: increases.length,
        decreases: decreases.length,
        avgChange,
      },
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching inputs history:', error);
    return NextResponse.json(
      { error: 'Error al obtener historial de insumos' },
      { status: 500 }
    );
  }
}
