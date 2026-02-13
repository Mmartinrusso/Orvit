/**
 * Advanced Ventas Dashboard API
 * Provides comprehensive analytics with ML insights
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import { getViewMode, applyViewMode } from '@/lib/view-mode';
import { mlForecastDemand } from '@/lib/ai/ml-demand-forecasting';
import { calculateCreditScore } from '@/lib/ai/ml-credit-scoring';
import { predictChurn } from '@/lib/ai/ml-churn-prediction';
import { detectTransactionAnomaly } from '@/lib/ai/ml-anomaly-detection';

export const dynamic = 'force-dynamic';

interface AdvancedDashboardData {
  kpis: {
    ventasMes: number;
    ventasMesAnterior: number;
    ventasCrecimiento: number;
    entregasPendientes: number;
    entregasEnTransito: number;
    cobranzasMes: number;
    cobranzasPendientes: number;
    ordenesActivasCount: number;
    cotizacionesPendientes: number;
    tasaConversion: number;
    cumplimientoEntregas: number;
    alertasRiesgo: number;
  };
  mlInsights: {
    demandForecast: {
      nextMonthTotal: number;
      trend: 'up' | 'down' | 'stable';
      confidence: number;
      topProducts: Array<{
        productId: number;
        productName: string;
        forecast: number;
        trend: string;
      }>;
    };
    creditRisk: {
      clientsAtRisk: number;
      totalExposure: number;
      averageScore: number;
      topRisks: Array<{
        clientId: number;
        clientName: string;
        score: number;
        rating: string;
        exposure: number;
      }>;
    };
    churnPrediction: {
      clientsAtRisk: number;
      valueAtRisk: number;
      topChurnRisks: Array<{
        clientId: number;
        clientName: string;
        churnProbability: number;
        lifetimeValue: number;
      }>;
    };
    anomalyDetection: {
      suspiciousTransactions: number;
      flaggedAmount: number;
      recentAnomalies: Array<{
        type: string;
        description: string;
        severity: string;
        timestamp: Date;
      }>;
    };
  };
  charts: {
    ventasTrend: Array<{
      fecha: string;
      ventas: number;
      forecast?: number;
    }>;
    cobranzasTrend: Array<{
      fecha: string;
      cobrado: number;
      pendiente: number;
    }>;
    entregasStatus: Array<{
      estado: string;
      count: number;
      percentage: number;
    }>;
    topClientes: Array<{
      clientId: number;
      legalName: string;
      totalVentas: number;
      creditScore: number;
      creditRating: string;
      churnRisk: number;
    }>;
  };
  alerts: Array<{
    id: string;
    type: 'urgent' | 'important' | 'info';
    category: 'credit' | 'delivery' | 'sales' | 'churn' | 'anomaly';
    title: string;
    description: string;
    actionUrl?: string;
    timestamp: Date;
  }>;
  recentActivity: Array<{
    id: string;
    type: 'sale' | 'quote' | 'delivery' | 'payment';
    description: string;
    amount?: number;
    timestamp: Date;
    clientName?: string;
  }>;
}

export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.DASHBOARD_VIEW);
    if (error) return error;

    const viewMode = getViewMode(request);
    const companyId = user!.companyId;

    // Date ranges
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    const last6Months = new Date(now.getFullYear(), now.getMonth() - 6, 1);

    // Parallel data fetching
    const [
      ventasThisMonth,
      ventasLastMonth,
      entregas,
      cobranzas,
      ordenesActivas,
      cotizaciones,
      clients,
      topProducts,
      recentSales,
    ] = await Promise.all([
      // Ventas this month
      prisma.sale.aggregate({
        where: applyViewMode({
          companyId,
          estado: { notIn: ['CANCELADA', 'ANULADA'] },
          createdAt: { gte: startOfMonth },
        }, viewMode),
        _sum: { total: true },
        _count: true,
      }),

      // Ventas last month
      prisma.sale.aggregate({
        where: applyViewMode({
          companyId,
          estado: { notIn: ['CANCELADA', 'ANULADA'] },
          createdAt: { gte: startOfLastMonth, lte: endOfLastMonth },
        }, viewMode),
        _sum: { total: true },
      }),

      // Entregas
      prisma.saleDelivery.groupBy({
        by: ['estado'],
        where: applyViewMode({ companyId }, viewMode),
        _count: true,
      }),

      // Cobranzas
      prisma.salePayment.aggregate({
        where: applyViewMode({
          companyId,
          createdAt: { gte: startOfMonth },
        }, viewMode),
        _sum: { monto: true },
      }),

      // Órdenes activas
      prisma.loadOrder.count({
        where: applyViewMode({
          companyId,
          estado: { in: ['PENDIENTE', 'EN_PREPARACION', 'EN_TRANSITO'] },
        }, viewMode),
      }),

      // Cotizaciones pendientes
      prisma.salesQuote.count({
        where: applyViewMode({
          companyId,
          estado: 'PENDIENTE',
        }, viewMode),
      }),

      // All active clients
      prisma.client.findMany({
        where: applyViewMode({
          companyId,
          isActive: true,
        }, viewMode),
        select: {
          id: true,
          legalName: true,
          sales: {
            where: {
              createdAt: { gte: last6Months },
              estado: { notIn: ['CANCELADA', 'ANULADA'] },
            },
            select: { total: true, createdAt: true },
          },
          payments: {
            where: { createdAt: { gte: last6Months } },
            select: { monto: true, createdAt: true },
          },
        },
        take: 50, // Process top 50 clients
      }),

      // Top products for forecasting
      prisma.$queryRaw<Array<{ productId: number; productName: string; totalSold: number }>>`
        SELECT
          si."productId",
          p.name as "productName",
          SUM(si.cantidad) as "totalSold"
        FROM sale_items si
        INNER JOIN products p ON p.id = si."productId"
        INNER JOIN sales s ON s.id = si."saleId"
        WHERE s."companyId" = ${companyId}
          AND s."createdAt" >= ${last6Months}
        GROUP BY si."productId", p.name
        ORDER BY "totalSold" DESC
        LIMIT 10
      `,

      // Recent sales
      prisma.sale.findMany({
        where: applyViewMode({ companyId }, viewMode),
        select: {
          id: true,
          numero: true,
          total: true,
          createdAt: true,
          estado: true,
          client: { select: { legalName: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

    // Calculate KPIs
    const ventasMes = ventasThisMonth._sum.total?.toNumber() || 0;
    const ventasMesAnterior = ventasLastMonth._sum.total?.toNumber() || 0;
    const ventasCrecimiento = ventasMesAnterior > 0
      ? ((ventasMes - ventasMesAnterior) / ventasMesAnterior) * 100
      : 0;

    const entregasPendientes = entregas.find(e => e.estado === 'PENDIENTE')?._count || 0;
    const entregasEnTransito = entregas.find(e => e.estado === 'EN_TRANSITO')?._count || 0;
    const entregasTotal = entregas.reduce((sum, e) => sum + e._count, 0);
    const entregasCompletadas = entregas.find(e => e.estado === 'ENTREGADA')?._count || 0;
    const cumplimientoEntregas = entregasTotal > 0 ? (entregasCompletadas / entregasTotal) * 100 : 100;

    const cobranzasMes = cobranzas._sum.monto?.toNumber() || 0;

    // Cobranzas pendientes (ventas not fully paid)
    const salesWithBalance = await prisma.$queryRaw<Array<{ pendiente: number }>>`
      SELECT SUM(s.total - COALESCE(p.pagado, 0)) as pendiente
      FROM sales s
      LEFT JOIN (
        SELECT "saleId", SUM(monto) as pagado
        FROM sale_payments
        GROUP BY "saleId"
      ) p ON p."saleId" = s.id
      WHERE s."companyId" = ${companyId}
        AND s.estado NOT IN ('CANCELADA', 'ANULADA')
        AND s.total > COALESCE(p.pagado, 0)
    `;
    const cobranzasPendientes = salesWithBalance[0]?.pendiente?.toNumber() || 0;

    const tasaConversion = cotizaciones > 0
      ? (ventasThisMonth._count / (cotizaciones + ventasThisMonth._count)) * 100
      : 0;

    // ML INSIGHTS

    // 1. Demand Forecasting for top products
    const demandForecasts = await Promise.all(
      topProducts.slice(0, 5).map(async (product) => {
        try {
          const historicalData = await prisma.$queryRaw<Array<{
            fecha: Date;
            cantidad: number;
          }>>`
            SELECT
              DATE_TRUNC('month', s."createdAt") as fecha,
              SUM(si.cantidad) as cantidad
            FROM sale_items si
            INNER JOIN sales s ON s.id = si."saleId"
            WHERE si."productId" = ${product.productId}
              AND s."companyId" = ${companyId}
              AND s."createdAt" >= ${last6Months}
            GROUP BY DATE_TRUNC('month', s."createdAt")
            ORDER BY fecha ASC
          `;

          if (historicalData.length >= 3) {
            const forecast = await mlForecastDemand(
              product.productId,
              historicalData.map(d => ({
                fecha: d.fecha,
                cantidad: d.cantidad,
                precio: 0,
              })),
              1
            );

            return {
              productId: product.productId,
              productName: product.productName,
              forecast: forecast.forecasts[0]?.cantidadPrediccion || 0,
              trend: forecast.trend.direction,
            };
          }
          return null;
        } catch {
          return null;
        }
      })
    );

    const validForecasts = demandForecasts.filter(f => f !== null) as NonNullable<typeof demandForecasts[0]>[];
    const nextMonthTotal = validForecasts.reduce((sum, f) => sum + f.forecast, 0);

    // 2. Credit Risk Assessment for top clients
    const creditAssessments = await Promise.all(
      clients.slice(0, 10).map(async (client) => {
        try {
          const totalSales = client.sales.reduce((sum, s) => sum + s.total.toNumber(), 0);
          const totalPayments = client.payments.reduce((sum, p) => sum + p.monto.toNumber(), 0);
          const balance = totalSales - totalPayments;

          if (totalSales === 0) return null;

          const avgPaymentDelay = client.payments.length > 0
            ? client.payments.reduce((sum, p, idx) => {
                const sale = client.sales.find(s => s.createdAt <= p.createdAt);
                if (!sale) return sum;
                const days = Math.max(0, (p.createdAt.getTime() - sale.createdAt.getTime()) / (1000 * 60 * 60 * 24));
                return sum + days;
              }, 0) / client.payments.length
            : 0;

          const creditScore = await calculateCreditScore({
            antiguedadCliente: 365, // Simplified
            montoHistorico: totalSales,
            pagosAtrasados: avgPaymentDelay > 30 ? 1 : 0,
            incumplimientos: 0,
            saldoPendiente: balance,
            limiteCredito: totalSales * 1.2,
            utilizacionCredito: balance / (totalSales * 1.2),
          });

          return {
            clientId: client.id,
            clientName: client.legalName,
            score: creditScore.score,
            rating: creditScore.rating,
            exposure: balance,
          };
        } catch {
          return null;
        }
      })
    );

    const validCreditScores = creditAssessments.filter(c => c !== null) as NonNullable<typeof creditAssessments[0]>[];
    const clientsAtRisk = validCreditScores.filter(c => ['C', 'D'].includes(c.rating)).length;
    const totalExposure = validCreditScores
      .filter(c => ['C', 'D'].includes(c.rating))
      .reduce((sum, c) => sum + c.exposure, 0);
    const averageScore = validCreditScores.length > 0
      ? validCreditScores.reduce((sum, c) => sum + c.score, 0) / validCreditScores.length
      : 750;

    // 3. Churn Prediction
    const churnPredictions = await Promise.all(
      clients.slice(0, 10).map(async (client) => {
        try {
          const totalSales = client.sales.reduce((sum, s) => sum + s.total.toNumber(), 0);
          const recentSales = client.sales.filter(s => {
            const daysSince = (now.getTime() - s.createdAt.getTime()) / (1000 * 60 * 60 * 24);
            return daysSince <= 90;
          }).length;

          const daysSinceLastSale = client.sales.length > 0
            ? (now.getTime() - Math.max(...client.sales.map(s => s.createdAt.getTime()))) / (1000 * 60 * 60 * 24)
            : 365;

          const churnResult = await predictChurn(client.id, {
            antiguedadCliente: 365,
            comprasUltimos90Dias: recentSales,
            montoPromedioPedido: totalSales / Math.max(1, client.sales.length),
            diasDesdeUltimaCompra: daysSinceLastSale,
            tasaDevolucion: 0,
            cambiosEnVolumen: 0,
            interaccionesSoporte: 0,
            nivelSatisfaccion: 5,
          });

          return {
            clientId: client.id,
            clientName: client.legalName,
            churnProbability: churnResult.churnProbability,
            lifetimeValue: totalSales,
          };
        } catch {
          return null;
        }
      })
    );

    const validChurnPredictions = churnPredictions.filter(c => c !== null) as NonNullable<typeof churnPredictions[0]>[];
    const churnClientsAtRisk = validChurnPredictions.filter(c => c.churnProbability > 60).length;
    const valueAtRisk = validChurnPredictions
      .filter(c => c.churnProbability > 60)
      .reduce((sum, c) => sum + c.lifetimeValue, 0);

    // 4. Anomaly Detection (simplified - check recent high-value transactions)
    const recentHighValueSales = await prisma.sale.findMany({
      where: applyViewMode({
        companyId,
        createdAt: { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) }, // Last 7 days
        total: { gte: ventasMes > 0 ? ventasMes / 10 : 10000 }, // Transactions > 10% of monthly avg
      }, viewMode),
      select: {
        id: true,
        total: true,
        createdAt: true,
        client: { select: { legalName: true } },
      },
    });

    const anomalyChecks = await Promise.all(
      recentHighValueSales.slice(0, 5).map(async (sale) => {
        try {
          const result = await detectTransactionAnomaly({
            monto: sale.total.toNumber(),
            horaTransaccion: sale.createdAt.getHours(),
            ubicacionCliente: 'default',
            frecuenciaCliente: 1,
            tipoProducto: 'standard',
            metodoPago: 'transfer',
            cambiosPatron: false,
          });

          if (result.score > 60) {
            return {
              type: 'high_value_transaction',
              description: `Transacción inusual: ${sale.client?.legalName} - $${sale.total}`,
              severity: result.severity,
              timestamp: sale.createdAt,
            };
          }
          return null;
        } catch {
          return null;
        }
      })
    );

    const validAnomalies = anomalyChecks.filter(a => a !== null) as NonNullable<typeof anomalyChecks[0]>[];

    // Build alerts
    const alerts: AdvancedDashboardData['alerts'] = [];

    // Credit risk alerts
    validCreditScores
      .filter(c => c.rating === 'D')
      .slice(0, 3)
      .forEach(c => {
        alerts.push({
          id: `credit-risk-${c.clientId}`,
          type: 'urgent',
          category: 'credit',
          title: `Riesgo Crediticio Alto: ${c.clientName}`,
          description: `Score: ${c.score}, Exposición: $${c.exposure.toFixed(0)}`,
          actionUrl: `/administracion/ventas/clientes/${c.clientId}`,
          timestamp: now,
        });
      });

    // Churn alerts
    validChurnPredictions
      .filter(c => c.churnProbability > 70)
      .slice(0, 3)
      .forEach(c => {
        alerts.push({
          id: `churn-risk-${c.clientId}`,
          type: 'important',
          category: 'churn',
          title: `Riesgo de Pérdida: ${c.clientName}`,
          description: `Probabilidad: ${c.churnProbability}%, Valor: $${c.lifetimeValue.toFixed(0)}`,
          actionUrl: `/administracion/ventas/clientes/${c.clientId}`,
          timestamp: now,
        });
      });

    // Delivery alerts
    if (entregasPendientes > 10) {
      alerts.push({
        id: 'delivery-backlog',
        type: 'important',
        category: 'delivery',
        title: 'Acumulación de Entregas',
        description: `${entregasPendientes} entregas pendientes requieren atención`,
        actionUrl: '/administracion/ventas/entregas',
        timestamp: now,
      });
    }

    // Anomaly alerts
    validAnomalies.forEach((a, idx) => {
      alerts.push({
        id: `anomaly-${idx}`,
        type: a.severity === 'high' ? 'urgent' : 'info',
        category: 'anomaly',
        title: 'Transacción Anómala Detectada',
        description: a.description,
        timestamp: a.timestamp,
      });
    });

    // Sales trend chart
    const salesTrendData = await prisma.$queryRaw<Array<{
      fecha: Date;
      ventas: number;
    }>>`
      SELECT
        DATE_TRUNC('day', "createdAt") as fecha,
        SUM(total) as ventas
      FROM sales
      WHERE "companyId" = ${companyId}
        AND "createdAt" >= ${new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)}
        AND estado NOT IN ('CANCELADA', 'ANULADA')
      GROUP BY DATE_TRUNC('day', "createdAt")
      ORDER BY fecha ASC
    `;

    // Top clients with scores
    const topClientesData = validCreditScores.slice(0, 10).map(c => ({
      clientId: c.clientId,
      legalName: c.clientName,
      totalVentas: clients.find(cl => cl.id === c.clientId)?.sales.reduce((sum, s) => sum + s.total.toNumber(), 0) || 0,
      creditScore: c.score,
      creditRating: c.rating,
      churnRisk: validChurnPredictions.find(ch => ch.clientId === c.clientId)?.churnProbability || 0,
    }));

    const response: AdvancedDashboardData = {
      kpis: {
        ventasMes,
        ventasMesAnterior,
        ventasCrecimiento,
        entregasPendientes,
        entregasEnTransito,
        cobranzasMes,
        cobranzasPendientes,
        ordenesActivasCount: ordenesActivas,
        cotizacionesPendientes: cotizaciones,
        tasaConversion,
        cumplimientoEntregas,
        alertasRiesgo: clientsAtRisk + churnClientsAtRisk + validAnomalies.length,
      },
      mlInsights: {
        demandForecast: {
          nextMonthTotal,
          trend: nextMonthTotal > ventasMes ? 'up' : nextMonthTotal < ventasMes * 0.95 ? 'down' : 'stable',
          confidence: validForecasts.length > 0 ? 85 : 50,
          topProducts: validForecasts,
        },
        creditRisk: {
          clientsAtRisk,
          totalExposure,
          averageScore,
          topRisks: validCreditScores.filter(c => ['C', 'D'].includes(c.rating)).slice(0, 5),
        },
        churnPrediction: {
          clientsAtRisk: churnClientsAtRisk,
          valueAtRisk,
          topChurnRisks: validChurnPredictions.filter(c => c.churnProbability > 60).slice(0, 5),
        },
        anomalyDetection: {
          suspiciousTransactions: validAnomalies.length,
          flaggedAmount: recentHighValueSales.slice(0, validAnomalies.length).reduce((sum, s) => sum + s.total.toNumber(), 0),
          recentAnomalies: validAnomalies.slice(0, 5),
        },
      },
      charts: {
        ventasTrend: salesTrendData.map(d => ({
          fecha: d.fecha.toISOString().split('T')[0],
          ventas: d.ventas,
        })),
        cobranzasTrend: [], // Simplified for now
        entregasStatus: entregas.map(e => ({
          estado: e.estado,
          count: e._count,
          percentage: entregasTotal > 0 ? (e._count / entregasTotal) * 100 : 0,
        })),
        topClientes: topClientesData,
      },
      alerts: alerts.sort((a, b) => {
        const priority = { urgent: 0, important: 1, info: 2 };
        return priority[a.type] - priority[b.type];
      }),
      recentActivity: recentSales.map(s => ({
        id: s.id.toString(),
        type: 'sale' as const,
        description: `Venta ${s.numero} - ${s.client?.legalName}`,
        amount: s.total.toNumber(),
        timestamp: s.createdAt,
        clientName: s.client?.legalName,
      })),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error in advanced dashboard:', error);
    return NextResponse.json(
      { error: 'Error al cargar dashboard avanzado' },
      { status: 500 }
    );
  }
}
