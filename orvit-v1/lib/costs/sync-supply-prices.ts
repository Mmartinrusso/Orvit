/**
 * Sincronización automática de precios de insumos desde Compras
 *
 * Cuando se crea o edita un comprobante de compra, recalcula el precio
 * mensual como PROMEDIO PONDERADO de todas las compras del mes para ese insumo.
 *
 * Ejemplo:
 *   Cantesur:          10 TN × $25.000 = $250.000
 *   Canteras Diquecito: 5 TN × $24.000 = $120.000
 *   Promedio ponderado: $370.000 / 15 TN = $24.666,67/TN
 */

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { isT2AvailableForCompany } from '@/lib/view-mode/should-query-t2';
import { getT2Client } from '@/lib/prisma-t2';

interface SyncSupplyPriceArgs {
  /** ID del SupplierItem (PurchaseReceiptItem.itemId) */
  itemId: number;
  /** Fecha de emisión del comprobante (Date o string YYYY-MM-DD) */
  fechaEmision: Date | string | null | undefined;
  /** ID de la empresa */
  companyId: number;
}

/**
 * Recalcula el precio mensual de un insumo como promedio ponderado
 * de TODAS las compras del mes (todos los proveedores).
 *
 * Fórmula: SUM(cantidad × precioUnitario) / SUM(cantidad)
 *
 * Debe llamarse dentro de la misma transacción Prisma del comprobante.
 */
export async function syncSupplyPrice(
  tx: Prisma.TransactionClient,
  { itemId, fechaEmision, companyId }: SyncSupplyPriceArgs
): Promise<void> {
  // 1. Obtener supplyId desde SupplierItem
  const supplierItem = await tx.supplierItem.findUnique({
    where: { id: itemId },
    select: { supplyId: true },
  });

  if (!supplierItem?.supplyId) return;

  // 2. Determinar el rango del mes
  let date: Date;
  if (!fechaEmision) {
    date = new Date();
  } else if (fechaEmision instanceof Date) {
    date = fechaEmision;
  } else {
    date = new Date(fechaEmision);
    if (isNaN(date.getTime())) {
      date = new Date();
    }
  }

  const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
  const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  const fechaStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

  // 3. Obtener tipo de cambio de reposición USD (si existe)
  const costingSettings = await tx.$queryRaw<Array<{ tipoCambioUSD: number | null }>>`
    SELECT "tipoCambioUSD" FROM "CompanySettingsCosting" WHERE "companyId" = ${companyId} LIMIT 1
  `;
  const tipoCambioReposicion = costingSettings[0]?.tipoCambioUSD ? Number(costingSettings[0].tipoCambioUSD) : null;

  // 4. Calcular promedio ponderado de TODAS las compras del mes para este supply
  //    JOIN PurchaseReceiptItem → SupplierItem (para filtrar por supplyId)
  //    JOIN PurchaseReceipt (para filtrar por mes de emisión)
  //    Si la factura es en USD, convierte usando:
  //      - tipoCambioUSD de reposición (CompanySettingsCosting) si existe
  //      - tipoCambio de la factura como fallback
  const result = await tx.$queryRaw<Array<{
    weighted_total: number | null;
    total_qty: number | null;
    supplier_count: number | null;
  }>>`
    SELECT
      SUM(
        CASE WHEN pr."moneda" = 'USD'
          THEN pri."precioUnitario" * pri.cantidad * COALESCE(${tipoCambioReposicion}::numeric, pr."tipoCambio", 1)
          ELSE pri."precioUnitario" * pri.cantidad
        END
      ) as weighted_total,
      SUM(pri.cantidad) as total_qty,
      COUNT(DISTINCT pri."proveedorId") as supplier_count
    FROM "PurchaseReceiptItem" pri
    JOIN "SupplierItem" si ON si.id = pri."itemId"
    JOIN "PurchaseReceipt" pr ON pr.id = pri."comprobanteId"
    WHERE si."supplyId" = ${supplierItem.supplyId}
      AND pr."fechaEmision" >= ${monthStart}
      AND pr."fechaEmision" < ${monthEnd}
      AND pri."companyId" = ${companyId}
      AND pri."precioUnitario" > 0
      AND pri.cantidad > 0
  `;

  const row = result[0];
  if (!row?.weighted_total || !row?.total_qty || Number(row.total_qty) === 0) return;

  const avgPrice = Number(row.weighted_total) / Number(row.total_qty);
  const supplierCount = Number(row.supplier_count) || 1;
  const notes = supplierCount > 1
    ? `Promedio ponderado (${supplierCount} proveedores)`
    : 'Auto: compras';

  // 4. UPSERT en supply_monthly_prices
  await tx.$executeRaw`
    INSERT INTO supply_monthly_prices
      (supply_id, month_year, fecha_imputacion, price_per_unit, freight_cost, notes, company_id, created_at, updated_at)
    VALUES
      (${supplierItem.supplyId}, ${monthStart}, ${fechaStr},
       ${avgPrice}, ${0},
       ${notes}, ${companyId}, NOW(), NOW())
    ON CONFLICT (supply_id, month_year)
    DO UPDATE SET
      price_per_unit = ${avgPrice},
      freight_cost   = ${0},
      notes          = ${notes},
      updated_at     = NOW()
  `;
}

/**
 * Sincroniza todos los ítems de un comprobante.
 * Para cada supply único, recalcula el promedio ponderado del mes.
 *
 * @param tx - Transacción Prisma activa
 * @param items - Array de ítems procesados del comprobante
 * @param fechaEmision - Fecha de emisión del comprobante
 * @param companyId - ID de la empresa
 * @param _referencia - (legacy, ya no se usa — el notes se genera automáticamente)
 */
export async function syncAllSupplyPrices(
  tx: Prisma.TransactionClient,
  items: Array<{ itemId?: number | null; precioUnitario?: number | null }>,
  fechaEmision: Date | string | null | undefined,
  companyId: number,
  _referencia?: string
): Promise<void> {
  // Obtener supplyIds únicos para no recalcular el mismo supply múltiples veces
  const processedSupplyIds = new Set<number>();

  for (const item of items) {
    if (!item.itemId || !item.precioUnitario || item.precioUnitario <= 0) continue;

    // Obtener supplyId para dedup
    const si = await tx.supplierItem.findUnique({
      where: { id: item.itemId },
      select: { supplyId: true },
    });
    if (!si?.supplyId || processedSupplyIds.has(si.supplyId)) continue;
    processedSupplyIds.add(si.supplyId);

    await syncSupplyPrice(tx, {
      itemId: item.itemId,
      fechaEmision,
      companyId,
    });
  }
}

/**
 * Recalcula precio de un supply incluyendo compras T1 + T2.
 * Se llama al crear comprobante T2 (fuera de transacción T1).
 *
 * A diferencia de syncSupplyPrice() que corre dentro de una tx,
 * esta función es standalone y usa el prisma client directo.
 */
export async function syncSupplyPriceWithT2({
  supplyId,
  fechaEmision,
  companyId,
}: {
  supplyId: number;
  fechaEmision: Date | string;
  companyId: number;
}): Promise<void> {
  // Determinar rango del mes
  let date = fechaEmision instanceof Date ? fechaEmision : new Date(String(fechaEmision));
  if (isNaN(date.getTime())) date = new Date();

  const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
  const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  const fechaStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

  // Obtener tipo de cambio de reposición USD
  const costingSettings = await prisma.$queryRaw<Array<{ tipoCambioUSD: number | null }>>`
    SELECT "tipoCambioUSD" FROM "CompanySettingsCosting" WHERE "companyId" = ${companyId} LIMIT 1
  `;
  const tipoCambioReposicion = costingSettings[0]?.tipoCambioUSD ? Number(costingSettings[0].tipoCambioUSD) : null;

  // Query T1 (con conversión USD)
  const t1Result = await prisma.$queryRaw<Array<{
    weighted_total: number | null;
    total_qty: number | null;
    supplier_count: number | null;
  }>>`
    SELECT
      SUM(
        CASE WHEN pr."moneda" = 'USD'
          THEN pri."precioUnitario" * pri.cantidad * COALESCE(${tipoCambioReposicion}::numeric, pr."tipoCambio", 1)
          ELSE pri."precioUnitario" * pri.cantidad
        END
      ) as weighted_total,
      SUM(pri.cantidad) as total_qty,
      COUNT(DISTINCT pri."proveedorId") as supplier_count
    FROM "PurchaseReceiptItem" pri
    JOIN "SupplierItem" si ON si.id = pri."itemId"
    JOIN "PurchaseReceipt" pr ON pr.id = pri."comprobanteId"
    WHERE si."supplyId" = ${supplyId}
      AND pr."fechaEmision" >= ${monthStart}
      AND pr."fechaEmision" < ${monthEnd}
      AND pri."companyId" = ${companyId}
      AND pri."precioUnitario" > 0
      AND pri.cantidad > 0
  `;

  let totalWeighted = Number(t1Result[0]?.weighted_total) || 0;
  let totalQty = Number(t1Result[0]?.total_qty) || 0;
  let supplierCount = Number(t1Result[0]?.supplier_count) || 0;

  // Query T2 si está disponible
  if (await isT2AvailableForCompany(companyId)) {
    try {
      const prismaT2 = getT2Client();
      const relatedItems = await prisma.supplierItem.findMany({
        where: { supplyId, companyId },
        select: { id: true },
      });
      const itemIds = relatedItems.map(i => i.id);

      if (itemIds.length > 0) {
        const t2Items = await prismaT2.t2PurchaseReceiptItem.findMany({
          where: {
            supplierItemId: { in: itemIds },
            receipt: {
              companyId,
              fechaEmision: { gte: monthStart, lt: monthEnd },
              estado: { not: 'cancelado' },
            },
          },
          include: { receipt: { select: { supplierId: true } } },
        });

        const t2Suppliers = new Set<number>();
        for (const item of t2Items) {
          const precio = Number(item.precioUnitario);
          const cantidad = Number(item.cantidad);
          if (precio > 0 && cantidad > 0) {
            totalWeighted += precio * cantidad;
            totalQty += cantidad;
            t2Suppliers.add(item.receipt.supplierId);
          }
        }
        supplierCount += t2Suppliers.size;
      }
    } catch (err) {
      console.warn('[syncSupplyPriceWithT2] T2 query error:', err);
    }
  }

  if (totalQty === 0) return;

  const avgPrice = totalWeighted / totalQty;
  const notes = supplierCount > 1
    ? `Promedio ponderado (${supplierCount} proveedores)`
    : 'Auto: compras';

  // Upsert en supply_monthly_prices
  await prisma.$executeRaw`
    INSERT INTO supply_monthly_prices
      (supply_id, month_year, fecha_imputacion, price_per_unit, freight_cost, notes, company_id, created_at, updated_at)
    VALUES
      (${supplyId}, ${monthStart}, ${fechaStr}, ${avgPrice}, ${0}, ${notes}, ${companyId}, NOW(), NOW())
    ON CONFLICT (supply_id, month_year)
    DO UPDATE SET
      price_per_unit = ${avgPrice},
      freight_cost   = ${0},
      notes          = ${notes},
      updated_at     = NOW()
  `;
}
