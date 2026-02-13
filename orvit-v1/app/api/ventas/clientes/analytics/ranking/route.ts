import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import { getViewMode, applyViewMode } from '@/lib/view-mode';
import { startOfMonth, endOfMonth, subMonths } from 'date-fns';

export const dynamic = 'force-dynamic';

type SortField = 'facturacion' | 'margen' | 'frecuencia' | 'dso' | 'score';
type Segment = 'A' | 'B' | 'C';

interface ClientRanking {
  position: number;
  client: {
    id: string;
    legalName: string;
    name: string | null;
    email: string;
    sellerId: number | null;
    sellerName: string | null;
  };
  metrics: {
    totalRevenue: number;
    invoiceCount: number;
    averageTicket: number;
    totalMargin: number;
    marginPercentage: number;
    dso: number;
    score: number;
    growthRate: number;
  };
  segment: Segment; // A, B, C (Pareto)
  alerts: number;
}

interface RankingResponse {
  periodo: {
    desde: Date;
    hasta: Date;
  };
  ranking: ClientRanking[];
  summary: {
    totalClients: number;
    totalRevenue: number;
    averageTicket: number;
    segmentDistribution: {
      A: { count: number; revenue: number; percentage: number };
      B: { count: number; revenue: number; percentage: number };
      C: { count: number; revenue: number; percentage: number };
    };
  };
}

// GET: Obtener ranking de clientes
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.CLIENTES_VIEW);
    if (error) return error;

    const companyId = user!.companyId;
    const viewMode = getViewMode(request);
    const { searchParams } = new URL(request.url);

    // Parse query parameters
    const fechaDesdeParam = searchParams.get('fechaDesde');
    const fechaHastaParam = searchParams.get('fechaHasta');
    const ordenarPor = (searchParams.get('ordenarPor') || 'facturacion') as SortField;
    const sellerId = searchParams.get('sellerId')
      ? parseInt(searchParams.get('sellerId')!, 10)
      : null;
    const limite = parseInt(searchParams.get('limite') || '100', 10);
    const segmento = searchParams.get('segmento') as Segment | null;

    // Default date range: last 3 months
    const fechaHasta = fechaHastaParam ? new Date(fechaHastaParam) : endOfMonth(new Date());
    const fechaDesde = fechaDesdeParam
      ? new Date(fechaDesdeParam)
      : startOfMonth(subMonths(new Date(), 2));

    // Obtener todos los clientes activos (con filtro de vendedor si aplica)
    const clientsWhere: any = {
      companyId,
      isActive: true,
    };
    if (sellerId) {
      clientsWhere.sellerId = sellerId;
    }

    const clients = await prisma.client.findMany({
      where: clientsWhere,
      select: {
        id: true,
        legalName: true,
        name: true,
        email: true,
        sellerId: true,
        seller: {
          select: {
            name: true,
          },
        },
      },
    });

    const clientMetrics: ClientRanking[] = [];
    let totalRevenue = 0;

    // Procesar cada cliente
    for (const client of clients) {
      // Obtener facturas del período
      const invoices = await prisma.salesInvoice.findMany({
        where: applyViewMode(
          {
            clientId: client.id,
            companyId,
            fechaEmision: { gte: fechaDesde, lte: fechaHasta },
            estado: { notIn: ['CANCELADA', 'ANULADA'] },
          },
          viewMode
        ),
        select: {
          id: true,
          total: true,
          fechaEmision: true,
          fechaVencimiento: true,
          saldoPendiente: true,
        },
      });

      const revenue = invoices.reduce((sum, inv) => sum + Number(inv.total || 0), 0);

      // Solo incluir clientes con ventas
      if (revenue === 0) continue;

      const invoiceCount = invoices.length;
      const averageTicket = invoiceCount > 0 ? revenue / invoiceCount : 0;

      // Calcular DSO simplificado (promedio días desde emisión)
      let dso = 0;
      if (invoices.length > 0) {
        const totalDays = invoices.reduce((sum, inv) => {
          const daysSinceInvoice = Math.floor(
            (new Date().getTime() - inv.fechaEmision.getTime()) / (1000 * 60 * 60 * 24)
          );
          return sum + daysSinceInvoice;
        }, 0);
        dso = Math.round(totalDays / invoices.length);
      }

      // Calcular margen (simplificado - TODO: obtener costos reales)
      const totalMargin = revenue * 0.25; // Asumiendo 25% de margen
      const marginPercentage = 25;

      // Calcular tasa de crecimiento (comparar con período anterior)
      const prevPeriodStart = subMonths(fechaDesde, 3);
      const prevPeriodEnd = subMonths(fechaHasta, 3);
      const prevInvoices = await prisma.salesInvoice.aggregate({
        where: applyViewMode(
          {
            clientId: client.id,
            companyId,
            fechaEmision: { gte: prevPeriodStart, lte: prevPeriodEnd },
            estado: { notIn: ['CANCELADA', 'ANULADA'] },
          },
          viewMode
        ),
        _sum: {
          total: true,
        },
      });

      const prevRevenue = Number(prevInvoices._sum.total || 0);
      const growthRate = prevRevenue > 0 ? ((revenue - prevRevenue) / prevRevenue) * 100 : 0;

      // Obtener número de alertas (simplificado)
      const alertCount = 0; // TODO: Calcular desde endpoint de alertas

      // Score simplificado
      const score = Math.min(Math.round((revenue / 100000) * 100), 100);

      clientMetrics.push({
        position: 0, // Se asignará después del ordenamiento
        client: {
          id: client.id,
          legalName: client.legalName,
          name: client.name,
          email: client.email,
          sellerId: client.sellerId,
          sellerName: client.seller?.name || null,
        },
        metrics: {
          totalRevenue: Math.round(revenue * 100) / 100,
          invoiceCount,
          averageTicket: Math.round(averageTicket * 100) / 100,
          totalMargin: Math.round(totalMargin * 100) / 100,
          marginPercentage,
          dso,
          score,
          growthRate: Math.round(growthRate * 100) / 100,
        },
        segment: 'C', // Se asignará después
        alerts: alertCount,
      });

      totalRevenue += revenue;
    }

    // Ordenar según el campo especificado
    clientMetrics.sort((a, b) => {
      switch (ordenarPor) {
        case 'facturacion':
          return b.metrics.totalRevenue - a.metrics.totalRevenue;
        case 'margen':
          return b.metrics.totalMargin - a.metrics.totalMargin;
        case 'frecuencia':
          return b.metrics.invoiceCount - a.metrics.invoiceCount;
        case 'dso':
          return a.metrics.dso - b.metrics.dso; // Menor DSO es mejor
        case 'score':
          return b.metrics.score - a.metrics.score;
        default:
          return b.metrics.totalRevenue - a.metrics.totalRevenue;
      }
    });

    // Asignar posiciones
    clientMetrics.forEach((item, index) => {
      item.position = index + 1;
    });

    // Análisis ABC (Pareto 80/20)
    // A: Top 20% que generan ~80% de ingresos
    // B: Siguiente 30%
    // C: Resto 50%
    const totalClients = clientMetrics.length;
    const aCount = Math.ceil(totalClients * 0.2);
    const bCount = Math.ceil(totalClients * 0.3);

    let aRevenue = 0;
    let bRevenue = 0;
    let cRevenue = 0;

    clientMetrics.forEach((item, index) => {
      if (index < aCount) {
        item.segment = 'A';
        aRevenue += item.metrics.totalRevenue;
      } else if (index < aCount + bCount) {
        item.segment = 'B';
        bRevenue += item.metrics.totalRevenue;
      } else {
        item.segment = 'C';
        cRevenue += item.metrics.totalRevenue;
      }
    });

    // Aplicar filtro de segmento si se especificó
    let filteredMetrics = clientMetrics;
    if (segmento) {
      filteredMetrics = clientMetrics.filter((c) => c.segment === segmento);
    }

    // Limitar resultados
    const rankedClients = filteredMetrics.slice(0, limite);

    // Calcular resumen
    const summary = {
      totalClients: clientMetrics.length,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      averageTicket:
        clientMetrics.length > 0
          ? Math.round(
              (clientMetrics.reduce((sum, c) => sum + c.metrics.averageTicket, 0) /
                clientMetrics.length) *
                100
            ) / 100
          : 0,
      segmentDistribution: {
        A: {
          count: aCount,
          revenue: Math.round(aRevenue * 100) / 100,
          percentage: totalRevenue > 0 ? Math.round((aRevenue / totalRevenue) * 100) : 0,
        },
        B: {
          count: bCount,
          revenue: Math.round(bRevenue * 100) / 100,
          percentage: totalRevenue > 0 ? Math.round((bRevenue / totalRevenue) * 100) : 0,
        },
        C: {
          count: totalClients - aCount - bCount,
          revenue: Math.round(cRevenue * 100) / 100,
          percentage: totalRevenue > 0 ? Math.round((cRevenue / totalRevenue) * 100) : 0,
        },
      },
    };

    const response: RankingResponse = {
      periodo: {
        desde: fechaDesde,
        hasta: fechaHasta,
      },
      ranking: rankedClients,
      summary,
    };

    const headers = new Headers();
    headers.set('Cache-Control', 'private, max-age=300, stale-while-revalidate=600'); // 5 min cache

    return NextResponse.json(response, { headers });
  } catch (error) {
    console.error('Error obteniendo ranking de clientes:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
