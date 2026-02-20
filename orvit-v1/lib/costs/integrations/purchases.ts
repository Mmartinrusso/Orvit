/**
 * Centro de Costos V2 - Integración con Compras
 *
 * Lee las facturas de Compras (PurchaseReceipt) del mes para mostrar
 * el gasto total de compras operativas, excluyendo:
 * - Facturas de costos indirectos (esIndirecto = true) → van a IndirectViewV2
 * - Facturas canceladas
 *
 * El monto usado es el campo `neto` de cada comprobante.
 */

import { prisma } from '@/lib/prisma';
import { Decimal } from '@prisma/client/runtime/library';

export interface PurchaseCostData {
  totalPurchases: number;
  receiptCount: number;
  itemCount: number;
  bySupplier: SupplierPurchaseSummary[];
  details: PurchaseDetail[];
}

export interface SupplierPurchaseSummary {
  supplierId: number;
  supplierName: string;
  total: number;
  receiptCount: number;
  itemCount: number;
}

export interface PurchaseDetail {
  receiptId: number;
  receiptNumber: string;
  supplierId: number;
  supplierName: string;
  receiptDate: Date;
  neto: number;
  total: number;
  estado: string;
  tipo: string;
}

/**
 * Obtiene todas las facturas de compras del mes (excluyendo indirectas y canceladas).
 *
 * @param companyId - ID de la empresa
 * @param month - Mes en formato "YYYY-MM" (ej: "2026-01")
 */
export async function getPurchaseCostsForMonth(
  companyId: number,
  month: string
): Promise<PurchaseCostData> {
  const [year, monthNum] = month.split('-').map(Number);
  const startDate = new Date(year, monthNum - 1, 1);
  const endDate = new Date(year, monthNum, 0, 23, 59, 59, 999);

  const receipts = await prisma.purchaseReceipt.findMany({
    where: {
      companyId,
      esIndirecto: false,
      estado: { not: 'cancelado' },
      fechaImputacion: {
        gte: startDate,
        lte: endDate,
      },
    },
    include: {
      proveedor: {
        select: { id: true, name: true, razon_social: true },
      },
    },
    orderBy: [{ proveedorId: 'asc' }, { fechaImputacion: 'asc' }],
  });

  if (receipts.length === 0) {
    return {
      totalPurchases: 0,
      receiptCount: 0,
      itemCount: 0,
      bySupplier: [],
      details: [],
    };
  }

  let totalPurchases = 0;
  const supplierMap = new Map<number, SupplierPurchaseSummary>();
  const details: PurchaseDetail[] = [];

  for (const receipt of receipts) {
    const neto = toNumber(receipt.neto);
    const supplierId = receipt.proveedorId;
    const supplierName = receipt.proveedor.razon_social || receipt.proveedor.name;

    totalPurchases += neto;

    if (!supplierMap.has(supplierId)) {
      supplierMap.set(supplierId, {
        supplierId,
        supplierName,
        total: 0,
        receiptCount: 0,
        itemCount: 0,
      });
    }
    const s = supplierMap.get(supplierId)!;
    s.total += neto;
    s.receiptCount += 1;

    details.push({
      receiptId: receipt.id,
      receiptNumber: `${receipt.numeroSerie ?? ''}-${receipt.numeroFactura ?? ''}`.replace(/^-|-$/, ''),
      supplierId,
      supplierName,
      receiptDate: receipt.fechaImputacion,
      neto,
      total: toNumber(receipt.total),
      estado: receipt.estado,
      tipo: receipt.tipo,
    });
  }

  const bySupplier = Array.from(supplierMap.values()).sort((a, b) => b.total - a.total);

  return {
    totalPurchases,
    receiptCount: receipts.length,
    itemCount: receipts.length, // campo legacy, igual a receiptCount
    bySupplier,
    details,
  };
}

/**
 * Obtiene resumen de compras agrupado por proveedor
 */
export async function getPurchasesBySupplier(
  companyId: number,
  month: string
): Promise<SupplierPurchaseSummary[]> {
  const data = await getPurchaseCostsForMonth(companyId, month);
  return data.bySupplier;
}

/**
 * Helper para convertir Decimal de Prisma a number
 */
function toNumber(value: Decimal | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  return Number(value);
}
