import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import { getViewMode, applyViewMode } from '@/lib/view-mode';
import { startOfMonth, endOfMonth, subMonths } from 'date-fns';

export const dynamic = 'force-dynamic';

type SortField = 'margen' | 'ventas' | 'contribucion' | 'rotacion';
type Velocity = 'ALTA' | 'MEDIA' | 'BAJA';

interface ProductMetrics {
  position: number;
  product: {
    id: string;
    name: string;
    code: string;
    category: {
      id: number;
      name: string;
    } | null;
  };
  metrics: {
    totalSales: number;
    quantitySold: number;
    averageMargin: number;
    contribution: number;
    turnoverRate: number;
    velocity: Velocity;
    costPrice: number;
    salePrice: number;
  };
  alerts: string[];
}

interface ProfitabilitySummary {
  totalProducts: number;
  productsWithSales: number;
  averageMargin: number;
  totalContribution: number;
  totalRevenue: number;
}

interface MarginDistribution {
  range: string;
  count: number;
  percentage: number;
}

interface ProfitabilityResponse {
  periodo: {
    desde: Date;
    hasta: Date;
  };
  ranking: ProductMetrics[];
  summary: ProfitabilitySummary;
  distribution: {
    byMargin: MarginDistribution[];
    byVelocity: {
      alta: number;
      media: number;
      baja: number;
    };
  };
}

// GET: Obtener análisis de rentabilidad
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.PRODUCTOS_VIEW);
    if (error) return error;

    const companyId = user!.companyId;
    const viewMode = getViewMode(request);
    const { searchParams } = new URL(request.url);

    // Parse query parameters
    const fechaDesdeParam = searchParams.get('fechaDesde');
    const fechaHastaParam = searchParams.get('fechaHasta');
    const ordenarPor = (searchParams.get('ordenarPor') || 'margen') as SortField;
    const categoriaId = searchParams.get('categoriaId')
      ? parseInt(searchParams.get('categoriaId')!, 10)
      : null;
    const limite = parseInt(searchParams.get('limite') || '50', 10);
    const margenMinimo = searchParams.get('margenMinimo')
      ? parseFloat(searchParams.get('margenMinimo')!)
      : null;

    // Default date range: last 3 months
    const fechaHasta = fechaHastaParam ? new Date(fechaHastaParam) : endOfMonth(new Date());
    const fechaDesde = fechaDesdeParam
      ? new Date(fechaDesdeParam)
      : startOfMonth(subMonths(new Date(), 2));

    // Calcular días del período para métricas
    const periodDays = Math.ceil(
      (fechaHasta.getTime() - fechaDesde.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Obtener todos los productos activos (con filtro de categoría si aplica)
    const productsWhere: any = {
      companyId,
      isActive: true,
    };
    if (categoriaId) {
      productsWhere.categoryId = categoriaId;
    }

    const products = await prisma.product.findMany({
      where: productsWhere,
      select: {
        id: true,
        name: true,
        code: true,
        costPrice: true,
        salePrice: true,
        marginMin: true,
        currentStock: true,
        minStock: true,
        category: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Arrays para acumular métricas
    const productMetrics: ProductMetrics[] = [];
    let totalRevenue = 0;
    let totalContribution = 0;
    let totalMarginSum = 0;
    let productsWithSalesCount = 0;

    // Procesar cada producto
    for (const product of products) {
      const costPrice = Number(product.costPrice || 0);
      const salePrice = Number(product.salePrice || 0);
      const currentStock = Number(product.currentStock || 0);
      const minStock = Number(product.minStock || 0);
      const marginMin = Number(product.marginMin || 0);

      // Obtener ventas del período
      const saleItems = await prisma.saleItem.findMany({
        where: {
          productId: product.id,
          sale: applyViewMode(
            {
              companyId,
              fechaEmision: { gte: fechaDesde, lte: fechaHasta },
              estado: { notIn: ['CANCELADA', 'BORRADOR'] },
            },
            viewMode
          ),
        },
        select: {
          cantidad: true,
          precioUnitario: true,
          subtotal: true,
        },
      });

      const quantitySold = saleItems.reduce((sum, item) => sum + Number(item.cantidad), 0);
      const revenue = saleItems.reduce((sum, item) => sum + Number(item.subtotal), 0);

      // Solo incluir productos con ventas (o todos si no hay filtro de margen)
      if (quantitySold === 0 && margenMinimo !== null) continue;

      // Calcular métricas
      const averageMargin = salePrice > 0 ? ((salePrice - costPrice) / salePrice) * 100 : 0;
      const contribution = (salePrice - costPrice) * quantitySold;
      const turnoverRate = currentStock > 0 ? quantitySold / currentStock : 0;

      // Aplicar filtro de margen mínimo si se especificó
      if (margenMinimo !== null && averageMargin < margenMinimo) continue;

      // Determinar velocidad
      let velocity: Velocity = 'BAJA';
      if (turnoverRate >= 4) velocity = 'ALTA';
      else if (turnoverRate >= 1.5) velocity = 'MEDIA';

      // Detectar alertas
      const alerts: string[] = [];
      if (currentStock <= minStock && minStock > 0) {
        alerts.push(currentStock === 0 ? 'Sin stock' : 'Stock bajo');
      }
      if (marginMin > 0 && averageMargin < marginMin) {
        alerts.push('Margen por debajo del mínimo');
      }
      if (quantitySold === 0) {
        alerts.push('Sin ventas en el período');
      }

      // Agregar al ranking
      productMetrics.push({
        position: 0, // Se asignará después del ordenamiento
        product: {
          id: product.id,
          name: product.name,
          code: product.code,
          category: product.category,
        },
        metrics: {
          totalSales: Math.round(revenue * 100) / 100,
          quantitySold: Math.round(quantitySold * 100) / 100,
          averageMargin: Math.round(averageMargin * 100) / 100,
          contribution: Math.round(contribution * 100) / 100,
          turnoverRate: Math.round(turnoverRate * 100) / 100,
          velocity,
          costPrice,
          salePrice,
        },
        alerts,
      });

      // Acumular para resumen
      if (quantitySold > 0) {
        totalRevenue += revenue;
        totalContribution += contribution;
        totalMarginSum += averageMargin;
        productsWithSalesCount++;
      }
    }

    // Ordenar según el campo especificado
    productMetrics.sort((a, b) => {
      switch (ordenarPor) {
        case 'margen':
          return b.metrics.averageMargin - a.metrics.averageMargin;
        case 'ventas':
          return b.metrics.totalSales - a.metrics.totalSales;
        case 'contribucion':
          return b.metrics.contribution - a.metrics.contribution;
        case 'rotacion':
          return b.metrics.turnoverRate - a.metrics.turnoverRate;
        default:
          return b.metrics.averageMargin - a.metrics.averageMargin;
      }
    });

    // Asignar posiciones
    productMetrics.forEach((item, index) => {
      item.position = index + 1;
    });

    // Limitar resultados
    const rankedProducts = productMetrics.slice(0, limite);

    // Calcular resumen
    const summary: ProfitabilitySummary = {
      totalProducts: products.length,
      productsWithSales: productsWithSalesCount,
      averageMargin:
        productsWithSalesCount > 0
          ? Math.round((totalMarginSum / productsWithSalesCount) * 100) / 100
          : 0,
      totalContribution: Math.round(totalContribution * 100) / 100,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
    };

    // Calcular distribución por margen
    const marginRanges = [
      { min: -Infinity, max: 0, label: 'Negativo' },
      { min: 0, max: 10, label: '0-10%' },
      { min: 10, max: 20, label: '10-20%' },
      { min: 20, max: 30, label: '20-30%' },
      { min: 30, max: 40, label: '30-40%' },
      { min: 40, max: 50, label: '40-50%' },
      { min: 50, max: Infinity, label: '50%+' },
    ];

    const byMargin: MarginDistribution[] = marginRanges.map((range) => {
      const count = productMetrics.filter(
        (p) => p.metrics.averageMargin >= range.min && p.metrics.averageMargin < range.max
      ).length;
      const percentage =
        productMetrics.length > 0 ? Math.round((count / productMetrics.length) * 100) : 0;
      return {
        range: range.label,
        count,
        percentage,
      };
    });

    // Calcular distribución por velocidad
    const byVelocity = {
      alta: productMetrics.filter((p) => p.metrics.velocity === 'ALTA').length,
      media: productMetrics.filter((p) => p.metrics.velocity === 'MEDIA').length,
      baja: productMetrics.filter((p) => p.metrics.velocity === 'BAJA').length,
    };

    // Construir respuesta
    const response: ProfitabilityResponse = {
      periodo: {
        desde: fechaDesde,
        hasta: fechaHasta,
      },
      ranking: rankedProducts,
      summary,
      distribution: {
        byMargin,
        byVelocity,
      },
    };

    // Cache headers
    const headers = new Headers();
    headers.set('Cache-Control', 'private, max-age=300, stale-while-revalidate=600'); // 5 min cache

    return NextResponse.json(response, { headers });
  } catch (error) {
    console.error('Error obteniendo análisis de rentabilidad:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
