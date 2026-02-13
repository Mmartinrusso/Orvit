/**
 * Centro de Costos V2 - Integración con Compras
 *
 * Lee datos de GoodsReceipt (recepciones confirmadas) para alimentar
 * el sistema de costos automáticamente.
 *
 * IMPORTANTE: Suma por ITEMS de recepción (cantidadAceptada × precioUnitario),
 * NO por OC completa. Esto evita duplicar cuando hay recepciones parciales.
 */

import { prisma } from '@/lib/prisma';
import { Decimal } from '@prisma/client/runtime/library';
import { startOfMonth, endOfMonth, parseISO } from 'date-fns';

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
  itemId: number;
  itemDescription: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  poItemId: number | null;
  supplierItemId: number;
}

/**
 * Obtiene los costos de compras para un mes específico.
 * Solo considera recepciones con estado CONFIRMADA.
 *
 * Calcula el costo por ITEM de recepción, no por OC,
 * evitando duplicar en recepciones parciales.
 *
 * @param companyId - ID de la empresa
 * @param month - Mes en formato "YYYY-MM" (ej: "2026-01")
 */
export async function getPurchaseCostsForMonth(
  companyId: number,
  month: string
): Promise<PurchaseCostData> {
  const startDate = startOfMonth(parseISO(month + '-01'));
  const endDate = endOfMonth(startDate);

  // Buscar recepciones confirmadas del mes
  const receipts = await prisma.goodsReceipt.findMany({
    where: {
      companyId,
      estado: 'CONFIRMADA',
      fechaRecepcion: {
        gte: startDate,
        lte: endDate
      }
    },
    include: {
      proveedor: {
        select: {
          id: true,
          nombre: true
        }
      },
      items: {
        include: {
          purchaseOrderItem: {
            select: {
              precioUnitario: true,
              descuento: true
            }
          },
          supplierItem: {
            select: {
              id: true,
              nombre: true,
              precioUnitario: true
            }
          }
        }
      }
    },
    orderBy: { fechaRecepcion: 'asc' }
  });

  // Si no hay recepciones, retornar valores en cero
  if (receipts.length === 0) {
    return {
      totalPurchases: 0,
      receiptCount: 0,
      itemCount: 0,
      bySupplier: [],
      details: []
    };
  }

  // Calcular totales por items
  let totalPurchases = 0;
  let totalItems = 0;
  const details: PurchaseDetail[] = [];
  const supplierMap = new Map<number, SupplierPurchaseSummary>();

  for (const receipt of receipts) {
    const supplierId = receipt.proveedorId;
    const supplierName = receipt.proveedor.nombre;

    // Inicializar resumen de proveedor si no existe
    if (!supplierMap.has(supplierId)) {
      supplierMap.set(supplierId, {
        supplierId,
        supplierName,
        total: 0,
        receiptCount: 0,
        itemCount: 0
      });
    }

    const supplierSummary = supplierMap.get(supplierId)!;
    supplierSummary.receiptCount += 1;

    for (const item of receipt.items) {
      // Determinar el precio unitario:
      // 1. Precio de la OC (si existe)
      // 2. Fallback al precio del SupplierItem
      let unitCost = 0;

      if (item.purchaseOrderItem?.precioUnitario) {
        unitCost = toNumber(item.purchaseOrderItem.precioUnitario);
        // Aplicar descuento si existe
        const discount = toNumber(item.purchaseOrderItem.descuento);
        if (discount > 0) {
          unitCost = unitCost * (1 - discount / 100);
        }
      } else if (item.supplierItem?.precioUnitario) {
        unitCost = toNumber(item.supplierItem.precioUnitario);
      }

      // Usar cantidadAceptada para el cálculo
      const quantity = toNumber(item.cantidadAceptada);
      const itemCost = quantity * unitCost;

      totalPurchases += itemCost;
      totalItems += 1;
      supplierSummary.total += itemCost;
      supplierSummary.itemCount += 1;

      details.push({
        receiptId: receipt.id,
        receiptNumber: receipt.numero,
        supplierId,
        supplierName,
        receiptDate: receipt.fechaRecepcion,
        itemId: item.id,
        itemDescription: item.descripcion,
        quantity,
        unitCost,
        totalCost: itemCost,
        poItemId: item.purchaseOrderItemId,
        supplierItemId: item.supplierItemId
      });
    }
  }

  // Convertir mapa a array y ordenar por total descendente
  const bySupplier = Array.from(supplierMap.values())
    .sort((a, b) => b.total - a.total);

  return {
    totalPurchases,
    receiptCount: receipts.length,
    itemCount: totalItems,
    bySupplier,
    details
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
