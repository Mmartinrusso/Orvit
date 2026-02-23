/**
 * Calculador de Costos de Mantenimiento
 *
 * Responsable de calcular y persistir los costos asociados a órdenes de trabajo.
 * Incluye:
 * - Mano de obra (según tarifas de técnicos)
 * - Repuestos usados (según costo de herramientas/insumos)
 * - Servicios de terceros
 */

import { prisma } from '@/lib/prisma';
import { Decimal } from '@prisma/client/runtime/library';

interface CostBreakdown {
  laborCost: number;
  sparePartsCost: number;
  thirdPartyCost: number;
  extrasCost: number;
  totalCost: number;
  details: {
    laborDetails?: Array<{ userId: number; userName: string; hours: number; rate: number; cost: number }>;
    partsDetails?: Array<{ toolId: number; toolName: string; quantity: number; unitCost: number; cost: number }>;
    thirdPartyDetails?: Array<{ id: number; supplier: string; description: string; amount: number }>;
  };
}

/**
 * Calcular costos de mano de obra para una OT
 */
async function calculateLaborCost(workOrderId: number, companyId: number): Promise<{
  total: number;
  details: Array<{ userId: number; userName: string; hours: number; rate: number; cost: number }>;
}> {
  const workOrder = await prisma.workOrder.findUnique({
    where: { id: workOrderId },
    select: {
      actualHours: true,
      executorIds: true,
      assignedToId: true,
      createdById: true
    }
  });

  if (!workOrder || !workOrder.actualHours) {
    return { total: 0, details: [] };
  }

  const hours = Number(workOrder.actualHours);

  // Obtener IDs de ejecutores
  let executorIds: number[] = [];
  if (workOrder.executorIds && Array.isArray(workOrder.executorIds)) {
    executorIds = workOrder.executorIds as number[];
  } else if (workOrder.assignedToId) {
    executorIds = [workOrder.assignedToId];
  }

  if (executorIds.length === 0) {
    return { total: 0, details: [] };
  }

  // Obtener tarifas de los técnicos
  const rates = await prisma.technicianCostRate.findMany({
    where: {
      companyId,
      userId: { in: executorIds },
      isActive: true,
      effectiveFrom: { lte: new Date() },
      OR: [
        { effectiveTo: null },
        { effectiveTo: { gte: new Date() } }
      ]
    },
    include: {
      user: { select: { id: true, name: true } }
    },
    orderBy: { effectiveFrom: 'desc' }
  });

  // Usar la tarifa más reciente por usuario
  const rateByUser = new Map<number, typeof rates[0]>();
  for (const rate of rates) {
    if (!rateByUser.has(rate.userId)) {
      rateByUser.set(rate.userId, rate);
    }
  }

  // Calcular costo por ejecutor (dividir horas equitativamente)
  const hoursPerExecutor = hours / executorIds.length;
  const details: Array<{ userId: number; userName: string; hours: number; rate: number; cost: number }> = [];
  let total = 0;

  for (const userId of executorIds) {
    const rate = rateByUser.get(userId);
    const hourlyRate = rate ? Number(rate.hourlyRate) : 0;
    const cost = hoursPerExecutor * hourlyRate;

    // Obtener nombre del usuario si no tenemos la tarifa
    let userName = rate?.user?.name || 'Desconocido';
    if (!rate) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true }
      });
      userName = user?.name || 'Desconocido';
    }

    details.push({
      userId,
      userName,
      hours: hoursPerExecutor,
      rate: hourlyRate,
      cost
    });
    total += cost;
  }

  return { total, details };
}

/**
 * Calcular costos de repuestos para una OT
 */
async function calculateSparePartsCost(workOrderId: number, companyId: number): Promise<{
  total: number;
  details: Array<{ toolId: number; toolName: string; quantity: number; unitCost: number; cost: number }>;
}> {
  // Obtener repuestos desde reservas PICKED
  const reservations = await prisma.sparePartReservation.findMany({
    where: {
      workOrderId,
      companyId,
      status: 'PICKED'
    },
    include: {
      tool: {
        select: {
          id: true,
          name: true,
          cost: true,
          itemType: true
        }
      }
    }
  });

  const details: Array<{ toolId: number; toolName: string; quantity: number; unitCost: number; cost: number }> = [];
  let total = 0;

  for (const reservation of reservations) {
    const unitCost = reservation.tool.cost ? Number(reservation.tool.cost) : 0;
    // Usar cantidad confirmada (usedQuantity), fallback a cantidad picked
    const consumed = reservation.usedQuantity ?? reservation.quantity;
    const cost = consumed * unitCost;

    details.push({
      toolId: reservation.tool.id,
      toolName: reservation.tool.name,
      quantity: consumed,
      unitCost,
      cost
    });
    total += cost;
  }

  // También considerar sparePartsUsed de la OT (si no hay reservas)
  if (reservations.length === 0) {
    const workOrder = await prisma.workOrder.findUnique({
      where: { id: workOrderId },
      select: { cost: true }
    });

    // Si la OT tiene un costo directo y no hay reservas, usar ese
    if (workOrder?.cost) {
      total = Number(workOrder.cost);
    }
  }

  return { total, details };
}

/**
 * Calcular costos de terceros para una OT
 */
async function calculateThirdPartyCost(workOrderId: number): Promise<{
  total: number;
  details: Array<{ id: number; supplier: string; description: string; amount: number }>;
}> {
  const thirdPartyCosts = await prisma.thirdPartyCost.findMany({
    where: { workOrderId },
    select: {
      id: true,
      supplierName: true,
      description: true,
      amount: true
    }
  });

  const details = thirdPartyCosts.map(tc => ({
    id: tc.id,
    supplier: tc.supplierName,
    description: tc.description || '',
    amount: Number(tc.amount)
  }));

  const total = details.reduce((sum, d) => sum + d.amount, 0);

  return { total, details };
}

/**
 * Calcular y guardar el desglose de costos de una OT
 */
export async function calculateWorkOrderCost(workOrderId: number, companyId: number): Promise<CostBreakdown> {
  // Calcular cada componente en paralelo
  const [laborResult, partsResult, thirdPartyResult] = await Promise.all([
    calculateLaborCost(workOrderId, companyId),
    calculateSparePartsCost(workOrderId, companyId),
    calculateThirdPartyCost(workOrderId)
  ]);

  // Herramientas dañadas → costo de reposición va a extrasCost
  let extrasCost = 0;
  try {
    const damagedReservations = await prisma.sparePartReservation.findMany({
      where: { workOrderId, companyId, returnedDamaged: true },
      include: { tool: { select: { cost: true } } }
    });
    extrasCost = damagedReservations.reduce(
      (sum, r) => sum + (r.tool.cost ? Number(r.tool.cost) : 0), 0
    );
  } catch {
    // Si falla (e.g. campo no existe aún), ignorar
  }

  const breakdown: CostBreakdown = {
    laborCost: laborResult.total,
    sparePartsCost: partsResult.total,
    thirdPartyCost: thirdPartyResult.total,
    extrasCost,
    totalCost: laborResult.total + partsResult.total + thirdPartyResult.total + extrasCost,
    details: {
      laborDetails: laborResult.details,
      partsDetails: partsResult.details,
      thirdPartyDetails: thirdPartyResult.details
    }
  };

  // Persistir en la base de datos
  await prisma.maintenanceCostBreakdown.upsert({
    where: { workOrderId },
    create: {
      workOrderId,
      companyId,
      laborCost: breakdown.laborCost,
      sparePartsCost: breakdown.sparePartsCost,
      thirdPartyCost: breakdown.thirdPartyCost,
      extrasCost: breakdown.extrasCost,
      totalCost: breakdown.totalCost
    },
    update: {
      laborCost: breakdown.laborCost,
      sparePartsCost: breakdown.sparePartsCost,
      thirdPartyCost: breakdown.thirdPartyCost,
      extrasCost: breakdown.extrasCost,
      totalCost: breakdown.totalCost,
      calculatedAt: new Date()
    }
  });

  return breakdown;
}

/**
 * Obtener el desglose de costos de una OT (sin recalcular)
 */
export async function getWorkOrderCostBreakdown(workOrderId: number): Promise<CostBreakdown | null> {
  const breakdown = await prisma.maintenanceCostBreakdown.findUnique({
    where: { workOrderId }
  });

  if (!breakdown) return null;

  return {
    laborCost: Number(breakdown.laborCost),
    sparePartsCost: Number(breakdown.sparePartsCost),
    thirdPartyCost: Number(breakdown.thirdPartyCost),
    extrasCost: Number(breakdown.extrasCost),
    totalCost: Number(breakdown.totalCost),
    details: {}
  };
}

/**
 * Obtener costos agregados por máquina en un período
 */
export async function getCostsByMachine(
  companyId: number,
  startDate: Date,
  endDate: Date
): Promise<Array<{
  machineId: number;
  machineName: string;
  totalCost: number;
  laborCost: number;
  partsCost: number;
  thirdPartyCost: number;
  workOrderCount: number;
}>> {
  const workOrders = await prisma.workOrder.findMany({
    where: {
      companyId,
      completedDate: {
        gte: startDate,
        lte: endDate
      },
      machineId: { not: null }
    },
    select: {
      id: true,
      machineId: true,
      machine: { select: { name: true } },
      costBreakdown: true
    }
  });

  // Agrupar por máquina
  const machineMap = new Map<number, {
    machineName: string;
    totalCost: number;
    laborCost: number;
    partsCost: number;
    thirdPartyCost: number;
    workOrderCount: number;
  }>();

  for (const wo of workOrders) {
    if (!wo.machineId) continue;

    const existing = machineMap.get(wo.machineId) || {
      machineName: wo.machine?.name || 'Desconocida',
      totalCost: 0,
      laborCost: 0,
      partsCost: 0,
      thirdPartyCost: 0,
      workOrderCount: 0
    };

    if (wo.costBreakdown) {
      existing.totalCost += Number(wo.costBreakdown.totalCost);
      existing.laborCost += Number(wo.costBreakdown.laborCost);
      existing.partsCost += Number(wo.costBreakdown.sparePartsCost);
      existing.thirdPartyCost += Number(wo.costBreakdown.thirdPartyCost);
    }
    existing.workOrderCount++;

    machineMap.set(wo.machineId, existing);
  }

  return Array.from(machineMap.entries())
    .map(([machineId, data]) => ({ machineId, ...data }))
    .sort((a, b) => b.totalCost - a.totalCost);
}

/**
 * Obtener costos agregados por sector en un período
 */
export async function getCostsBySector(
  companyId: number,
  startDate: Date,
  endDate: Date
): Promise<Array<{
  sectorId: number;
  sectorName: string;
  totalCost: number;
  laborCost: number;
  partsCost: number;
  thirdPartyCost: number;
  workOrderCount: number;
}>> {
  const workOrders = await prisma.workOrder.findMany({
    where: {
      companyId,
      completedDate: {
        gte: startDate,
        lte: endDate
      },
      sectorId: { not: null }
    },
    select: {
      id: true,
      sectorId: true,
      sector: { select: { name: true } },
      costBreakdown: true
    }
  });

  // Agrupar por sector
  const sectorMap = new Map<number, {
    sectorName: string;
    totalCost: number;
    laborCost: number;
    partsCost: number;
    thirdPartyCost: number;
    workOrderCount: number;
  }>();

  for (const wo of workOrders) {
    if (!wo.sectorId) continue;

    const existing = sectorMap.get(wo.sectorId) || {
      sectorName: wo.sector?.name || 'Sin sector',
      totalCost: 0,
      laborCost: 0,
      partsCost: 0,
      thirdPartyCost: 0,
      workOrderCount: 0
    };

    if (wo.costBreakdown) {
      existing.totalCost += Number(wo.costBreakdown.totalCost);
      existing.laborCost += Number(wo.costBreakdown.laborCost);
      existing.partsCost += Number(wo.costBreakdown.sparePartsCost);
      existing.thirdPartyCost += Number(wo.costBreakdown.thirdPartyCost);
    }
    existing.workOrderCount++;

    sectorMap.set(wo.sectorId, existing);
  }

  return Array.from(sectorMap.entries())
    .map(([sectorId, data]) => ({ sectorId, ...data }))
    .sort((a, b) => b.totalCost - a.totalCost);
}

/**
 * Obtener tendencia de costos mensual
 */
export async function getMonthlyCostTrend(
  companyId: number,
  months: number = 6
): Promise<Array<{
  month: string;
  year: number;
  totalCost: number;
  laborCost: number;
  partsCost: number;
  thirdPartyCost: number;
  workOrderCount: number;
}>> {
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);
  startDate.setDate(1);
  startDate.setHours(0, 0, 0, 0);

  const workOrders = await prisma.workOrder.findMany({
    where: {
      companyId,
      completedDate: { gte: startDate }
    },
    select: {
      completedDate: true,
      costBreakdown: true
    }
  });

  const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

  // Inicializar meses
  const monthlyData = new Map<string, {
    month: string;
    year: number;
    totalCost: number;
    laborCost: number;
    partsCost: number;
    thirdPartyCost: number;
    workOrderCount: number;
  }>();

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
    monthlyData.set(key, {
      month: monthNames[d.getMonth()],
      year: d.getFullYear(),
      totalCost: 0,
      laborCost: 0,
      partsCost: 0,
      thirdPartyCost: 0,
      workOrderCount: 0
    });
  }

  // Agregar datos
  for (const wo of workOrders) {
    if (!wo.completedDate) continue;
    const key = `${wo.completedDate.getFullYear()}-${wo.completedDate.getMonth() + 1}`;
    const data = monthlyData.get(key);
    if (!data) continue;

    data.workOrderCount++;
    if (wo.costBreakdown) {
      data.totalCost += Number(wo.costBreakdown.totalCost);
      data.laborCost += Number(wo.costBreakdown.laborCost);
      data.partsCost += Number(wo.costBreakdown.sparePartsCost);
      data.thirdPartyCost += Number(wo.costBreakdown.thirdPartyCost);
    }
  }

  return Array.from(monthlyData.values());
}

/**
 * Comparar costos reales vs presupuesto
 */
export async function getBudgetComparison(
  companyId: number,
  year: number,
  month?: number
): Promise<{
  budget: {
    total: number;
    labor: number;
    parts: number;
    thirdParty: number;
  };
  actual: {
    total: number;
    labor: number;
    parts: number;
    thirdParty: number;
  };
  variance: {
    total: number;
    labor: number;
    parts: number;
    thirdParty: number;
  };
  percentUsed: number;
}> {
  // Obtener presupuesto
  const budget = await prisma.maintenanceBudget.findFirst({
    where: {
      companyId,
      year,
      month: month || null,
      sectorId: null // Presupuesto global de la empresa
    }
  });

  // Calcular fechas para los costos reales
  let startDate: Date;
  let endDate: Date;

  if (month) {
    startDate = new Date(year, month - 1, 1);
    endDate = new Date(year, month, 0, 23, 59, 59);
  } else {
    startDate = new Date(year, 0, 1);
    endDate = new Date(year, 11, 31, 23, 59, 59);
  }

  // Obtener costos reales
  const costBreakdowns = await prisma.maintenanceCostBreakdown.findMany({
    where: {
      companyId,
      calculatedAt: {
        gte: startDate,
        lte: endDate
      }
    }
  });

  const actual = costBreakdowns.reduce((acc, cb) => ({
    total: acc.total + Number(cb.totalCost),
    labor: acc.labor + Number(cb.laborCost),
    parts: acc.parts + Number(cb.sparePartsCost),
    thirdParty: acc.thirdParty + Number(cb.thirdPartyCost)
  }), { total: 0, labor: 0, parts: 0, thirdParty: 0 });

  const budgetData = {
    total: budget ? Number(budget.totalBudget) : 0,
    labor: budget?.laborBudget ? Number(budget.laborBudget) : 0,
    parts: budget?.partsBudget ? Number(budget.partsBudget) : 0,
    thirdParty: budget?.thirdPartyBudget ? Number(budget.thirdPartyBudget) : 0
  };

  return {
    budget: budgetData,
    actual,
    variance: {
      total: budgetData.total - actual.total,
      labor: budgetData.labor - actual.labor,
      parts: budgetData.parts - actual.parts,
      thirdParty: budgetData.thirdParty - actual.thirdParty
    },
    percentUsed: budgetData.total > 0 ? Math.round((actual.total / budgetData.total) * 100) : 0
  };
}
