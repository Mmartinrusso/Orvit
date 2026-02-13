/**
 * API: /api/maintenance/costs
 *
 * GET - Dashboard de costos de mantenimiento
 *       Incluye: KPIs, tendencias, presupuesto vs real
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import {
  getCostsByMachine,
  getCostsBySector,
  getMonthlyCostTrend,
  getBudgetComparison
} from '@/lib/maintenance-costs/calculator';

export const dynamic = 'force-dynamic';

/**
 * GET /api/maintenance/costs
 * Dashboard general de costos
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload || !payload.companyId) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const companyId = payload.companyId as number;
    const { searchParams } = new URL(request.url);

    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());
    const month = searchParams.get('month') ? parseInt(searchParams.get('month')!) : undefined;
    const period = parseInt(searchParams.get('period') || '30'); // días para costos recientes

    // Fechas para el período
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - period);

    // Ejecutar queries en paralelo
    const [
      costsByMachine,
      costsBySector,
      monthlyTrend,
      budgetComparison,
      recentCosts
    ] = await Promise.all([
      getCostsByMachine(companyId, startDate, endDate),
      getCostsBySector(companyId, startDate, endDate),
      getMonthlyCostTrend(companyId, 6),
      getBudgetComparison(companyId, year, month),
      // Costos recientes (últimas 10 OTs cerradas)
      prisma.maintenanceCostBreakdown.findMany({
        where: { companyId },
        include: {
          workOrder: {
            select: {
              id: true,
              title: true,
              completedDate: true,
              machine: { select: { name: true } }
            }
          }
        },
        orderBy: { calculatedAt: 'desc' },
        take: 10
      })
    ]);

    // Calcular KPIs
    const totalCostPeriod = costsByMachine.reduce((sum, m) => sum + m.totalCost, 0);
    const totalWorkOrders = costsByMachine.reduce((sum, m) => sum + m.workOrderCount, 0);
    const avgCostPerOT = totalWorkOrders > 0 ? totalCostPeriod / totalWorkOrders : 0;

    // Top 3 máquinas más costosas
    const topMachines = costsByMachine.slice(0, 3);

    // Distribución de costos
    const laborTotal = costsByMachine.reduce((sum, m) => sum + m.laborCost, 0);
    const partsTotal = costsByMachine.reduce((sum, m) => sum + m.partsCost, 0);
    const thirdPartyTotal = costsByMachine.reduce((sum, m) => sum + m.thirdPartyCost, 0);

    return NextResponse.json({
      success: true,
      data: {
        kpis: {
          totalCostPeriod,
          totalWorkOrders,
          avgCostPerOT: Math.round(avgCostPerOT * 100) / 100,
          budgetUsedPercent: budgetComparison.percentUsed
        },
        distribution: {
          labor: laborTotal,
          parts: partsTotal,
          thirdParty: thirdPartyTotal,
          laborPercent: totalCostPeriod > 0 ? Math.round((laborTotal / totalCostPeriod) * 100) : 0,
          partsPercent: totalCostPeriod > 0 ? Math.round((partsTotal / totalCostPeriod) * 100) : 0,
          thirdPartyPercent: totalCostPeriod > 0 ? Math.round((thirdPartyTotal / totalCostPeriod) * 100) : 0
        },
        topMachines,
        costsByMachine: costsByMachine.slice(0, 10),
        costsBySector,
        monthlyTrend,
        budgetComparison,
        recentCosts: recentCosts.map(c => ({
          workOrderId: c.workOrderId,
          workOrderTitle: c.workOrder.title,
          machineName: c.workOrder.machine?.name,
          completedDate: c.workOrder.completedDate,
          totalCost: Number(c.totalCost),
          laborCost: Number(c.laborCost),
          partsCost: Number(c.sparePartsCost),
          thirdPartyCost: Number(c.thirdPartyCost)
        }))
      },
      period: { startDate, endDate, days: period }
    });

  } catch (error) {
    console.error('Error en GET /api/maintenance/costs:', error);
    return NextResponse.json(
      { error: 'Error al obtener costos de mantenimiento' },
      { status: 500 }
    );
  }
}
