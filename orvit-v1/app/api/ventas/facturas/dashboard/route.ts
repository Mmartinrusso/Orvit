/**
 * GET /api/ventas/facturas/dashboard
 *
 * Returns comprehensive analytics data for invoices dashboard:
 * - KPIs (total facturado, cobrado, pendiente, vencido)
 * - Trends over time
 * - Distribution by status
 * - Top clients
 * - Aging analysis
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import { getViewMode, applyViewMode } from '@/lib/view-mode';
import { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.FACTURAS_VIEW);
    if (error) return error;

    const companyId = user!.companyId;
    const viewMode = getViewMode(request);

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'month'; // month, quarter, year

    // Calculate date range based on period
    const now = new Date();
    const endDate = now;
    let startDate: Date;
    let trendMonths = 6;

    switch (period) {
      case 'quarter':
        startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
        trendMonths = 3;
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        trendMonths = 12;
        break;
      case 'month':
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        trendMonths = 6;
    }

    // Base where clause
    const baseWhere = applyViewMode({ companyId }, viewMode);

    // =========================================================================
    // 1. KPIS
    // =========================================================================

    const invoices = await prisma.salesInvoice.findMany({
      where: {
        ...baseWhere,
        estado: { notIn: ['ANULADA'] }, // Exclude cancelled
      },
      select: {
        id: true,
        estado: true,
        total: true,
        saldoPendiente: true,
        fechaEmision: true,
        fechaVencimiento: true,
        totalCobrado: true,
      },
    });

    const totalFacturado = invoices.reduce((sum, inv) => sum + parseFloat(inv.total.toString()), 0);
    const totalCobrado = invoices.reduce(
      (sum, inv) => sum + parseFloat((inv.totalCobrado || 0).toString()),
      0
    );
    const saldoPendiente = invoices.reduce(
      (sum, inv) => sum + parseFloat(inv.saldoPendiente.toString()),
      0
    );

    // Count overdue invoices
    const facturasVencidas = invoices.filter((inv) => {
      if (!['EMITIDA', 'PARCIALMENTE_COBRADA'].includes(inv.estado)) return false;
      return new Date(inv.fechaVencimiento) < now;
    }).length;

    const montoVencido = invoices
      .filter((inv) => {
        if (!['EMITIDA', 'PARCIALMENTE_COBRADA'].includes(inv.estado)) return false;
        return new Date(inv.fechaVencimiento) < now;
      })
      .reduce((sum, inv) => sum + parseFloat(inv.saldoPendiente.toString()), 0);

    const porcentajeCobrado = totalFacturado > 0 ? (totalCobrado / totalFacturado) * 100 : 0;

    // =========================================================================
    // 2. TRENDS (last N months)
    // =========================================================================

    const trendsStartDate = new Date();
    trendsStartDate.setMonth(trendsStartDate.getMonth() - trendMonths);

    const trendInvoices = await prisma.salesInvoice.findMany({
      where: {
        ...baseWhere,
        fechaEmision: { gte: trendsStartDate },
        estado: { notIn: ['ANULADA'] },
      },
      select: {
        fechaEmision: true,
        total: true,
        totalCobrado: true,
        saldoPendiente: true,
      },
    });

    // Group by month
    const trendsByMonth: Record<
      string,
      { facturado: number; cobrado: number; pendiente: number }
    > = {};

    for (let i = 0; i < trendMonths; i++) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      trendsByMonth[key] = { facturado: 0, cobrado: 0, pendiente: 0 };
    }

    trendInvoices.forEach((inv) => {
      const date = new Date(inv.fechaEmision);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      if (trendsByMonth[key]) {
        trendsByMonth[key].facturado += parseFloat(inv.total.toString());
        trendsByMonth[key].cobrado += parseFloat((inv.totalCobrado || 0).toString());
        trendsByMonth[key].pendiente += parseFloat(inv.saldoPendiente.toString());
      }
    });

    const trends = Object.entries(trendsByMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([mes, data]) => {
        const [year, month] = mes.split('-');
        const monthName = new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString(
          'es-AR',
          { month: 'short', year: '2-digit' }
        );
        return {
          mes: monthName,
          ...data,
        };
      });

    // =========================================================================
    // 3. BY STATUS
    // =========================================================================

    const byStatus = await prisma.salesInvoice.groupBy({
      by: ['estado'],
      where: baseWhere,
      _count: { id: true },
      _sum: { total: true },
    });

    const formattedByStatus = byStatus.map((group) => ({
      estado: group.estado,
      count: group._count.id,
      monto: parseFloat((group._sum.total || 0).toString()),
    }));

    // =========================================================================
    // 4. TOP CLIENTS
    // =========================================================================

    const clientInvoices = await prisma.salesInvoice.groupBy({
      by: ['clientId'],
      where: {
        ...baseWhere,
        estado: { notIn: ['ANULADA'] },
      },
      _sum: {
        total: true,
        totalCobrado: true,
        saldoPendiente: true,
      },
      orderBy: {
        _sum: {
          total: 'desc',
        },
      },
      take: 10,
    });

    const clientIds = clientInvoices.map((ci) => ci.clientId);
    const clients = await prisma.client.findMany({
      where: { id: { in: clientIds } },
      select: { id: true, legalName: true, name: true },
    });

    const clientMap = new Map(clients.map((c) => [c.id, c]));

    const topClients = clientInvoices.map((ci) => {
      const client = clientMap.get(ci.clientId);
      return {
        clientName: client?.legalName || client?.name || 'Sin nombre',
        totalFacturado: parseFloat((ci._sum.total || 0).toString()),
        totalCobrado: parseFloat((ci._sum.totalCobrado || 0).toString()),
        saldoPendiente: parseFloat((ci._sum.saldoPendiente || 0).toString()),
      };
    });

    // =========================================================================
    // 5. AGING ANALYSIS
    // =========================================================================

    const pendingInvoices = await prisma.salesInvoice.findMany({
      where: {
        ...baseWhere,
        estado: { in: ['EMITIDA', 'PARCIALMENTE_COBRADA'] },
        saldoPendiente: { gt: 0 },
      },
      select: {
        saldoPendiente: true,
        fechaVencimiento: true,
      },
    });

    const aging = {
      vigente: 0, // No vencidas
      vencido1_30: 0, // 1-30 días
      vencido31_60: 0, // 31-60 días
      vencido61_90: 0, // 61-90 días
      vencido90Plus: 0, // +90 días
    };

    pendingInvoices.forEach((inv) => {
      const saldo = parseFloat(inv.saldoPendiente.toString());
      const daysOverdue = Math.floor(
        (now.getTime() - new Date(inv.fechaVencimiento).getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysOverdue < 0) {
        aging.vigente += saldo;
      } else if (daysOverdue <= 30) {
        aging.vencido1_30 += saldo;
      } else if (daysOverdue <= 60) {
        aging.vencido31_60 += saldo;
      } else if (daysOverdue <= 90) {
        aging.vencido61_90 += saldo;
      } else {
        aging.vencido90Plus += saldo;
      }
    });

    // =========================================================================
    // RESPONSE
    // =========================================================================

    return NextResponse.json({
      totalFacturado,
      totalCobrado,
      saldoPendiente,
      facturasVencidas,
      montoVencido,
      porcentajeCobrado,
      trends,
      byStatus: formattedByStatus,
      topClients,
      aging,
    });
  } catch (error) {
    console.error('[INVOICE-DASHBOARD] Error:', error);
    return NextResponse.json(
      { error: 'Error al obtener datos del dashboard' },
      { status: 500 }
    );
  }
}
