/**
 * Stock Availability Service
 *
 * Calcula la disponibilidad real de stock considerando:
 * - OnHand: Cantidad física en ubicación (StockLocation.cantidad)
 * - Reserved: Cantidad reservada para solicitudes, OT, OP (StockReservation activas)
 * - Available: OnHand - Reserved
 * - Incoming: Cantidad pendiente de recibir (OC aprobadas/enviadas)
 * - Outgoing: Cantidad en despachos pendientes (EN_PREPARACION, LISTO_DESPACHO)
 */

import { prisma } from '@/lib/prisma';
import { Decimal } from '@prisma/client/runtime/library';
import {
  StockReservationStatus,
  DespachoStatus,
  PurchaseOrderStatus,
} from '@prisma/client';

// ============================================================================
// Types
// ============================================================================

export interface StockAvailability {
  supplierItemId: number;
  warehouseId: number;
  warehouseName?: string;
  itemName?: string;
  itemCode?: string;
  unit?: string;
  onHand: number;          // StockLocation.cantidad
  reserved: number;        // Sum of active reservations
  available: number;       // onHand - reserved
  incoming: number;        // OC pendientes de recibir
  outgoing: number;        // Despachos EN_PREPARACION/LISTO
  projected: number;       // available + incoming - outgoing
  stockMinimo?: number;
  stockMaximo?: number;
  puntoReposicion?: number;
  belowMinimum: boolean;
  belowReorderPoint: boolean;
}

export interface StockAvailabilityParams {
  supplierItemId?: number;
  warehouseId?: number;
  companyId: number;
  includeItemDetails?: boolean;
  includeIncoming?: boolean;
  includeOutgoing?: boolean;
}

export interface BulkAvailabilityParams {
  supplierItemIds: number[];
  warehouseId?: number;
  companyId: number;
  includeItemDetails?: boolean;
  includeIncoming?: boolean;
  includeOutgoing?: boolean;
}

export interface AvailabilityCheckResult {
  isAvailable: boolean;
  requestedQuantity: number;
  availableQuantity: number;
  shortfall: number;
  message: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

function decimalToNumber(value: Decimal | null | undefined): number {
  if (value === null || value === undefined) return 0;
  return Number(value);
}

// ============================================================================
// Core Availability Functions
// ============================================================================

/**
 * Get stock availability for a specific item in a specific warehouse
 */
export async function getAvailability(
  supplierItemId: number,
  warehouseId: number,
  companyId: number,
  options: {
    includeItemDetails?: boolean;
    includeIncoming?: boolean;
    includeOutgoing?: boolean;
  } = {}
): Promise<StockAvailability> {
  const {
    includeItemDetails = true,
    includeIncoming = true,
    includeOutgoing = true,
  } = options;

  // Get stock location (onHand)
  const stockLocation = await prisma.stockLocation.findUnique({
    where: {
      warehouseId_supplierItemId: {
        warehouseId,
        supplierItemId,
      },
    },
    include: {
      warehouse: includeItemDetails,
      supplierItem: includeItemDetails ? {
        select: {
          id: true,
          nombre: true,
          codigoProveedor: true,
          unidad: true,
        },
      } : false,
    },
  });

  const onHand = stockLocation ? decimalToNumber(stockLocation.cantidad) : 0;
  const stockMinimo = stockLocation ? decimalToNumber(stockLocation.stockMinimo) : undefined;
  const stockMaximo = stockLocation ? decimalToNumber(stockLocation.stockMaximo) : undefined;
  const puntoReposicion = stockLocation ? decimalToNumber(stockLocation.puntoReposicion) : undefined;

  // Get active reservations
  const reservationsAgg = await prisma.stockReservation.aggregate({
    where: {
      supplierItemId,
      warehouseId,
      companyId,
      estado: {
        in: [StockReservationStatus.ACTIVA, StockReservationStatus.CONSUMIDA_PARCIAL],
      },
    },
    _sum: {
      cantidad: true,
      cantidadConsumida: true,
    },
  });

  const totalReserved = decimalToNumber(reservationsAgg._sum.cantidad);
  const totalConsumed = decimalToNumber(reservationsAgg._sum.cantidadConsumida);
  const reserved = totalReserved - totalConsumed;

  // Get incoming (pending PO items)
  let incoming = 0;
  if (includeIncoming) {
    const incomingAgg = await prisma.purchaseOrderItem.aggregate({
      where: {
        supplierItemId,
        purchaseOrder: {
          companyId,
          status: {
            in: [
              PurchaseOrderStatus.APROBADA,
              PurchaseOrderStatus.ENVIADA_PROVEEDOR,
              PurchaseOrderStatus.CONFIRMADA,
              PurchaseOrderStatus.PARCIALMENTE_RECIBIDA,
            ],
          },
          // Filter by warehouse if the PO has warehouse assigned
          OR: [
            { warehouseId },
            { warehouseId: null }, // Include POs without warehouse (will go to default)
          ],
        },
      },
      _sum: {
        cantidad: true,
        cantidadRecibida: true,
      },
    });

    const orderedQty = decimalToNumber(incomingAgg._sum.cantidad);
    const receivedQty = decimalToNumber(incomingAgg._sum.cantidadRecibida);
    incoming = orderedQty - receivedQty;
  }

  // Get outgoing (pending dispatches)
  let outgoing = 0;
  if (includeOutgoing) {
    const outgoingAgg = await prisma.despachoItem.aggregate({
      where: {
        supplierItemId,
        despacho: {
          warehouseId,
          companyId,
          estado: {
            in: [DespachoStatus.EN_PREPARACION, DespachoStatus.LISTO_DESPACHO],
          },
        },
      },
      _sum: {
        cantidadDespachada: true,
      },
    });

    outgoing = decimalToNumber(outgoingAgg._sum.cantidadDespachada);
  }

  const available = Math.max(0, onHand - reserved);
  const projected = available + incoming - outgoing;

  const reorderPoint = puntoReposicion ?? stockMinimo;

  return {
    supplierItemId,
    warehouseId,
    warehouseName: stockLocation?.warehouse?.nombre,
    itemName: stockLocation?.supplierItem?.nombre,
    itemCode: stockLocation?.supplierItem?.codigoProveedor,
    unit: stockLocation?.supplierItem?.unidad,
    onHand,
    reserved,
    available,
    incoming,
    outgoing,
    projected,
    stockMinimo,
    stockMaximo,
    puntoReposicion,
    belowMinimum: stockMinimo !== undefined ? onHand < stockMinimo : false,
    belowReorderPoint: reorderPoint !== undefined ? onHand < reorderPoint : false,
  };
}

/**
 * Get availability for multiple items (bulk query - more efficient)
 */
export async function getBulkAvailability(
  params: BulkAvailabilityParams
): Promise<Map<string, StockAvailability>> {
  const {
    supplierItemIds,
    warehouseId,
    companyId,
    includeItemDetails = true,
    includeIncoming = true,
    includeOutgoing = true,
  } = params;

  const results = new Map<string, StockAvailability>();

  if (supplierItemIds.length === 0) {
    return results;
  }

  // Build warehouse filter
  const warehouseFilter = warehouseId ? { warehouseId } : {};

  // Get all stock locations
  const stockLocations = await prisma.stockLocation.findMany({
    where: {
      supplierItemId: { in: supplierItemIds },
      companyId,
      ...warehouseFilter,
    },
    include: {
      warehouse: includeItemDetails,
      supplierItem: includeItemDetails ? {
        select: {
          id: true,
          nombre: true,
          codigoProveedor: true,
          unidad: true,
        },
      } : false,
    },
  });

  // Get all active reservations grouped by item+warehouse
  const reservations = await prisma.stockReservation.groupBy({
    by: ['supplierItemId', 'warehouseId'],
    where: {
      supplierItemId: { in: supplierItemIds },
      companyId,
      estado: {
        in: [StockReservationStatus.ACTIVA, StockReservationStatus.CONSUMIDA_PARCIAL],
      },
      ...warehouseFilter,
    },
    _sum: {
      cantidad: true,
      cantidadConsumida: true,
    },
  });

  // Build reservation lookup map
  const reservationMap = new Map<string, { reserved: number }>();
  for (const r of reservations) {
    const key = `${r.supplierItemId}-${r.warehouseId}`;
    const totalReserved = decimalToNumber(r._sum.cantidad);
    const totalConsumed = decimalToNumber(r._sum.cantidadConsumida);
    reservationMap.set(key, { reserved: totalReserved - totalConsumed });
  }

  // Get incoming if requested
  const incomingMap = new Map<string, number>();
  if (includeIncoming) {
    // This is more complex because PO items don't have warehouse directly
    // We need to join through PurchaseOrder
    const incomingItems = await prisma.purchaseOrderItem.groupBy({
      by: ['supplierItemId'],
      where: {
        supplierItemId: { in: supplierItemIds },
        purchaseOrder: {
          companyId,
          status: {
            in: [
              PurchaseOrderStatus.APROBADA,
              PurchaseOrderStatus.ENVIADA_PROVEEDOR,
              PurchaseOrderStatus.CONFIRMADA,
              PurchaseOrderStatus.PARCIALMENTE_RECIBIDA,
            ],
          },
          ...(warehouseId ? {
            OR: [
              { warehouseId },
              { warehouseId: null },
            ],
          } : {}),
        },
      },
      _sum: {
        cantidad: true,
        cantidadRecibida: true,
      },
    });

    for (const item of incomingItems) {
      const orderedQty = decimalToNumber(item._sum.cantidad);
      const receivedQty = decimalToNumber(item._sum.cantidadRecibida);
      // Note: For bulk, we aggregate across warehouses if no specific warehouse
      incomingMap.set(String(item.supplierItemId), orderedQty - receivedQty);
    }
  }

  // Get outgoing if requested
  const outgoingMap = new Map<string, number>();
  if (includeOutgoing) {
    const outgoingItems = await prisma.despachoItem.groupBy({
      by: ['supplierItemId'],
      where: {
        supplierItemId: { in: supplierItemIds },
        despacho: {
          companyId,
          estado: {
            in: [DespachoStatus.EN_PREPARACION, DespachoStatus.LISTO_DESPACHO],
          },
          ...warehouseFilter,
        },
      },
      _sum: {
        cantidadDespachada: true,
      },
    });

    for (const item of outgoingItems) {
      const key = String(item.supplierItemId);
      outgoingMap.set(key, decimalToNumber(item._sum.cantidadDespachada));
    }
  }

  // Build results
  for (const loc of stockLocations) {
    const key = `${loc.supplierItemId}-${loc.warehouseId}`;
    const onHand = decimalToNumber(loc.cantidad);
    const stockMinimo = decimalToNumber(loc.stockMinimo);
    const stockMaximo = decimalToNumber(loc.stockMaximo);
    const puntoReposicion = decimalToNumber(loc.puntoReposicion);

    const reservationData = reservationMap.get(key);
    const reserved = reservationData?.reserved ?? 0;
    const incoming = incomingMap.get(String(loc.supplierItemId)) ?? 0;
    const outgoing = outgoingMap.get(String(loc.supplierItemId)) ?? 0;

    const available = Math.max(0, onHand - reserved);
    const projected = available + incoming - outgoing;
    const reorderPoint = puntoReposicion || stockMinimo;

    results.set(key, {
      supplierItemId: loc.supplierItemId,
      warehouseId: loc.warehouseId,
      warehouseName: loc.warehouse?.nombre,
      itemName: loc.supplierItem?.nombre,
      itemCode: loc.supplierItem?.codigoProveedor,
      unit: loc.supplierItem?.unidad,
      onHand,
      reserved,
      available,
      incoming,
      outgoing,
      projected,
      stockMinimo: stockMinimo || undefined,
      stockMaximo: stockMaximo || undefined,
      puntoReposicion: puntoReposicion || undefined,
      belowMinimum: stockMinimo ? onHand < stockMinimo : false,
      belowReorderPoint: reorderPoint ? onHand < reorderPoint : false,
    });
  }

  return results;
}

/**
 * Get all availability for a company (paginated)
 */
export async function getCompanyAvailability(
  companyId: number,
  options: {
    warehouseId?: number;
    search?: string;
    onlyBelowMinimum?: boolean;
    onlyBelowReorder?: boolean;
    page?: number;
    pageSize?: number;
  } = {}
): Promise<{
  items: StockAvailability[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}> {
  const {
    warehouseId,
    search,
    onlyBelowMinimum = false,
    onlyBelowReorder = false,
    page = 1,
    pageSize = 50,
  } = options;

  // Build where clause
  const where: any = { companyId };
  if (warehouseId) {
    where.warehouseId = warehouseId;
  }
  if (search) {
    where.OR = [
      { supplierItem: { nombre: { contains: search, mode: 'insensitive' } } },
      { supplierItem: { codigoProveedor: { contains: search, mode: 'insensitive' } } },
      { codigoPropio: { contains: search, mode: 'insensitive' } },
      { codigoProveedor: { contains: search, mode: 'insensitive' } },
    ];
  }

  // Get total count
  const total = await prisma.stockLocation.count({ where });

  // Get paginated stock locations
  const stockLocations = await prisma.stockLocation.findMany({
    where,
    include: {
      warehouse: true,
      supplierItem: {
        select: {
          id: true,
          nombre: true,
          codigoProveedor: true,
          unidad: true,
        },
      },
    },
    orderBy: [
      { supplierItem: { nombre: 'asc' } },
      { warehouse: { nombre: 'asc' } },
    ],
    skip: (page - 1) * pageSize,
    take: pageSize,
  });

  const supplierItemIds = stockLocations.map(sl => sl.supplierItemId);
  const warehouseIds = stockLocations.map(sl => sl.warehouseId);

  // Get reservations for these items
  const reservations = await prisma.stockReservation.groupBy({
    by: ['supplierItemId', 'warehouseId'],
    where: {
      supplierItemId: { in: supplierItemIds },
      warehouseId: { in: warehouseIds },
      companyId,
      estado: {
        in: [StockReservationStatus.ACTIVA, StockReservationStatus.CONSUMIDA_PARCIAL],
      },
    },
    _sum: {
      cantidad: true,
      cantidadConsumida: true,
    },
  });

  const reservationMap = new Map<string, number>();
  for (const r of reservations) {
    const key = `${r.supplierItemId}-${r.warehouseId}`;
    const totalReserved = decimalToNumber(r._sum.cantidad);
    const totalConsumed = decimalToNumber(r._sum.cantidadConsumida);
    reservationMap.set(key, totalReserved - totalConsumed);
  }

  // Build availability items
  let items: StockAvailability[] = stockLocations.map(loc => {
    const key = `${loc.supplierItemId}-${loc.warehouseId}`;
    const onHand = decimalToNumber(loc.cantidad);
    const stockMinimo = decimalToNumber(loc.stockMinimo);
    const stockMaximo = decimalToNumber(loc.stockMaximo);
    const puntoReposicion = decimalToNumber(loc.puntoReposicion);
    const reserved = reservationMap.get(key) ?? 0;
    const available = Math.max(0, onHand - reserved);
    const reorderPoint = puntoReposicion || stockMinimo;

    return {
      supplierItemId: loc.supplierItemId,
      warehouseId: loc.warehouseId,
      warehouseName: loc.warehouse?.nombre,
      itemName: loc.supplierItem?.nombre,
      itemCode: loc.supplierItem?.codigoProveedor,
      unit: loc.supplierItem?.unidad,
      onHand,
      reserved,
      available,
      incoming: 0, // Not calculated for list view (performance)
      outgoing: 0,
      projected: available,
      stockMinimo: stockMinimo || undefined,
      stockMaximo: stockMaximo || undefined,
      puntoReposicion: puntoReposicion || undefined,
      belowMinimum: stockMinimo ? onHand < stockMinimo : false,
      belowReorderPoint: reorderPoint ? onHand < reorderPoint : false,
    };
  });

  // Apply filters
  if (onlyBelowMinimum) {
    items = items.filter(item => item.belowMinimum);
  }
  if (onlyBelowReorder) {
    items = items.filter(item => item.belowReorderPoint);
  }

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

// ============================================================================
// Availability Checks
// ============================================================================

/**
 * Check if a specific quantity is available
 */
export async function checkAvailability(
  supplierItemId: number,
  warehouseId: number,
  companyId: number,
  requestedQuantity: number
): Promise<AvailabilityCheckResult> {
  const availability = await getAvailability(
    supplierItemId,
    warehouseId,
    companyId,
    { includeIncoming: false, includeOutgoing: false }
  );

  const isAvailable = availability.available >= requestedQuantity;
  const shortfall = Math.max(0, requestedQuantity - availability.available);

  let message: string;
  if (isAvailable) {
    message = `Stock disponible: ${availability.available} ${availability.unit || 'unidades'}`;
  } else {
    message = `Stock insuficiente. Disponible: ${availability.available}, Solicitado: ${requestedQuantity}, Faltante: ${shortfall}`;
  }

  return {
    isAvailable,
    requestedQuantity,
    availableQuantity: availability.available,
    shortfall,
    message,
  };
}

/**
 * Check availability for multiple items at once
 */
export async function checkBulkAvailability(
  items: Array<{
    supplierItemId: number;
    warehouseId: number;
    requestedQuantity: number;
  }>,
  companyId: number
): Promise<{
  allAvailable: boolean;
  results: Array<AvailabilityCheckResult & { supplierItemId: number; warehouseId: number }>;
}> {
  const supplierItemIds = [...new Set(items.map(i => i.supplierItemId))];
  const warehouseIds = [...new Set(items.map(i => i.warehouseId))];

  // Get all stock locations for these items
  const stockLocations = await prisma.stockLocation.findMany({
    where: {
      supplierItemId: { in: supplierItemIds },
      warehouseId: { in: warehouseIds },
      companyId,
    },
    include: {
      supplierItem: {
        select: { unidad: true },
      },
    },
  });

  // Get reservations
  const reservations = await prisma.stockReservation.groupBy({
    by: ['supplierItemId', 'warehouseId'],
    where: {
      supplierItemId: { in: supplierItemIds },
      warehouseId: { in: warehouseIds },
      companyId,
      estado: {
        in: [StockReservationStatus.ACTIVA, StockReservationStatus.CONSUMIDA_PARCIAL],
      },
    },
    _sum: {
      cantidad: true,
      cantidadConsumida: true,
    },
  });

  // Build lookup maps
  const stockMap = new Map<string, { onHand: number; unit?: string }>();
  for (const loc of stockLocations) {
    const key = `${loc.supplierItemId}-${loc.warehouseId}`;
    stockMap.set(key, {
      onHand: decimalToNumber(loc.cantidad),
      unit: loc.supplierItem?.unidad,
    });
  }

  const reservationMap = new Map<string, number>();
  for (const r of reservations) {
    const key = `${r.supplierItemId}-${r.warehouseId}`;
    const totalReserved = decimalToNumber(r._sum.cantidad);
    const totalConsumed = decimalToNumber(r._sum.cantidadConsumida);
    reservationMap.set(key, totalReserved - totalConsumed);
  }

  // Check each item
  const results = items.map(item => {
    const key = `${item.supplierItemId}-${item.warehouseId}`;
    const stockData = stockMap.get(key);
    const onHand = stockData?.onHand ?? 0;
    const reserved = reservationMap.get(key) ?? 0;
    const available = Math.max(0, onHand - reserved);
    const isAvailable = available >= item.requestedQuantity;
    const shortfall = Math.max(0, item.requestedQuantity - available);

    let message: string;
    if (isAvailable) {
      message = `Stock disponible: ${available} ${stockData?.unit || 'unidades'}`;
    } else {
      message = `Stock insuficiente. Disponible: ${available}, Solicitado: ${item.requestedQuantity}, Faltante: ${shortfall}`;
    }

    return {
      supplierItemId: item.supplierItemId,
      warehouseId: item.warehouseId,
      isAvailable,
      requestedQuantity: item.requestedQuantity,
      availableQuantity: available,
      shortfall,
      message,
    };
  });

  return {
    allAvailable: results.every(r => r.isAvailable),
    results,
  };
}

// ============================================================================
// Warehouse Summary
// ============================================================================

export interface WarehouseStockSummary {
  warehouseId: number;
  warehouseName: string;
  totalItems: number;
  totalValue: number;
  itemsBelowMinimum: number;
  itemsBelowReorder: number;
  totalReserved: number;
}

/**
 * Get stock summary by warehouse
 */
export async function getWarehouseStockSummary(
  companyId: number,
  warehouseId?: number
): Promise<WarehouseStockSummary[]> {
  const where: any = { companyId };
  if (warehouseId) {
    where.warehouseId = warehouseId;
  }

  // Get warehouses with stock aggregations
  const warehouses = await prisma.warehouse.findMany({
    where: {
      companyId,
      ...(warehouseId ? { id: warehouseId } : {}),
    },
    include: {
      _count: {
        select: { stockLocations: true },
      },
    },
  });

  const results: WarehouseStockSummary[] = [];

  for (const warehouse of warehouses) {
    // Get stock locations for this warehouse
    const stockLocations = await prisma.stockLocation.findMany({
      where: {
        warehouseId: warehouse.id,
        companyId,
      },
      select: {
        cantidad: true,
        costoUnitario: true,
        stockMinimo: true,
        puntoReposicion: true,
      },
    });

    // Get total reserved for this warehouse
    const reservationsAgg = await prisma.stockReservation.aggregate({
      where: {
        warehouseId: warehouse.id,
        companyId,
        estado: {
          in: [StockReservationStatus.ACTIVA, StockReservationStatus.CONSUMIDA_PARCIAL],
        },
      },
      _sum: {
        cantidad: true,
        cantidadConsumida: true,
      },
    });

    const totalReserved = decimalToNumber(reservationsAgg._sum.cantidad) -
      decimalToNumber(reservationsAgg._sum.cantidadConsumida);

    // Calculate summaries
    let totalValue = 0;
    let itemsBelowMinimum = 0;
    let itemsBelowReorder = 0;

    for (const loc of stockLocations) {
      const qty = decimalToNumber(loc.cantidad);
      const cost = decimalToNumber(loc.costoUnitario);
      const minimo = decimalToNumber(loc.stockMinimo);
      const reorder = decimalToNumber(loc.puntoReposicion) || minimo;

      totalValue += qty * cost;
      if (minimo && qty < minimo) itemsBelowMinimum++;
      if (reorder && qty < reorder) itemsBelowReorder++;
    }

    results.push({
      warehouseId: warehouse.id,
      warehouseName: warehouse.nombre,
      totalItems: warehouse._count.stockLocations,
      totalValue,
      itemsBelowMinimum,
      itemsBelowReorder,
      totalReserved,
    });
  }

  return results;
}
