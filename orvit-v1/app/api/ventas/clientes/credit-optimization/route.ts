/**
 * Credit Limit Optimization API
 *
 * GET: Get AI-powered credit limit suggestions for all clients or a specific client
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import {
  generateCreditSuggestions,
  getCreditOptimizationSummary,
  type ClientCreditData
} from '@/lib/ventas/credit-optimizer';
import { prisma } from '@/lib/prisma';
import { getViewMode } from '@/lib/view-mode';
import { applyViewMode } from '@/lib/view-mode/prisma-helper';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.CLIENTES_VIEW);
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');
    const onlyWithSuggestions = searchParams.get('onlyWithSuggestions') !== 'false';
    const viewMode = getViewMode(request);

    // Get clients with their credit data
    const whereClause: any = applyViewMode({
      companyId: user!.companyId,
      isActive: true,
    }, viewMode, { field: 'tipoCondicionVenta' }); // Use different field since Client doesn't have docType

    // Remove docType filter if it was added by applyViewMode
    delete whereClause.NOT;

    if (clientId) {
      whereClause.id = clientId;
    }

    const clients = await prisma.client.findMany({
      where: whereClause,
      include: {
        _count: {
          select: { ledgerEntries: true },
        },
      },
    });

    // Get invoice and payment data for each client
    const clientCreditData: ClientCreditData[] = await Promise.all(
      clients.map(async (client) => {
        // Get invoice statistics
        const invoiceStats = await prisma.salesInvoice.aggregate({
          where: {
            clientId: client.id,
            companyId: user!.companyId,
          },
          _count: { id: true },
          _sum: { total: true },
        });

        // Get overdue invoices
        const overdueInvoices = await prisma.salesInvoice.findMany({
          where: {
            clientId: client.id,
            companyId: user!.companyId,
            estado: { in: ['EMITIDA', 'VENCIDA', 'PARCIALMENTE_COBRADA'] },
            fechaVencimiento: { lt: new Date() },
            saldoPendiente: { gt: 0 },
          },
          select: {
            saldoPendiente: true,
            fechaVencimiento: true,
          },
        });

        const overdueAmount = overdueInvoices.reduce(
          (sum, inv) => sum + (inv.saldoPendiente?.toNumber() || 0),
          0
        );

        const maxOverdueDays = overdueInvoices.reduce((max, inv) => {
          const days = Math.floor(
            (new Date().getTime() - new Date(inv.fechaVencimiento!).getTime()) / (1000 * 60 * 60 * 24)
          );
          return Math.max(max, days);
        }, 0);

        // Get paid invoices for payment history analysis
        const paidInvoices = await prisma.salesInvoice.findMany({
          where: {
            clientId: client.id,
            companyId: user!.companyId,
            estado: 'COBRADA',
          },
          select: {
            fechaEmision: true,
            fechaVencimiento: true,
            paymentAllocations: {
              select: {
                fechaAplicacion: true,
              },
              orderBy: { fechaAplicacion: 'asc' },
              take: 1,
            },
          },
        });

        // Calculate payment timing statistics
        let totalPaymentDays = 0;
        let onTimePayments = 0;

        paidInvoices.forEach((invoice) => {
          if (invoice.paymentAllocations.length > 0) {
            const paymentDate = new Date(invoice.paymentAllocations[0].fechaAplicacion);
            const dueDate = new Date(invoice.fechaVencimiento!);
            const paymentDays = Math.floor(
              (paymentDate.getTime() - new Date(invoice.fechaEmision).getTime()) / (1000 * 60 * 60 * 24)
            );
            totalPaymentDays += paymentDays;

            if (paymentDate <= dueDate) {
              onTimePayments++;
            }
          }
        });

        const avgPaymentDays = paidInvoices.length > 0
          ? totalPaymentDays / paidInvoices.length
          : 30;
        const onTimePaymentRate = paidInvoices.length > 0
          ? (onTimePayments / paidInvoices.length) * 100
          : 50;

        // Get monthly sales for trend analysis
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        const monthlySales = await prisma.salesInvoice.groupBy({
          by: ['fechaEmision'],
          where: {
            clientId: client.id,
            companyId: user!.companyId,
            fechaEmision: { gte: sixMonthsAgo },
          },
          _sum: { total: true },
        });

        // Calculate monthly averages and trend
        const monthlyTotals: number[] = [];
        const now = new Date();
        for (let i = 0; i < 6; i++) {
          const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
          const monthTotal = monthlySales
            .filter((s) => {
              const date = new Date(s.fechaEmision);
              return date >= monthStart && date <= monthEnd;
            })
            .reduce((sum, s) => sum + (s._sum.total?.toNumber() || 0), 0);
          monthlyTotals.push(monthTotal);
        }

        const monthlySalesAvg = monthlyTotals.length > 0
          ? monthlyTotals.reduce((a, b) => a + b, 0) / monthlyTotals.length
          : 0;

        // Determine trend (comparing recent 3 months to previous 3)
        const recent3 = monthlyTotals.slice(0, 3).reduce((a, b) => a + b, 0);
        const previous3 = monthlyTotals.slice(3, 6).reduce((a, b) => a + b, 0);
        let salesTrend: 'growing' | 'stable' | 'declining' = 'stable';
        if (previous3 > 0) {
          const growth = ((recent3 - previous3) / previous3) * 100;
          if (growth > 10) salesTrend = 'growing';
          else if (growth < -10) salesTrend = 'declining';
        }

        // Calculate tenure
        const monthsAsClient = Math.floor(
          (new Date().getTime() - new Date(client.createdAt).getTime()) / (1000 * 60 * 60 * 24 * 30)
        );

        // Calculate current balance and utilization
        const currentBalance = client.currentBalance || 0;
        const creditLimit = client.creditLimit || 0;
        const creditUtilization = creditLimit > 0 ? (currentBalance / creditLimit) * 100 : 0;

        return {
          clientId: client.id,
          clientName: client.legalName,
          currentCreditLimit: creditLimit,
          currentBalance,
          creditUtilization,
          avgPaymentDays,
          onTimePaymentRate,
          totalInvoices: invoiceStats._count.id || 0,
          totalPaidOnTime: onTimePayments,
          monthlySalesAvg,
          salesTrend,
          monthsAsClient,
          maxOverdueDays,
          overdueInvoicesCount: overdueInvoices.length,
          currentOverdueAmount: overdueAmount,
          industryAvgCreditRatio: 2.5,
        };
      })
    );

    // Generate suggestions
    let suggestions = generateCreditSuggestions(clientCreditData);

    // If only getting one client, include even if no suggestion (for full analysis)
    if (clientId && suggestions.length === 0 && clientCreditData.length > 0) {
      // Return the data even without a formal suggestion
      const client = clientCreditData[0];
      return NextResponse.json({
        clientId: client.clientId,
        clientName: client.clientName,
        currentLimit: client.currentCreditLimit,
        currentBalance: client.currentBalance,
        creditUtilization: client.creditUtilization,
        paymentHistory: {
          avgPaymentDays: client.avgPaymentDays,
          onTimePaymentRate: client.onTimePaymentRate,
          totalInvoices: client.totalInvoices,
        },
        salesTrend: client.salesTrend,
        monthsAsClient: client.monthsAsClient,
        riskIndicators: {
          overdueInvoices: client.overdueInvoicesCount,
          overdueAmount: client.currentOverdueAmount,
          maxOverdueDays: client.maxOverdueDays,
        },
        suggestion: null,
        message: 'No hay sugerencias de cambio significativo para este cliente',
      });
    }

    // Get summary
    const summary = getCreditOptimizationSummary(suggestions);

    // Sort by urgency then by change percent
    suggestions = suggestions.sort((a, b) => {
      const urgencyOrder = { immediate: 0, review: 1, informational: 2 };
      const urgencyDiff = urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
      if (urgencyDiff !== 0) return urgencyDiff;
      return Math.abs(b.changePercent) - Math.abs(a.changePercent);
    });

    return NextResponse.json({
      suggestions,
      summary,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Error generating credit optimization suggestions:', err);
    return NextResponse.json(
      { error: 'Error al generar sugerencias de optimización de crédito' },
      { status: 500 }
    );
  }
}
