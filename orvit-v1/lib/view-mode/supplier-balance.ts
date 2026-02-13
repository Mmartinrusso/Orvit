/**
 * Supplier Balance Calculation with ViewMode
 * Calculates separate balances for T1 (documented) and all documents
 */

import { prisma } from '@/lib/prisma';
import { ViewMode, MODE, SupplierBalance } from './types';

/**
 * Calculate supplier balance with ViewMode support
 * Returns separate balances for documented (s1) and total (s2)
 *
 * In Standard mode: s1 = s2 (only shows documented)
 * In Extended mode: s1 = documented, s2 = total, d = difference
 */
export async function getSupplierBalance(
  supplierId: number,
  mode: ViewMode
): Promise<SupplierBalance> {
  // Get T1 only balance (always calculated for comparison)
  const t1Balance = await prisma.supplierAccountMovement.aggregate({
    where: {
      supplierId,
      docType: 'T1',
    },
    _sum: {
      debe: true,
      haber: true,
    },
  });

  // Calculate s1 (documented balance)
  const s1 = Number(t1Balance._sum.debe || 0) - Number(t1Balance._sum.haber || 0);

  // In Standard mode, only return documented balance
  if (mode === MODE.STANDARD) {
    return {
      s1,
      s2: s1,  // Same as s1 in Standard mode
      d: 0,    // No difference shown
    };
  }

  // Extended mode: calculate total balance (T1 + T2)
  const totalBalance = await prisma.supplierAccountMovement.aggregate({
    where: { supplierId },
    _sum: {
      debe: true,
      haber: true,
    },
  });

  const s2 = Number(totalBalance._sum.debe || 0) - Number(totalBalance._sum.haber || 0);

  return {
    s1,              // Documented balance
    s2,              // Total balance
    d: s2 - s1,      // Difference (undocumented amount)
  };
}

/**
 * Calculate balances for multiple suppliers
 * Optimized batch query
 */
export async function getSuppliersBalances(
  supplierIds: number[],
  mode: ViewMode
): Promise<Map<number, SupplierBalance>> {
  const result = new Map<number, SupplierBalance>();

  if (supplierIds.length === 0) {
    return result;
  }

  // Get T1 balances grouped by supplier
  const t1Balances = await prisma.supplierAccountMovement.groupBy({
    by: ['supplierId'],
    where: {
      supplierId: { in: supplierIds },
      docType: 'T1',
    },
    _sum: {
      debe: true,
      haber: true,
    },
  });

  // Create map of T1 balances
  const t1Map = new Map<number, number>();
  for (const row of t1Balances) {
    const balance = Number(row._sum.debe || 0) - Number(row._sum.haber || 0);
    t1Map.set(row.supplierId, balance);
  }

  // In Standard mode, s2 = s1
  if (mode === MODE.STANDARD) {
    for (const supplierId of supplierIds) {
      const s1 = t1Map.get(supplierId) || 0;
      result.set(supplierId, { s1, s2: s1, d: 0 });
    }
    return result;
  }

  // Extended mode: also get total balances
  const totalBalances = await prisma.supplierAccountMovement.groupBy({
    by: ['supplierId'],
    where: {
      supplierId: { in: supplierIds },
    },
    _sum: {
      debe: true,
      haber: true,
    },
  });

  // Create map of total balances
  const totalMap = new Map<number, number>();
  for (const row of totalBalances) {
    const balance = Number(row._sum.debe || 0) - Number(row._sum.haber || 0);
    totalMap.set(row.supplierId, balance);
  }

  // Build result with both balances
  for (const supplierId of supplierIds) {
    const s1 = t1Map.get(supplierId) || 0;
    const s2 = totalMap.get(supplierId) || 0;
    result.set(supplierId, { s1, s2, d: s2 - s1 });
  }

  return result;
}

/**
 * Get account movements for a supplier with ViewMode filter
 */
export async function getSupplierMovements(
  supplierId: number,
  mode: ViewMode,
  options?: {
    limit?: number;
    offset?: number;
    startDate?: Date;
    endDate?: Date;
  }
) {
  const where: any = { supplierId };

  // In Standard mode, only show T1
  if (mode === MODE.STANDARD) {
    where.docType = 'T1';
  }

  // Date filters
  if (options?.startDate || options?.endDate) {
    where.fecha = {};
    if (options.startDate) where.fecha.gte = options.startDate;
    if (options.endDate) where.fecha.lte = options.endDate;
  }

  const movements = await prisma.supplierAccountMovement.findMany({
    where,
    orderBy: { fecha: 'desc' },
    take: options?.limit,
    skip: options?.offset,
    include: {
      purchaseReceipt: {
        select: { id: true, tipo: true, numero: true },
      },
      paymentOrder: {
        select: { id: true, number: true },
      },
    },
  });

  return movements;
}
