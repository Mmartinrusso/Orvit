import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthFromRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET /api/products/[id]/cost-history - Obtener historial de costos
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await getAuthFromRequest(request);
    if (!auth) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Verificar que el producto existe y pertenece a la empresa
    const product = await prisma.product.findFirst({
      where: {
        id,
        companyId: auth.companyId,
      },
      select: {
        id: true,
        name: true,
        costPrice: true,
        costCurrency: true,
        costType: true,
        lastCostUpdate: true,
      }
    });

    if (!product) {
      return NextResponse.json(
        { error: 'Producto no encontrado' },
        { status: 404 }
      );
    }

    // Obtener historial de costos usando ProductCostLog
    const costLogs = await prisma.productCostLog.findMany({
      where: {
        productId: id,
        companyId: auth.companyId,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      include: {
        createdBy: {
          select: { id: true, name: true }
        }
      }
    });

    // Contar total de registros
    const total = await prisma.productCostLog.count({
      where: {
        productId: id,
        companyId: auth.companyId,
      }
    });

    // Calcular estadisticas
    const stats = costLogs.length > 0
      ? {
          minCost: Math.min(...costLogs.map((l) => l.newCost)),
          maxCost: Math.max(...costLogs.map((l) => l.newCost)),
          avgCost:
            costLogs.reduce((acc, l) => acc + l.newCost, 0) / costLogs.length,
          firstRecord: costLogs[costLogs.length - 1]?.createdAt,
          lastRecord: costLogs[0]?.createdAt,
          totalChanges: total,
        }
      : null;

    // Transformar para incluir cambio porcentual
    const logsWithPercentage = costLogs.map((log) => ({
      ...log,
      changePercentage:
        log.previousCost > 0
          ? ((log.newCost - log.previousCost) / log.previousCost) * 100
          : 0,
    }));

    return NextResponse.json({
      product: {
        id: product.id,
        name: product.name,
        currentCost: product.costPrice,
        currency: product.costCurrency,
        costType: product.costType,
        lastUpdate: product.lastCostUpdate,
      },
      logs: logsWithPercentage,
      stats,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Error in GET /api/products/[id]/cost-history:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
