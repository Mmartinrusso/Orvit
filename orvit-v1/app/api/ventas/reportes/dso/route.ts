/**
 * DSO Report API - O2C Phase 5
 *
 * Calculates Days Sales Outstanding metrics.
 * DSO = (Accounts Receivable / Total Credit Sales) × Number of Days
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import { applyViewMode, ViewMode } from '@/lib/view-mode';

export const dynamic = 'force-dynamic';

// ═══════════════════════════════════════════════════════════════════════════════
// GET - Calculate DSO metrics
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET(req: NextRequest) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.REPORTES_ADVANCED);
    if (error) return error;

    const { searchParams } = new URL(req.url);
    const companyId = user!.companyId;
    const clientId = searchParams.get('clientId');
    const period = searchParams.get('period') || '90'; // Days to analyze
    const viewMode = (searchParams.get('viewMode') || 'S') as ViewMode;
    const groupBy = searchParams.get('groupBy') || 'company'; // company, client, month

    const periodDays = parseInt(period);
    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - periodDays);

    // Get total AR (accounts receivable)
    const arTotal = await prisma.salesInvoice.aggregate({
      where: applyViewMode(
        {
          companyId,
          estado: { in: ['EMITIDA', 'PARCIALMENTE_COBRADA'] },
          saldoPendiente: { gt: 0 },
          ...(clientId && { clientId }),
        },
        viewMode
      ),
      _sum: { saldoPendiente: true },
    });

    // Get total credit sales in period
    const salesTotal = await prisma.salesInvoice.aggregate({
      where: applyViewMode(
        {
          companyId,
          fechaEmision: { gte: startDate, lte: endDate },
          ...(clientId && { clientId }),
        },
        viewMode
      ),
      _sum: { total: true },
    });

    // Calculate company-wide DSO
    const totalAR = Number(arTotal._sum.saldoPendiente || 0);
    const totalSales = Number(salesTotal._sum.total || 0);
    const companyDSO = totalSales > 0 ? (totalAR / totalSales) * periodDays : 0;

    // Base response
    const response: {
      period: number;
      startDate: string;
      endDate: string;
      company: {
        totalAR: number;
        totalSales: number;
        dso: number;
      };
      byClient?: Array<{
        clientId: string;
        clientName: string;
        totalAR: number;
        totalSales: number;
        dso: number;
        invoiceCount: number;
      }>;
      byMonth?: Array<{
        month: string;
        totalSales: number;
        arAtEndOfMonth: number;
        dso: number;
      }>;
      trend?: Array<{
        date: string;
        dso: number;
      }>;
    } = {
      period: periodDays,
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      company: {
        totalAR,
        totalSales,
        dso: Math.round(companyDSO * 10) / 10,
      },
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // Group by client
    // ═══════════════════════════════════════════════════════════════════════════
    if (groupBy === 'client' || groupBy === 'all') {
      const clientAR = await prisma.salesInvoice.groupBy({
        by: ['clientId'],
        where: applyViewMode(
          {
            companyId,
            estado: { in: ['EMITIDA', 'PARCIALMENTE_COBRADA'] },
            saldoPendiente: { gt: 0 },
          },
          viewMode
        ),
        _sum: { saldoPendiente: true },
        _count: true,
      });

      const clientSales = await prisma.salesInvoice.groupBy({
        by: ['clientId'],
        where: applyViewMode(
          {
            companyId,
            fechaEmision: { gte: startDate, lte: endDate },
          },
          viewMode
        ),
        _sum: { total: true },
      });

      // Get client names
      const clientIds = [...new Set([
        ...clientAR.map((c) => c.clientId),
        ...clientSales.map((c) => c.clientId),
      ])];

      const clients = await prisma.client.findMany({
        where: { id: { in: clientIds } },
        select: { id: true, name: true, legalName: true },
      });

      const clientMap = new Map(clients.map((c) => [c.id, c]));
      const salesMap = new Map(
        clientSales.map((c) => [c.clientId, Number(c._sum.total || 0)])
      );

      response.byClient = clientAR
        .map((c) => {
          const client = clientMap.get(c.clientId);
          const ar = Number(c._sum.saldoPendiente || 0);
          const sales = salesMap.get(c.clientId) || 0;
          const dso = sales > 0 ? (ar / sales) * periodDays : 0;

          return {
            clientId: c.clientId,
            clientName: client?.legalName || client?.name || c.clientId,
            totalAR: ar,
            totalSales: sales,
            dso: Math.round(dso * 10) / 10,
            invoiceCount: c._count,
          };
        })
        .sort((a, b) => b.dso - a.dso);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Group by month (trend)
    // ═══════════════════════════════════════════════════════════════════════════
    if (groupBy === 'month' || groupBy === 'all') {
      // Calculate DSO for last 6 months
      const monthlyDSO: Array<{
        month: string;
        totalSales: number;
        arAtEndOfMonth: number;
        dso: number;
      }> = [];

      for (let i = 0; i < 6; i++) {
        const monthEnd = new Date(endDate);
        monthEnd.setMonth(monthEnd.getMonth() - i);
        monthEnd.setDate(1);
        monthEnd.setMonth(monthEnd.getMonth() + 1);
        monthEnd.setDate(0); // Last day of month

        const monthStart = new Date(monthEnd);
        monthStart.setDate(1);

        // Sales in month
        const monthSales = await prisma.salesInvoice.aggregate({
          where: applyViewMode(
            {
              companyId,
              fechaEmision: { gte: monthStart, lte: monthEnd },
              ...(clientId && { clientId }),
            },
            viewMode
          ),
          _sum: { total: true },
        });

        // AR at end of month (simplified - uses current AR)
        // In a real system, you'd need historical snapshots
        const monthAR = await prisma.salesInvoice.aggregate({
          where: applyViewMode(
            {
              companyId,
              fechaEmision: { lte: monthEnd },
              estado: { in: ['EMITIDA', 'PARCIALMENTE_COBRADA'] },
              ...(clientId && { clientId }),
            },
            viewMode
          ),
          _sum: { saldoPendiente: true },
        });

        const sales = Number(monthSales._sum.total || 0);
        const ar = Number(monthAR._sum.saldoPendiente || 0);
        const dso = sales > 0 ? (ar / sales) * 30 : 0;

        monthlyDSO.unshift({
          month: monthStart.toISOString().slice(0, 7), // YYYY-MM
          totalSales: sales,
          arAtEndOfMonth: ar,
          dso: Math.round(dso * 10) / 10,
        });
      }

      response.byMonth = monthlyDSO;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Rolling DSO trend (last 30 days)
    // ═══════════════════════════════════════════════════════════════════════════
    if (groupBy === 'trend' || groupBy === 'all') {
      const trend: Array<{ date: string; dso: number }> = [];

      for (let i = 29; i >= 0; i--) {
        const trendDate = new Date(endDate);
        trendDate.setDate(trendDate.getDate() - i);

        const trendStart = new Date(trendDate);
        trendStart.setDate(trendStart.getDate() - periodDays);

        // This is simplified - real implementation would need historical data
        const trendSales = await prisma.salesInvoice.aggregate({
          where: applyViewMode(
            {
              companyId,
              fechaEmision: { gte: trendStart, lte: trendDate },
              ...(clientId && { clientId }),
            },
            viewMode
          ),
          _sum: { total: true },
        });

        const sales = Number(trendSales._sum.total || 0);
        const dso = sales > 0 ? (totalAR / sales) * periodDays : companyDSO;

        trend.push({
          date: trendDate.toISOString().split('T')[0],
          dso: Math.round(dso * 10) / 10,
        });
      }

      response.trend = trend;
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error calculating DSO:', error);
    return NextResponse.json(
      { error: 'Error al calcular DSO' },
      { status: 500 }
    );
  }
}
