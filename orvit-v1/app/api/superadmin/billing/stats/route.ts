import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/superadmin/billing/stats
 * Obtiene estadísticas detalladas del sistema de billing
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth || auth.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'month'; // month, quarter, year

    // Calcular fechas según período
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'quarter':
        startDate = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default: // month
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    // Ejecutar todas las queries en paralelo
    const [
      // Suscripciones por estado
      subscriptionsByStatus,
      // Suscripciones por plan
      subscriptionsByPlan,
      // Ingresos del período
      revenueData,
      // Facturas del período
      invoicesData,
      // MRR (Monthly Recurring Revenue)
      mrrData,
      // Tokens usage
      tokensData,
      // Nuevas suscripciones del período
      newSubscriptions,
      // Cancelaciones del período
      cancelledSubscriptions,
      // Top usuarios por consumo de tokens
      topTokenUsers,
    ] = await Promise.all([
      // 1. Suscripciones por estado
      prisma.subscription.groupBy({
        by: ['status'],
        _count: true,
      }),

      // 2. Suscripciones por plan
      prisma.subscription.groupBy({
        by: ['planId'],
        where: { status: { in: ['ACTIVE', 'TRIALING'] } },
        _count: true,
      }),

      // 3. Ingresos del período (facturas pagadas)
      prisma.billingInvoice.aggregate({
        where: {
          status: 'PAID',
          paidAt: { gte: startDate },
        },
        _sum: { total: true },
        _count: true,
      }),

      // 4. Facturas del período por estado
      prisma.billingInvoice.groupBy({
        by: ['status'],
        where: {
          createdAt: { gte: startDate },
        },
        _sum: { total: true },
        _count: true,
      }),

      // 5. MRR (suma de precios mensuales de suscripciones activas)
      prisma.$queryRaw`
        SELECT
          SUM(
            CASE
              WHEN s."billingCycle" = 'MONTHLY' THEN sp."monthlyPrice"
              WHEN s."billingCycle" = 'ANNUAL' AND sp."annualPrice" IS NOT NULL
                THEN sp."annualPrice" / 12
              ELSE sp."monthlyPrice"
            END
          ) as mrr
        FROM subscriptions s
        JOIN subscription_plans sp ON s."planId" = sp.id
        WHERE s.status IN ('ACTIVE', 'TRIALING')
      ` as Promise<Array<{ mrr: number | null }>>,

      // 6. Uso de tokens del período
      prisma.tokenTransaction.aggregate({
        where: {
          type: 'USAGE',
          createdAt: { gte: startDate },
        },
        _sum: { amount: true },
        _count: true,
      }),

      // 7. Nuevas suscripciones
      prisma.subscription.count({
        where: {
          createdAt: { gte: startDate },
        },
      }),

      // 8. Cancelaciones
      prisma.subscription.count({
        where: {
          status: 'CANCELED',
          canceledAt: { gte: startDate },
        },
      }),

      // 9. Top usuarios por tokens
      prisma.tokenTransaction.groupBy({
        by: ['subscriptionId'],
        where: {
          type: 'USAGE',
          createdAt: { gte: startDate },
        },
        _sum: { amount: true },
        orderBy: {
          _sum: { amount: 'asc' }, // Negativo, así que ascendente = más uso
        },
        take: 10,
      }),
    ]);

    // Obtener nombres de planes para subscriptionsByPlan
    const planIds = subscriptionsByPlan.map(s => s.planId);
    const plans = await prisma.subscriptionPlan.findMany({
      where: { id: { in: planIds } },
      select: { id: true, displayName: true, color: true },
    });

    const plansMap = new Map(plans.map(p => [p.id, p]));

    // Obtener detalles de top token users
    const topSubscriptionIds = topTokenUsers.map(t => t.subscriptionId);
    const topSubscriptions = await prisma.subscription.findMany({
      where: { id: { in: topSubscriptionIds } },
      include: {
        user: { select: { id: true, name: true, email: true } },
        plan: { select: { displayName: true } },
      },
    });

    const subscriptionsMap = new Map(topSubscriptions.map(s => [s.id, s]));

    // Formatear respuesta
    const stats = {
      period: {
        type: period,
        startDate: startDate.toISOString(),
        endDate: now.toISOString(),
      },

      // Resumen de suscripciones
      subscriptions: {
        byStatus: subscriptionsByStatus.reduce((acc, item) => {
          acc[item.status.toLowerCase()] = item._count;
          return acc;
        }, {} as Record<string, number>),
        byPlan: subscriptionsByPlan.map(item => ({
          planId: item.planId,
          planName: plansMap.get(item.planId)?.displayName || 'Unknown',
          color: plansMap.get(item.planId)?.color || '#888',
          count: item._count,
        })),
        total: subscriptionsByStatus.reduce((sum, item) => sum + item._count, 0),
        active: subscriptionsByStatus.find(s => s.status === 'ACTIVE')?._count || 0,
      },

      // Ingresos
      revenue: {
        period: {
          total: Number(revenueData._sum.total || 0),
          invoiceCount: revenueData._count,
        },
        mrr: Number(mrrData[0]?.mrr || 0),
        arr: Number(mrrData[0]?.mrr || 0) * 12,
      },

      // Facturas
      invoices: {
        byStatus: invoicesData.reduce((acc, item) => {
          acc[item.status.toLowerCase()] = {
            count: item._count,
            total: Number(item._sum.total || 0),
          };
          return acc;
        }, {} as Record<string, { count: number; total: number }>),
      },

      // Tokens
      tokens: {
        usedThisPeriod: Math.abs(Number(tokensData._sum.amount || 0)),
        transactionCount: tokensData._count,
      },

      // Crecimiento
      growth: {
        newSubscriptions,
        cancelledSubscriptions,
        netGrowth: newSubscriptions - cancelledSubscriptions,
        churnRate: subscriptionsByStatus.find(s => s.status === 'ACTIVE')?._count
          ? (cancelledSubscriptions / (subscriptionsByStatus.find(s => s.status === 'ACTIVE')!._count + cancelledSubscriptions) * 100).toFixed(2)
          : 0,
      },

      // Top usuarios por tokens
      topTokenUsers: topTokenUsers.map(item => {
        const sub = subscriptionsMap.get(item.subscriptionId);
        return {
          subscriptionId: item.subscriptionId,
          userName: sub?.user.name || 'Unknown',
          userEmail: sub?.user.email || '',
          planName: sub?.plan.displayName || '',
          tokensUsed: Math.abs(Number(item._sum.amount || 0)),
        };
      }),
    };

    return NextResponse.json(stats);

  } catch (error) {
    console.error('Error fetching billing stats:', error);
    return NextResponse.json({ error: 'Error al obtener estadísticas' }, { status: 500 });
  }
}
