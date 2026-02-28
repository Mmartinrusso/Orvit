/**
 * API: /api/panol/forecast
 *
 * GET - Calcular necesidades de stock según mantenimientos preventivos programados
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth/shared-helpers';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requirePermission('panol.view_products');
    if (error) return error;

    const companyId = user!.companyId;
    const { searchParams } = new URL(request.url);

    const days = parseInt(searchParams.get('days') || '30');
    const includeCorrectiveHistory = searchParams.get('includeHistory') === 'true';

    const forecastDate = new Date();
    forecastDate.setDate(forecastDate.getDate() + days);

    // 1. Obtener OTs preventivas programadas para el período
    const scheduledPMs = await prisma.workOrder.findMany({
      where: {
        companyId,
        type: 'PREVENTIVE',
        status: { in: ['PENDING', 'IN_PROGRESS'] },
        scheduledDate: {
          gte: new Date(),
          lte: forecastDate
        }
      },
      include: {
        machine: {
          select: {
            id: true,
            name: true,
            code: true,
            criticalityScore: true
          }
        },
        sparePartReservations: {
          where: { status: 'PENDING' },
          include: {
            tool: { select: { id: true, name: true, stockQuantity: true, minStockLevel: true, unit: true, cost: true } }
          }
        }
      }
    });

    // 2. Obtener repuestos vinculados a máquinas (ToolMachine)
    const machineIds = [...new Set(scheduledPMs.map(pm => pm.machineId).filter(Boolean))];

    const machineTools = await prisma.toolMachine.findMany({
      where: {
        machineId: { in: machineIds as number[] }
      },
      include: {
        tool: {
          select: {
            id: true,
            name: true,
            stockQuantity: true,
            minStockLevel: true,
            unit: true,
            cost: true,
            category: true,
            itemType: true
          }
        },
        machine: {
          select: { id: true, name: true }
        }
      }
    });

    // 3. Obtener historial de consumo correctivo (últimos 90 días) para proyección
    let historicalConsumption: any[] = [];
    if (includeCorrectiveHistory) {
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      historicalConsumption = await prisma.sparePartReservation.findMany({
        where: {
          companyId,
          status: { in: ['PICKED', 'RETURNED'] },
          pickedAt: { gte: ninetyDaysAgo },
          workOrder: { type: 'CORRECTIVE' }
        },
        include: {
          tool: { select: { id: true, name: true } },
          workOrder: {
            select: {
              machineId: true,
              machine: { select: { name: true } }
            }
          }
        }
      });
    }

    // 4. Calcular necesidades por repuesto
    const needsByTool: Record<number, {
      tool: any;
      currentStock: number;
      minStock: number;
      reservedForPM: number;
      avgMonthlyConsumption: number;
      projectedNeed: number;
      suggestedOrder: number;
      priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
      linkedMachines: Array<{ id: number; name: string; criticality?: number }>;
      scheduledPMs: Array<{ id: number; title: string; date: Date }>;
    }> = {};

    // Procesar reservas de PMs programadas
    scheduledPMs.forEach(pm => {
      pm.sparePartReservations.forEach(res => {
        const toolId = res.toolId;
        if (!needsByTool[toolId]) {
          needsByTool[toolId] = {
            tool: res.tool,
            currentStock: res.tool?.stockQuantity || 0,
            minStock: res.tool?.minStockLevel || 0,
            reservedForPM: 0,
            avgMonthlyConsumption: 0,
            projectedNeed: 0,
            suggestedOrder: 0,
            priority: 'LOW',
            linkedMachines: [],
            scheduledPMs: []
          };
        }
        needsByTool[toolId].reservedForPM += res.quantity;
        needsByTool[toolId].scheduledPMs.push({
          id: pm.id,
          title: pm.title,
          date: pm.scheduledDate!
        });
        if (pm.machine && !needsByTool[toolId].linkedMachines.find(m => m.id === pm.machine!.id)) {
          needsByTool[toolId].linkedMachines.push({
            id: pm.machine.id,
            name: pm.machine.name,
            criticality: pm.machine.criticalityScore || undefined
          });
        }
      });
    });

    // Agregar herramientas de máquinas (para PMs sin reserva explícita)
    machineTools.forEach(mt => {
      const toolId = mt.toolId;
      if (!needsByTool[toolId]) {
        needsByTool[toolId] = {
          tool: mt.tool,
          currentStock: mt.tool?.stockQuantity || 0,
          minStock: mt.tool?.minStockLevel || 0,
          reservedForPM: 0,
          avgMonthlyConsumption: 0,
          projectedNeed: 0,
          suggestedOrder: 0,
          priority: 'LOW',
          linkedMachines: [],
          scheduledPMs: []
        };
      }
      needsByTool[toolId].projectedNeed += mt.quantity;
      if (!needsByTool[toolId].linkedMachines.find(m => m.id === mt.machineId)) {
        needsByTool[toolId].linkedMachines.push({
          id: mt.machineId,
          name: mt.machine?.name || 'Unknown'
        });
      }
    });

    // Calcular consumo promedio mensual del histórico
    if (includeCorrectiveHistory && historicalConsumption.length > 0) {
      const consumptionByTool: Record<number, number> = {};
      historicalConsumption.forEach(res => {
        const consumed = res.status === 'RETURNED' ? 0 : res.quantity;
        consumptionByTool[res.toolId] = (consumptionByTool[res.toolId] || 0) + consumed;
      });

      Object.entries(consumptionByTool).forEach(([toolId, total]) => {
        const tid = parseInt(toolId);
        if (needsByTool[tid]) {
          needsByTool[tid].avgMonthlyConsumption = Math.round((total / 3) * 10) / 10; // 90 días = 3 meses
        }
      });
    }

    // Calcular sugerencia de orden y prioridad
    Object.values(needsByTool).forEach(item => {
      const totalNeed = item.reservedForPM + (item.avgMonthlyConsumption * (days / 30));
      const availableAfterPM = item.currentStock - totalNeed;

      item.projectedNeed = Math.round(totalNeed);

      if (availableAfterPM < 0) {
        item.suggestedOrder = Math.abs(Math.ceil(availableAfterPM)) + item.minStock;
      } else if (availableAfterPM < item.minStock) {
        item.suggestedOrder = item.minStock - availableAfterPM;
      }

      // Calcular prioridad
      const hasCriticalMachine = item.linkedMachines.some(m => (m.criticality || 0) >= 8);
      const stockCritical = item.currentStock <= 0;
      const stockLow = item.currentStock < item.minStock;
      const highDemand = item.projectedNeed > item.currentStock;

      if (stockCritical || (hasCriticalMachine && highDemand)) {
        item.priority = 'CRITICAL';
      } else if (stockLow && highDemand) {
        item.priority = 'HIGH';
      } else if (highDemand || stockLow) {
        item.priority = 'MEDIUM';
      } else {
        item.priority = 'LOW';
      }
    });

    // Ordenar por prioridad
    const priorityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    const sortedNeeds = Object.values(needsByTool)
      .filter(n => n.suggestedOrder > 0 || n.priority !== 'LOW')
      .sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    // Estadísticas
    const stats = {
      totalScheduledPMs: scheduledPMs.length,
      uniqueToolsNeeded: Object.keys(needsByTool).length,
      criticalItems: sortedNeeds.filter(n => n.priority === 'CRITICAL').length,
      highPriorityItems: sortedNeeds.filter(n => n.priority === 'HIGH').length,
      estimatedCost: sortedNeeds.reduce((acc, n) =>
        acc + (n.suggestedOrder * (n.tool?.cost || 0)), 0
      ),
      stockoutRisk: sortedNeeds.filter(n => n.currentStock < n.projectedNeed).length
    };

    return NextResponse.json({
      success: true,
      data: {
        forecastPeriod: { from: new Date(), to: forecastDate, days },
        needs: sortedNeeds,
        scheduledPMs: scheduledPMs.map(pm => ({
          id: pm.id,
          title: pm.title,
          machine: pm.machine,
          scheduledDate: pm.scheduledDate,
          reservationsCount: pm.sparePartReservations.length
        })),
        stats
      }
    });

  } catch (error) {
    console.error('Error en GET /api/panol/forecast:', error);
    return NextResponse.json(
      { error: 'Error al calcular pronóstico' },
      { status: 500 }
    );
  }
}
