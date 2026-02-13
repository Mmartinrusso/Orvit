/**
 * Helper para enriquecer datos T2 con datos maestros de BD principal
 *
 * Los documentos T2 solo tienen IDs de referencia a entidades maestras
 * (suppliers, items, users, etc.) que viven en la BD principal.
 * Este helper combina los datos de ambas BDs.
 */

import { prisma } from '@/lib/prisma';
import type {
  T2PurchaseReceipt,
  T2PaymentOrder,
  T2StockMovement,
  T2SupplierAccountMovement,
} from '@/lib/prisma-t2';

// Tipos para datos enriquecidos
export interface EnrichedT2Receipt extends T2PurchaseReceipt {
  docType: 'T2';
  proveedor: {
    id: number;
    razon_social: string | null;
    cuit?: string | null;
  } | null;
  tipoCuenta: {
    id: number;
    nombre: string;
  } | null;
  createdByUser: {
    id: number;
    name: string;
  } | null;
}

export interface EnrichedT2PaymentOrder extends T2PaymentOrder {
  docType: 'T2';
  proveedor: {
    id: number;
    razon_social: string | null;
    cuit?: string | null;
  } | null;
  createdByUser: {
    id: number;
    name: string;
  } | null;
}

export interface EnrichedT2StockMovement extends T2StockMovement {
  docType: 'T2';
  supplierItem: {
    id: number;
    codigoPropio: string | null;
    descripcion: string;
  } | null;
  warehouse: {
    id: number;
    nombre: string;
  } | null;
}

/**
 * Enriquece comprobantes T2 con datos de proveedores y cuentas
 */
export async function enrichT2Receipts(
  receipts: T2PurchaseReceipt[]
): Promise<EnrichedT2Receipt[]> {
  if (receipts.length === 0) return [];

  // Obtener IDs únicos
  const supplierIds = [...new Set(receipts.map((r) => r.supplierId).filter(Boolean))] as number[];
  const accountIds = [...new Set(receipts.map((r) => r.tipoCuentaId).filter(Boolean))] as number[];
  const userIds = [...new Set(receipts.map((r) => r.createdBy).filter(Boolean))] as number[];

  // Fetch en paralelo de BD principal
  const [suppliers, accounts, users] = await Promise.all([
    supplierIds.length > 0
      ? prisma.suppliers.findMany({
          where: { id: { in: supplierIds } },
          select: { id: true, razon_social: true, cuit: true },
        })
      : [],
    accountIds.length > 0
      ? prisma.purchaseAccount.findMany({
          where: { id: { in: accountIds } },
          select: { id: true, nombre: true },
        })
      : [],
    userIds.length > 0
      ? prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true },
        })
      : [],
  ]);

  // Crear maps para lookup rápido
  const supplierMap = new Map(suppliers.map((s) => [s.id, s]));
  const accountMap = new Map(accounts.map((a) => [a.id, a]));
  const userMap = new Map(users.map((u) => [u.id, u]));

  // Enriquecer cada receipt
  return receipts.map((receipt) => ({
    ...receipt,
    docType: 'T2' as const,
    proveedor: receipt.supplierId ? supplierMap.get(receipt.supplierId) || null : null,
    tipoCuenta: receipt.tipoCuentaId ? accountMap.get(receipt.tipoCuentaId) || null : null,
    createdByUser: receipt.createdBy ? userMap.get(receipt.createdBy) || null : null,
  }));
}

/**
 * Enriquece órdenes de pago T2 con datos de proveedores
 */
export async function enrichT2PaymentOrders(
  orders: T2PaymentOrder[]
): Promise<EnrichedT2PaymentOrder[]> {
  if (orders.length === 0) return [];

  const supplierIds = [...new Set(orders.map((o) => o.supplierId).filter(Boolean))] as number[];
  const userIds = [...new Set(orders.map((o) => o.createdBy).filter(Boolean))] as number[];

  const [suppliers, users] = await Promise.all([
    supplierIds.length > 0
      ? prisma.suppliers.findMany({
          where: { id: { in: supplierIds } },
          select: { id: true, razon_social: true, cuit: true },
        })
      : [],
    userIds.length > 0
      ? prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true },
        })
      : [],
  ]);

  const supplierMap = new Map(suppliers.map((s) => [s.id, s]));
  const userMap = new Map(users.map((u) => [u.id, u]));

  return orders.map((order) => ({
    ...order,
    docType: 'T2' as const,
    proveedor: order.supplierId ? supplierMap.get(order.supplierId) || null : null,
    createdByUser: order.createdBy ? userMap.get(order.createdBy) || null : null,
  }));
}

/**
 * Enriquece movimientos de stock T2 con datos de items y depósitos
 */
export async function enrichT2StockMovements(
  movements: T2StockMovement[]
): Promise<EnrichedT2StockMovement[]> {
  if (movements.length === 0) return [];

  const itemIds = [...new Set(movements.map((m) => m.supplierItemId).filter(Boolean))] as number[];
  const warehouseIds = [...new Set(movements.map((m) => m.warehouseId).filter(Boolean))] as number[];

  const [items, warehouses] = await Promise.all([
    itemIds.length > 0
      ? prisma.supplierItem.findMany({
          where: { id: { in: itemIds } },
          select: { id: true, codigoPropio: true, descripcion: true },
        })
      : [],
    warehouseIds.length > 0
      ? prisma.warehouse.findMany({
          where: { id: { in: warehouseIds } },
          select: { id: true, nombre: true },
        })
      : [],
  ]);

  const itemMap = new Map(items.map((i) => [i.id, i]));
  const warehouseMap = new Map(warehouses.map((w) => [w.id, w]));

  return movements.map((mov) => ({
    ...mov,
    docType: 'T2' as const,
    supplierItem: mov.supplierItemId ? itemMap.get(mov.supplierItemId) || null : null,
    warehouse: mov.warehouseId ? warehouseMap.get(mov.warehouseId) || null : null,
  }));
}

/**
 * Enriquece movimientos de cuenta corriente T2 con datos de proveedores
 */
export async function enrichT2AccountMovements(
  movements: T2SupplierAccountMovement[]
): Promise<(T2SupplierAccountMovement & { docType: 'T2'; proveedor: any })[]> {
  if (movements.length === 0) return [];

  const supplierIds = [...new Set(movements.map((m) => m.supplierId).filter(Boolean))] as number[];

  const suppliers =
    supplierIds.length > 0
      ? await prisma.suppliers.findMany({
          where: { id: { in: supplierIds } },
          select: { id: true, razon_social: true, cuit: true },
        })
      : [];

  const supplierMap = new Map(suppliers.map((s) => [s.id, s]));

  return movements.map((mov) => ({
    ...mov,
    docType: 'T2' as const,
    proveedor: mov.supplierId ? supplierMap.get(mov.supplierId) || null : null,
  }));
}
