/**
 * Centro de Costos V2 - Consolidación Mensual
 *
 * Patrón SNAPSHOT:
 * - GET lee snapshot guardado (rápido, para UI)
 * - POST recalcula y guarda nuevo snapshot (operación pesada)
 *
 * Los períodos pueden cerrarse (isClosed) para evitar cambios accidentales.
 */

import { prisma } from '@/lib/prisma';
import { getPayrollCostsForMonth } from './integrations/payroll';
import { getIndirectCostsForMonth } from './integrations/indirect';
import { getPurchaseCostsForMonth } from './integrations/purchases';
import { getSalesForMonth } from './integrations/sales';
import { getProductionCostsForMonth } from './integrations/production';
import { getMaintenanceCostsForMonth } from './integrations/maintenance';

export interface ConsolidationSnapshot {
  month: string;
  exists: boolean;
  isClosed: boolean;
  calculatedAt: Date | null;
  calculatedById: number | null;
  version: string;
  costs: {
    payroll: number;
    purchases: number;
    indirect: number;
    production: number;
    maintenance: number;
  };
  revenue: {
    sales: number;
    cogs: number;
    margin: number;
  };
  summary: {
    totalCost: number;
    totalRevenue: number;
    netResult: number;
  };
  details: any;
}

export interface ConsolidationDetails {
  payroll: any;
  purchases: any;
  indirect: any;
  production: any;
  maintenance: any;
  sales: any;
}

/**
 * Lee el snapshot de consolidación guardado (operación rápida)
 */
export async function getConsolidationSnapshot(
  companyId: number,
  month: string
): Promise<ConsolidationSnapshot> {
  const snapshot = await prisma.monthlyCostConsolidation.findUnique({
    where: {
      companyId_month: { companyId, month }
    }
  });

  if (!snapshot) {
    return {
      month,
      exists: false,
      isClosed: false,
      calculatedAt: null,
      calculatedById: null,
      version: 'V1',
      costs: {
        payroll: 0,
        purchases: 0,
        indirect: 0,
        production: 0,
        maintenance: 0
      },
      revenue: {
        sales: 0,
        cogs: 0,
        margin: 0
      },
      summary: {
        totalCost: 0,
        totalRevenue: 0,
        netResult: 0
      },
      details: null
    };
  }

  return {
    month,
    exists: true,
    isClosed: snapshot.isClosed,
    calculatedAt: snapshot.calculatedAt,
    calculatedById: snapshot.calculatedById,
    version: snapshot.version,
    costs: {
      payroll: Number(snapshot.payrollCost),
      purchases: Number(snapshot.purchasesCost),
      indirect: Number(snapshot.indirectCost),
      production: Number(snapshot.productionCost),
      maintenance: Number(snapshot.maintenanceCost)
    },
    revenue: {
      sales: Number(snapshot.salesRevenue),
      cogs: Number(snapshot.salesCost),
      margin: Number(snapshot.grossMargin)
    },
    summary: {
      totalCost: Number(snapshot.totalCost),
      totalRevenue: Number(snapshot.totalRevenue),
      netResult: Number(snapshot.netResult)
    },
    details: snapshot.details
  };
}

/**
 * Recalcula y guarda el snapshot de consolidación (operación pesada)
 */
export async function recalculateConsolidation(
  companyId: number,
  month: string,
  userId: number,
  force: boolean = false
): Promise<{ success: boolean; snapshot?: ConsolidationSnapshot; error?: string }> {
  // Verificar si el período está cerrado
  const existing = await prisma.monthlyCostConsolidation.findUnique({
    where: { companyId_month: { companyId, month } }
  });

  if (existing?.isClosed && !force) {
    return {
      success: false,
      error: 'Período cerrado. Use force=true para recalcular.'
    };
  }

  // Ejecutar integraciones en paralelo
  const [payroll, purchases, indirect, production, maintenance, sales] = await Promise.all([
    getPayrollCostsForMonth(companyId, month),
    getPurchaseCostsForMonth(companyId, month),
    getIndirectCostsForMonth(companyId, month),
    getProductionCostsForMonth(companyId, month),
    getMaintenanceCostsForMonth(companyId, month),
    getSalesForMonth(companyId, month)
  ]);

  // Calcular totales
  const payrollCost = payroll.employerCost;
  const purchasesCost = purchases.totalPurchases;
  const indirectCost = indirect.total;
  const productionCost = production.totalProductionCost;
  const maintenanceCost = maintenance.totalCost;

  const totalCost = payrollCost + purchasesCost + indirectCost +
                    productionCost + maintenanceCost;

  const salesRevenue = sales.totalRevenue;
  const salesCOGS = sales.totalCost;
  const grossMargin = sales.grossMargin;

  const totalRevenue = salesRevenue;
  const netResult = totalRevenue - totalCost;

  // Preparar detalles para guardar
  const details: ConsolidationDetails = {
    payroll: {
      employerCost: payroll.employerCost,
      totalGross: payroll.totalGross,
      totalDeductions: payroll.totalDeductions,
      totalNet: payroll.totalNet,
      employeeCount: payroll.employeeCount,
      payrollCount: payroll.payrollCount
    },
    purchases: {
      totalPurchases: purchases.totalPurchases,
      receiptCount: purchases.receiptCount,
      itemCount: purchases.itemCount,
      supplierCount: purchases.bySupplier.length
    },
    indirect: {
      total: indirect.total,
      itemCount: indirect.itemCount,
      categoryCount: Object.keys(indirect.byCategory).length
    },
    production: {
      totalProductionCost: production.totalProductionCost,
      unitsProduced: production.unitsProduced,
      productCount: production.productCount
    },
    maintenance: {
      totalCost: maintenance.totalCost,
      laborCost: maintenance.laborCost,
      partsCost: maintenance.partsCost,
      thirdPartyCost: maintenance.thirdPartyCost,
      workOrderCount: maintenance.workOrderCount
    },
    sales: {
      totalRevenue: sales.totalRevenue,
      totalCost: sales.totalCost,
      grossMargin: sales.grossMargin,
      marginPercent: sales.marginPercent,
      invoiceCount: sales.invoiceCount
    }
  };

  // Guardar snapshot
  const result = await prisma.monthlyCostConsolidation.upsert({
    where: { companyId_month: { companyId, month } },
    create: {
      companyId,
      month,
      payrollCost,
      purchasesCost,
      indirectCost,
      productionCost,
      maintenanceCost,
      salesRevenue,
      salesCost: salesCOGS,
      grossMargin,
      totalCost,
      totalRevenue,
      netResult,
      version: 'V2',
      calculatedById: userId,
      details
    },
    update: {
      payrollCost,
      purchasesCost,
      indirectCost,
      productionCost,
      maintenanceCost,
      salesRevenue,
      salesCost: salesCOGS,
      grossMargin,
      totalCost,
      totalRevenue,
      netResult,
      version: 'V2',
      calculatedById: userId,
      calculatedAt: new Date(),
      details
    }
  });

  return {
    success: true,
    snapshot: {
      month,
      exists: true,
      isClosed: result.isClosed,
      calculatedAt: result.calculatedAt,
      calculatedById: result.calculatedById,
      version: result.version,
      costs: {
        payroll: payrollCost,
        purchases: purchasesCost,
        indirect: indirectCost,
        production: productionCost,
        maintenance: maintenanceCost
      },
      revenue: {
        sales: salesRevenue,
        cogs: salesCOGS,
        margin: grossMargin
      },
      summary: {
        totalCost,
        totalRevenue,
        netResult
      },
      details
    }
  };
}

/**
 * Cierra un período (evita recálculos accidentales)
 */
export async function closePeriod(
  companyId: number,
  month: string
): Promise<{ success: boolean; error?: string }> {
  const existing = await prisma.monthlyCostConsolidation.findUnique({
    where: { companyId_month: { companyId, month } }
  });

  if (!existing) {
    return {
      success: false,
      error: 'No existe consolidación para este período. Recalcule primero.'
    };
  }

  await prisma.monthlyCostConsolidation.update({
    where: { companyId_month: { companyId, month } },
    data: { isClosed: true }
  });

  return { success: true };
}

/**
 * Reabre un período (permite recálculos)
 */
export async function reopenPeriod(
  companyId: number,
  month: string
): Promise<{ success: boolean; error?: string }> {
  const existing = await prisma.monthlyCostConsolidation.findUnique({
    where: { companyId_month: { companyId, month } }
  });

  if (!existing) {
    return {
      success: false,
      error: 'No existe consolidación para este período.'
    };
  }

  await prisma.monthlyCostConsolidation.update({
    where: { companyId_month: { companyId, month } },
    data: { isClosed: false }
  });

  return { success: true };
}
