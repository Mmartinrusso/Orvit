/**
 * API para métricas en tiempo real del sistema de billing
 * Solo accesible por SUPERADMIN
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET - Obtener métricas en tiempo real
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth || auth.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '30d'; // 7d, 30d, 90d, 1y

    // Calculate date range
    const now = new Date();
    let startDate: Date;
    switch (period) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '1y':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default: // 30d
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Get all metrics in parallel
    const [
      // Subscription metrics
      subscriptionStats,
      // Revenue metrics
      revenueStats,
      // Token metrics
      tokenStats,
      // Invoice metrics
      invoiceStats,
      // Recent activity
      recentPayments,
      recentSubscriptions,
      // Growth metrics
      newSubscriptionsThisPeriod,
      canceledSubscriptionsThisPeriod,
      // Plan distribution
      planDistribution,
      // Revenue by month (for chart)
      revenueByMonth,
      // Token usage by type
      tokenUsageByType,
      // MRR calculation
      mrrData,
    ] = await Promise.all([
      // Subscription stats
      prisma.subscription.groupBy({
        by: ['status'],
        _count: true,
      }),

      // Revenue stats (paid invoices)
      prisma.billingInvoice.aggregate({
        where: {
          status: 'PAID',
          paidAt: { gte: startDate },
        },
        _sum: { total: true },
        _count: true,
      }),

      // Token stats
      prisma.tokenTransaction.aggregate({
        where: {
          createdAt: { gte: startDate },
          amount: { lt: 0 }, // Only consumption
        },
        _sum: { amount: true },
        _count: true,
      }),

      // Invoice stats
      prisma.billingInvoice.groupBy({
        by: ['status'],
        _count: true,
        _sum: { total: true },
      }),

      // Recent payments
      prisma.billingPayment.findMany({
        where: {
          status: 'COMPLETED',
          paidAt: { gte: startDate },
        },
        orderBy: { paidAt: 'desc' },
        take: 5,
        include: {
          invoice: {
            include: {
              subscription: {
                include: {
                  user: { select: { name: true, email: true } },
                },
              },
            },
          },
        },
      }),

      // Recent new subscriptions
      prisma.subscription.findMany({
        where: {
          createdAt: { gte: startDate },
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          user: { select: { name: true, email: true } },
          plan: { select: { displayName: true } },
        },
      }),

      // New subscriptions this period
      prisma.subscription.count({
        where: {
          createdAt: { gte: startDate },
        },
      }),

      // Canceled subscriptions this period
      prisma.subscription.count({
        where: {
          status: 'CANCELED',
          canceledAt: { gte: startDate },
        },
      }),

      // Plan distribution
      prisma.subscription.groupBy({
        by: ['planId'],
        where: {
          status: { in: ['ACTIVE', 'TRIALING', 'PAST_DUE'] },
        },
        _count: true,
      }),

      // Revenue by month (last 6 months)
      prisma.$queryRaw`
        SELECT
          DATE_TRUNC('month', "paidAt") as month,
          SUM(total)::float as revenue,
          COUNT(*)::int as count
        FROM "invoices"
        WHERE status = 'PAID'
          AND "paidAt" >= NOW() - INTERVAL '6 months'
        GROUP BY DATE_TRUNC('month', "paidAt")
        ORDER BY month
      ` as Promise<Array<{ month: Date; revenue: number; count: number }>>,

      // Token usage by type
      prisma.tokenTransaction.groupBy({
        by: ['referenceType'],
        where: {
          createdAt: { gte: startDate },
          amount: { lt: 0 },
        },
        _sum: { amount: true },
        _count: true,
      }),

      // MRR calculation (Monthly Recurring Revenue)
      prisma.subscription.findMany({
        where: {
          status: { in: ['ACTIVE', 'TRIALING'] },
        },
        select: {
          billingCycle: true,
          plan: { select: { monthlyPrice: true, annualPrice: true } },
        },
      }),
    ]);

    // Calculate MRR
    const mrr = mrrData.reduce((acc, sub) => {
      const monthlyPrice = Number(sub.plan.monthlyPrice);
      const annualPrice = sub.plan.annualPrice ? Number(sub.plan.annualPrice) : monthlyPrice * 12;

      if (sub.billingCycle === 'MONTHLY') {
        return acc + monthlyPrice;
      } else {
        // Convert annual to monthly equivalent
        return acc + (annualPrice / 12);
      }
    }, 0);

    // Get plan names for distribution
    const plans = await prisma.subscriptionPlan.findMany({
      where: { id: { in: planDistribution.map(p => p.planId) } },
      select: { id: true, displayName: true, color: true },
    });

    const planDistributionWithNames = planDistribution.map(p => ({
      planId: p.planId,
      planName: plans.find(pl => pl.id === p.planId)?.displayName || 'Unknown',
      color: plans.find(pl => pl.id === p.planId)?.color || '#8B5CF6',
      count: p._count,
    }));

    // Build subscription status counts
    const subscriptionCounts = {
      total: 0,
      active: 0,
      trialing: 0,
      pastDue: 0,
      paused: 0,
      canceled: 0,
    };

    subscriptionStats.forEach(s => {
      subscriptionCounts.total += s._count;
      switch (s.status) {
        case 'ACTIVE': subscriptionCounts.active = s._count; break;
        case 'TRIALING': subscriptionCounts.trialing = s._count; break;
        case 'PAST_DUE': subscriptionCounts.pastDue = s._count; break;
        case 'PAUSED': subscriptionCounts.paused = s._count; break;
        case 'CANCELED': subscriptionCounts.canceled = s._count; break;
      }
    });

    // Build invoice status breakdown
    const invoiceBreakdown = invoiceStats.map(inv => ({
      status: inv.status,
      count: inv._count,
      total: Number(inv._sum.total || 0),
    }));

    // Calculate pending revenue
    const pendingRevenue = invoiceBreakdown
      .filter(i => i.status === 'OPEN' || i.status === 'DRAFT')
      .reduce((acc, i) => acc + i.total, 0);

    // Format revenue by month for chart
    const revenueChart = (revenueByMonth as any[]).map(r => ({
      month: r.month,
      revenue: r.revenue,
      count: r.count,
    }));

    // Format token usage
    const tokenUsage = (tokenUsageByType || []).map((t: any) => ({
      type: t.referenceType || 'OTHER',
      amount: Math.abs(t._sum.amount || 0),
      count: t._count,
    }));

    // Format recent activity
    const recentActivity = [
      ...recentPayments.map(p => ({
        type: 'payment' as const,
        id: p.id,
        amount: Number(p.amount),
        userName: p.invoice.subscription.user.name,
        userEmail: p.invoice.subscription.user.email,
        date: p.paidAt,
        method: p.method,
      })),
      ...recentSubscriptions.map(s => ({
        type: 'subscription' as const,
        id: s.id,
        userName: s.user.name,
        userEmail: s.user.email,
        planName: s.plan.displayName,
        date: s.createdAt,
      })),
    ].sort((a, b) => new Date(b.date!).getTime() - new Date(a.date!).getTime())
    .slice(0, 10);

    // Calculate churn rate
    const churnRate = subscriptionCounts.active > 0
      ? (canceledSubscriptionsThisPeriod / (subscriptionCounts.active + canceledSubscriptionsThisPeriod)) * 100
      : 0;

    // Calculate growth rate
    const growthRate = subscriptionCounts.active > 0
      ? ((newSubscriptionsThisPeriod - canceledSubscriptionsThisPeriod) / subscriptionCounts.active) * 100
      : 0;

    return NextResponse.json({
      period,
      generatedAt: now.toISOString(),

      // Key metrics
      mrr: Math.round(mrr),
      arr: Math.round(mrr * 12),
      totalRevenue: Number(revenueStats._sum.total || 0),
      pendingRevenue,

      // Subscription metrics
      subscriptions: subscriptionCounts,
      newSubscriptions: newSubscriptionsThisPeriod,
      canceledSubscriptions: canceledSubscriptionsThisPeriod,
      churnRate: Math.round(churnRate * 100) / 100,
      growthRate: Math.round(growthRate * 100) / 100,

      // Token metrics
      tokensConsumed: Math.abs(tokenStats._sum.amount || 0),
      tokenTransactions: tokenStats._count,
      tokenUsageByType: tokenUsage,

      // Invoice metrics
      invoices: invoiceBreakdown,
      paidInvoices: revenueStats._count,

      // Distribution
      planDistribution: planDistributionWithNames,

      // Charts data
      revenueChart,

      // Activity feed
      recentActivity,
    });
  } catch (error) {
    console.error('Error fetching billing metrics:', error);
    return NextResponse.json(
      { error: 'Error al obtener métricas' },
      { status: 500 }
    );
  }
}
