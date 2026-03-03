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
import { isT2AvailableForCompany } from '@/lib/view-mode/should-query-t2';
import { getT2Client } from '@/lib/prisma-t2';

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
      fechaEmision: {
        gte: startDate,
        lte: endDate,
      },
    },
    include: {
      proveedor: {
        select: { id: true, name: true, razon_social: true },
      },
    },
    orderBy: [{ proveedorId: 'asc' }, { fechaEmision: 'asc' }],
  });

  let totalPurchases = 0;
  const supplierMap = new Map<number, SupplierPurchaseSummary>();
  const details: PurchaseDetail[] = [];
  let totalReceiptCount = 0;

  // --- Procesar compras T1 ---
  for (const receipt of receipts) {
    const neto = toNumber(receipt.neto);
    const supplierId = receipt.proveedorId;
    const supplierName = receipt.proveedor.razon_social || receipt.proveedor.name;

    totalPurchases += neto;
    totalReceiptCount++;

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
      receiptDate: receipt.fechaEmision,
      neto,
      total: toNumber(receipt.total),
      estado: receipt.estado,
      tipo: receipt.tipo,
    });
  }

  // --- Incluir compras T2 si la empresa tiene T2 habilitado ---
  if (await isT2AvailableForCompany(companyId)) {
    try {
      const prismaT2 = getT2Client();
      const t2Receipts = await prismaT2.t2PurchaseReceipt.findMany({
        where: {
          companyId,
          estado: { not: 'cancelado' },
          fechaEmision: { gte: startDate, lte: endDate },
        },
      });

      if (t2Receipts.length > 0) {
        // Obtener nombres de proveedores del main DB
        const t2SupplierIds: number[] = [];
        for (const r of t2Receipts) {
          const sid = r.supplierId as number;
          if (!t2SupplierIds.includes(sid)) t2SupplierIds.push(sid);
        }
        const t2Suppliers = t2SupplierIds.length > 0
          ? await prisma.suppliers.findMany({
              where: { id: { in: t2SupplierIds } },
              select: { id: true, name: true, razon_social: true },
            })
          : [];
        const t2SupMap = new Map<number, { id: number; name: string; razon_social: string | null }>(
          t2Suppliers.map(s => [s.id, s])
        );

        for (const receipt of t2Receipts) {
          const neto = Number(receipt.neto) || 0;
          const supplierId = receipt.supplierId as number;
          const sup = t2SupMap.get(supplierId);
          const supplierName = sup?.razon_social || sup?.name || `Proveedor ${supplierId}`;

          totalPurchases += neto;
          totalReceiptCount++;

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
            receiptNumber: `T2-${receipt.numeroSerie || ''}-${receipt.numeroFactura || ''}`.replace(/^T2--/, 'T2-'),
            supplierId,
            supplierName,
            receiptDate: receipt.fechaEmision,
            neto,
            total: Number(receipt.total) || 0,
            estado: receipt.estado,
            tipo: receipt.tipo,
          });
        }
      }
    } catch (err) {
      console.error('[Costs/Purchases] Error querying T2:', err);
    }
  }

  const bySupplier = Array.from(supplierMap.values()).sort((a, b) => b.total - a.total);

  return {
    totalPurchases,
    receiptCount: totalReceiptCount,
    itemCount: totalReceiptCount,
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
