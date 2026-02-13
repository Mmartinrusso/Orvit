/**
 * Centro de Costos V2 - Integración con Mantenimiento (READ-ONLY)
 *
 * Solo lee datos de MaintenanceCostBreakdown (ya calculados por el módulo).
 * NO modifica el módulo de mantenimiento existente.
 */

import { prisma } from '@/lib/prisma';
import { Decimal } from '@prisma/client/runtime/library';
import { startOfMonth, endOfMonth, parseISO } from 'date-fns';

export interface MaintenanceCostData {
  totalCost: number;
  laborCost: number;
  partsCost: number;
  thirdPartyCost: number;
  extrasCost: number;
  workOrderCount: number;
  details: MaintenanceCostDetail[];
}

export interface MaintenanceCostDetail {
  breakdownId: number;
  workOrderId: number;
  workOrderTitle: string;
  machineName: string | null;
  laborCost: number;
  partsCost: number;
  thirdPartyCost: number;
  extrasCost: number;
  totalCost: number;
  calculatedAt: Date;
}

/**
 * Obtiene los costos de mantenimiento para un mes específico.
 * Lee de MaintenanceCostBreakdown que ya fueron calculados por el módulo de mantenimiento.
 *
 * @param companyId - ID de la empresa
 * @param month - Mes en formato "YYYY-MM" (ej: "2026-01")
 */
export async function getMaintenanceCostsForMonth(
  companyId: number,
  month: string
): Promise<MaintenanceCostData> {
  const startDate = startOfMonth(parseISO(month + '-01'));
  const endDate = endOfMonth(startDate);

  // Leer MaintenanceCostBreakdown existentes
  const costs = await prisma.maintenanceCostBreakdown.findMany({
    where: {
      companyId,
      calculatedAt: {
        gte: startDate,
        lte: endDate
      }
    },
    include: {
      workOrder: {
        select: {
          id: true,
          title: true,
          machine: {
            select: {
              name: true
            }
          }
        }
      }
    },
    orderBy: { calculatedAt: 'desc' }
  });

  // Si no hay datos, retornar valores en cero
  if (costs.length === 0) {
    return {
      totalCost: 0,
      laborCost: 0,
      partsCost: 0,
      thirdPartyCost: 0,
      extrasCost: 0,
      workOrderCount: 0,
      details: []
    };
  }

  // Calcular totales
  let totalCost = 0;
  let laborCost = 0;
  let partsCost = 0;
  let thirdPartyCost = 0;
  let extrasCost = 0;
  const details: MaintenanceCostDetail[] = [];

  for (const cost of costs) {
    const labor = toNumber(cost.laborCost);
    const parts = toNumber(cost.sparePartsCost);
    const thirdParty = toNumber(cost.thirdPartyCost);
    const extras = toNumber(cost.extrasCost);
    const total = toNumber(cost.totalCost);

    totalCost += total;
    laborCost += labor;
    partsCost += parts;
    thirdPartyCost += thirdParty;
    extrasCost += extras;

    details.push({
      breakdownId: cost.id,
      workOrderId: cost.workOrderId,
      workOrderTitle: cost.workOrder.title,
      machineName: cost.workOrder.machine?.name || null,
      laborCost: labor,
      partsCost: parts,
      thirdPartyCost: thirdParty,
      extrasCost: extras,
      totalCost: total,
      calculatedAt: cost.calculatedAt
    });
  }

  return {
    totalCost,
    laborCost,
    partsCost,
    thirdPartyCost,
    extrasCost,
    workOrderCount: costs.length,
    details
  };
}

/**
 * Obtiene la cantidad de MaintenanceCostBreakdown
 * (para verificación de prerrequisitos)
 */
export async function getMaintenanceCostCount(companyId: number): Promise<number> {
  return prisma.maintenanceCostBreakdown.count({
    where: { companyId }
  });
}

/**
 * Helper para convertir Decimal de Prisma a number
 */
function toNumber(value: Decimal | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  return Number(value);
}
