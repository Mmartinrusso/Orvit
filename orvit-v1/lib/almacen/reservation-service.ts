/**
 * Reservation Service
 *
 * Manages stock reservations for:
 * - Material requests (solicitudes de material)
 * - Production orders (órdenes de producción)
 * - Work orders (órdenes de trabajo de mantenimiento)
 * - Manual reservations
 *
 * Key concepts:
 * - Reserved stock is blocked from availability but still physically present (OnHand)
 * - Reservations are consumed when items are actually dispatched
 * - Reservations can be partially consumed
 * - Expired reservations are auto-released
 */

import { prisma } from '@/lib/prisma';
import { Decimal } from '@prisma/client/runtime/library';
import {
  StockReservationStatus,
  StockReservationType,
  Prisma,
} from '@prisma/client';
import { checkAvailability } from './stock-availability';

// ============================================================================
// Types
// ============================================================================

export interface CreateReservationParams {
  supplierItemId: number;
  warehouseId: number;
  cantidad: number;
  tipo: StockReservationType;
  materialRequestId?: number;
  productionOrderId?: number;
  workOrderId?: number;
  motivo?: string;
  fechaExpiracion?: Date;
  companyId: number;
  createdBy: number;
}

export interface ConsumeReservationParams {
  reservationId: number;
  cantidad: number;
  updatedBy: number;
}

export interface ReservationResult {
  success: boolean;
  reservation?: {
    id: number;
    supplierItemId: number;
    warehouseId: number;
    cantidad: number;
    cantidadConsumida: number;
    estado: StockReservationStatus;
    tipo: StockReservationType;
  };
  error?: string;
  shortfall?: number;
}

export interface BulkReservationParams {
  items: Array<{
    supplierItemId: number;
    warehouseId: number;
    cantidad: number;
  }>;
  tipo: StockReservationType;
  materialRequestId?: number;
  productionOrderId?: number;
  workOrderId?: number;
  motivo?: string;
  fechaExpiracion?: Date;
  companyId: number;
  createdBy: number;
  allowPartial?: boolean; // If true, create reservations even if not all items available
}

export interface BulkReservationResult {
  success: boolean;
  allAvailable: boolean;
  reservations: ReservationResult[];
  totalRequested: number;
  totalReserved: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

function decimalToNumber(value: Decimal | null | undefined): number {
  if (value === null || value === undefined) return 0;
  return Number(value);
}

// ============================================================================
// Create Reservations
// ============================================================================

/**
 * Create a single stock reservation
 */
export async function createReservation(
  params: CreateReservationParams
): Promise<ReservationResult> {
  const {
    supplierItemId,
    warehouseId,
    cantidad,
    tipo,
    materialRequestId,
    productionOrderId,
    workOrderId,
    motivo,
    fechaExpiracion,
    companyId,
    createdBy,
  } = params;

  // Check availability first
  const availability = await checkAvailability(
    supplierItemId,
    warehouseId,
    companyId,
    cantidad
  );

  if (!availability.isAvailable) {
    return {
      success: false,
      error: availability.message,
      shortfall: availability.shortfall,
    };
  }

  // Create reservation
  const reservation = await prisma.stockReservation.create({
    data: {
      supplierItemId,
      warehouseId,
      cantidad: new Decimal(cantidad),
      cantidadConsumida: new Decimal(0),
      estado: StockReservationStatus.ACTIVA,
      tipo,
      materialRequestId,
      productionOrderId,
      workOrderId,
      motivo,
      fechaExpiracion,
      companyId,
      createdBy,
    },
    select: {
      id: true,
      supplierItemId: true,
      warehouseId: true,
      cantidad: true,
      cantidadConsumida: true,
      estado: true,
      tipo: true,
    },
  });

  return {
    success: true,
    reservation: {
      ...reservation,
      cantidad: decimalToNumber(reservation.cantidad),
      cantidadConsumida: decimalToNumber(reservation.cantidadConsumida),
    },
  };
}

/**
 * Create multiple reservations in a transaction
 * Useful when approving a material request with multiple items
 */
export async function createBulkReservations(
  params: BulkReservationParams
): Promise<BulkReservationResult> {
  const {
    items,
    tipo,
    materialRequestId,
    productionOrderId,
    workOrderId,
    motivo,
    fechaExpiracion,
    companyId,
    createdBy,
    allowPartial = false,
  } = params;

  // Check availability for all items first
  const availabilityResults = await Promise.all(
    items.map(item =>
      checkAvailability(item.supplierItemId, item.warehouseId, companyId, item.cantidad)
    )
  );

  const allAvailable = availabilityResults.every(r => r.isAvailable);

  // If not allowing partial and not all available, return error
  if (!allowPartial && !allAvailable) {
    const unavailableItems = availabilityResults
      .map((r, i) => ({ ...r, item: items[i] }))
      .filter(r => !r.isAvailable);

    return {
      success: false,
      allAvailable: false,
      reservations: unavailableItems.map(r => ({
        success: false,
        error: r.message,
        shortfall: r.shortfall,
      })),
      totalRequested: items.reduce((sum, i) => sum + i.cantidad, 0),
      totalReserved: 0,
    };
  }

  // Create reservations in transaction
  const results = await prisma.$transaction(async (tx) => {
    const reservationResults: ReservationResult[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const availability = availabilityResults[i];

      if (!availability.isAvailable && !allowPartial) {
        reservationResults.push({
          success: false,
          error: availability.message,
          shortfall: availability.shortfall,
        });
        continue;
      }

      // Determine quantity to reserve (full or partial)
      const qtyToReserve = availability.isAvailable
        ? item.cantidad
        : availability.availableQuantity;

      if (qtyToReserve <= 0) {
        reservationResults.push({
          success: false,
          error: 'No hay stock disponible para reservar',
          shortfall: item.cantidad,
        });
        continue;
      }

      const reservation = await tx.stockReservation.create({
        data: {
          supplierItemId: item.supplierItemId,
          warehouseId: item.warehouseId,
          cantidad: new Decimal(qtyToReserve),
          cantidadConsumida: new Decimal(0),
          estado: StockReservationStatus.ACTIVA,
          tipo,
          materialRequestId,
          productionOrderId,
          workOrderId,
          motivo,
          fechaExpiracion,
          companyId,
          createdBy,
        },
        select: {
          id: true,
          supplierItemId: true,
          warehouseId: true,
          cantidad: true,
          cantidadConsumida: true,
          estado: true,
          tipo: true,
        },
      });

      reservationResults.push({
        success: true,
        reservation: {
          ...reservation,
          cantidad: decimalToNumber(reservation.cantidad),
          cantidadConsumida: decimalToNumber(reservation.cantidadConsumida),
        },
      });
    }

    return reservationResults;
  });

  const totalReserved = results
    .filter(r => r.success)
    .reduce((sum, r) => sum + (r.reservation?.cantidad ?? 0), 0);

  return {
    success: results.some(r => r.success),
    allAvailable,
    reservations: results,
    totalRequested: items.reduce((sum, i) => sum + i.cantidad, 0),
    totalReserved,
  };
}

// ============================================================================
// Consume Reservations
// ============================================================================

/**
 * Consume a reservation (when dispatching stock)
 * Updates cantidadConsumida and changes estado if fully consumed
 */
export async function consumeReservation(
  params: ConsumeReservationParams
): Promise<ReservationResult> {
  const { reservationId, cantidad, updatedBy } = params;

  // Get current reservation
  const reservation = await prisma.stockReservation.findUnique({
    where: { id: reservationId },
  });

  if (!reservation) {
    return {
      success: false,
      error: 'Reserva no encontrada',
    };
  }

  if (reservation.estado === StockReservationStatus.CONSUMIDA) {
    return {
      success: false,
      error: 'La reserva ya fue completamente consumida',
    };
  }

  if (reservation.estado === StockReservationStatus.LIBERADA) {
    return {
      success: false,
      error: 'La reserva fue liberada y no puede consumirse',
    };
  }

  if (reservation.estado === StockReservationStatus.EXPIRADA) {
    return {
      success: false,
      error: 'La reserva expiró y no puede consumirse',
    };
  }

  const currentConsumed = decimalToNumber(reservation.cantidadConsumida);
  const totalReserved = decimalToNumber(reservation.cantidad);
  const available = totalReserved - currentConsumed;

  if (cantidad > available) {
    return {
      success: false,
      error: `Cantidad a consumir (${cantidad}) excede lo disponible en la reserva (${available})`,
      shortfall: cantidad - available,
    };
  }

  const newConsumed = currentConsumed + cantidad;
  const isFullyConsumed = newConsumed >= totalReserved;

  const updated = await prisma.stockReservation.update({
    where: { id: reservationId },
    data: {
      cantidadConsumida: new Decimal(newConsumed),
      estado: isFullyConsumed
        ? StockReservationStatus.CONSUMIDA
        : StockReservationStatus.CONSUMIDA_PARCIAL,
    },
    select: {
      id: true,
      supplierItemId: true,
      warehouseId: true,
      cantidad: true,
      cantidadConsumida: true,
      estado: true,
      tipo: true,
    },
  });

  return {
    success: true,
    reservation: {
      ...updated,
      cantidad: decimalToNumber(updated.cantidad),
      cantidadConsumida: decimalToNumber(updated.cantidadConsumida),
    },
  };
}

/**
 * Consume multiple reservations for a dispatch
 */
export async function consumeReservationsForDispatch(
  items: Array<{
    reservationId: number;
    cantidad: number;
  }>,
  updatedBy: number
): Promise<{
  success: boolean;
  results: ReservationResult[];
  errors: string[];
}> {
  const errors: string[] = [];
  const results: ReservationResult[] = [];

  await prisma.$transaction(async (tx) => {
    for (const item of items) {
      const reservation = await tx.stockReservation.findUnique({
        where: { id: item.reservationId },
      });

      if (!reservation) {
        errors.push(`Reserva ${item.reservationId} no encontrada`);
        results.push({ success: false, error: 'Reserva no encontrada' });
        continue;
      }

      const currentConsumed = decimalToNumber(reservation.cantidadConsumida);
      const totalReserved = decimalToNumber(reservation.cantidad);
      const available = totalReserved - currentConsumed;

      if (item.cantidad > available) {
        errors.push(
          `Reserva ${item.reservationId}: cantidad a consumir excede disponible`
        );
        results.push({
          success: false,
          error: 'Cantidad excede disponible',
          shortfall: item.cantidad - available,
        });
        continue;
      }

      const newConsumed = currentConsumed + item.cantidad;
      const isFullyConsumed = newConsumed >= totalReserved;

      const updated = await tx.stockReservation.update({
        where: { id: item.reservationId },
        data: {
          cantidadConsumida: new Decimal(newConsumed),
          estado: isFullyConsumed
            ? StockReservationStatus.CONSUMIDA
            : StockReservationStatus.CONSUMIDA_PARCIAL,
        },
        select: {
          id: true,
          supplierItemId: true,
          warehouseId: true,
          cantidad: true,
          cantidadConsumida: true,
          estado: true,
          tipo: true,
        },
      });

      results.push({
        success: true,
        reservation: {
          ...updated,
          cantidad: decimalToNumber(updated.cantidad),
          cantidadConsumida: decimalToNumber(updated.cantidadConsumida),
        },
      });
    }
  });

  return {
    success: errors.length === 0,
    results,
    errors,
  };
}

// ============================================================================
// Release Reservations
// ============================================================================

/**
 * Release a reservation (makes stock available again)
 * Used when a material request is cancelled or an order is closed
 */
export async function releaseReservation(
  reservationId: number,
  motivo?: string
): Promise<ReservationResult> {
  const reservation = await prisma.stockReservation.findUnique({
    where: { id: reservationId },
  });

  if (!reservation) {
    return {
      success: false,
      error: 'Reserva no encontrada',
    };
  }

  if (reservation.estado === StockReservationStatus.CONSUMIDA) {
    return {
      success: false,
      error: 'La reserva ya fue completamente consumida y no puede liberarse',
    };
  }

  if (reservation.estado === StockReservationStatus.LIBERADA) {
    return {
      success: false,
      error: 'La reserva ya fue liberada',
    };
  }

  const updated = await prisma.stockReservation.update({
    where: { id: reservationId },
    data: {
      estado: StockReservationStatus.LIBERADA,
      motivo: motivo ? `${reservation.motivo || ''} | Liberada: ${motivo}` : reservation.motivo,
    },
    select: {
      id: true,
      supplierItemId: true,
      warehouseId: true,
      cantidad: true,
      cantidadConsumida: true,
      estado: true,
      tipo: true,
    },
  });

  return {
    success: true,
    reservation: {
      ...updated,
      cantidad: decimalToNumber(updated.cantidad),
      cantidadConsumida: decimalToNumber(updated.cantidadConsumida),
    },
  };
}

/**
 * Release all reservations for a material request
 */
export async function releaseReservationsForMaterialRequest(
  materialRequestId: number,
  motivo?: string
): Promise<{ released: number; errors: string[] }> {
  const reservations = await prisma.stockReservation.findMany({
    where: {
      materialRequestId,
      estado: {
        in: [StockReservationStatus.ACTIVA, StockReservationStatus.CONSUMIDA_PARCIAL],
      },
    },
  });

  let released = 0;
  const errors: string[] = [];

  for (const reservation of reservations) {
    const result = await releaseReservation(reservation.id, motivo);
    if (result.success) {
      released++;
    } else {
      errors.push(`Reserva ${reservation.id}: ${result.error}`);
    }
  }

  return { released, errors };
}

/**
 * Release all reservations for a production order
 */
export async function releaseReservationsForProductionOrder(
  productionOrderId: number,
  motivo?: string
): Promise<{ released: number; errors: string[] }> {
  const reservations = await prisma.stockReservation.findMany({
    where: {
      productionOrderId,
      estado: {
        in: [StockReservationStatus.ACTIVA, StockReservationStatus.CONSUMIDA_PARCIAL],
      },
    },
  });

  let released = 0;
  const errors: string[] = [];

  for (const reservation of reservations) {
    const result = await releaseReservation(reservation.id, motivo);
    if (result.success) {
      released++;
    } else {
      errors.push(`Reserva ${reservation.id}: ${result.error}`);
    }
  }

  return { released, errors };
}

/**
 * Release all reservations for a work order
 */
export async function releaseReservationsForWorkOrder(
  workOrderId: number,
  motivo?: string
): Promise<{ released: number; errors: string[] }> {
  const reservations = await prisma.stockReservation.findMany({
    where: {
      workOrderId,
      estado: {
        in: [StockReservationStatus.ACTIVA, StockReservationStatus.CONSUMIDA_PARCIAL],
      },
    },
  });

  let released = 0;
  const errors: string[] = [];

  for (const reservation of reservations) {
    const result = await releaseReservation(reservation.id, motivo);
    if (result.success) {
      released++;
    } else {
      errors.push(`Reserva ${reservation.id}: ${result.error}`);
    }
  }

  return { released, errors };
}

// ============================================================================
// Expiration
// ============================================================================

/**
 * Expire reservations that have passed their expiration date
 * This should be called by a scheduled job (e.g., daily cron)
 */
export async function expireReservations(): Promise<{
  expired: number;
  errors: string[];
}> {
  const now = new Date();

  const expiredReservations = await prisma.stockReservation.findMany({
    where: {
      fechaExpiracion: { lte: now },
      estado: {
        in: [StockReservationStatus.ACTIVA, StockReservationStatus.CONSUMIDA_PARCIAL],
      },
    },
  });

  let expired = 0;
  const errors: string[] = [];

  for (const reservation of expiredReservations) {
    try {
      await prisma.stockReservation.update({
        where: { id: reservation.id },
        data: {
          estado: StockReservationStatus.EXPIRADA,
          motivo: `${reservation.motivo || ''} | Auto-expirada el ${now.toISOString()}`,
        },
      });
      expired++;
    } catch (error) {
      errors.push(`Reserva ${reservation.id}: Error al expirar`);
    }
  }

  return { expired, errors };
}

// ============================================================================
// Queries
// ============================================================================

/**
 * Get reservations for a specific item/warehouse
 */
export async function getReservationsForItem(
  supplierItemId: number,
  warehouseId: number,
  companyId: number,
  options: {
    includeConsumed?: boolean;
    includeReleased?: boolean;
    includeExpired?: boolean;
  } = {}
) {
  const {
    includeConsumed = false,
    includeReleased = false,
    includeExpired = false,
  } = options;

  const statusFilter: StockReservationStatus[] = [
    StockReservationStatus.ACTIVA,
    StockReservationStatus.CONSUMIDA_PARCIAL,
  ];

  if (includeConsumed) statusFilter.push(StockReservationStatus.CONSUMIDA);
  if (includeReleased) statusFilter.push(StockReservationStatus.LIBERADA);
  if (includeExpired) statusFilter.push(StockReservationStatus.EXPIRADA);

  return prisma.stockReservation.findMany({
    where: {
      supplierItemId,
      warehouseId,
      companyId,
      estado: { in: statusFilter },
    },
    include: {
      materialRequest: {
        select: { id: true, numero: true },
      },
      productionOrder: {
        select: { id: true, code: true },
      },
      workOrder: {
        select: { id: true, title: true },
      },
      createdByUser: {
        select: { id: true, name: true },
      },
    },
    orderBy: { fechaReserva: 'desc' },
  });
}

/**
 * Get active reservations for a material request
 */
export async function getReservationsForMaterialRequest(
  materialRequestId: number
) {
  return prisma.stockReservation.findMany({
    where: {
      materialRequestId,
    },
    include: {
      supplierItem: {
        select: { id: true, nombre: true, codigoProveedor: true, unidad: true },
      },
      warehouse: {
        select: { id: true, nombre: true },
      },
    },
    orderBy: { fechaReserva: 'desc' },
  });
}

/**
 * Get active reservations for a production order
 */
export async function getReservationsForProductionOrder(
  productionOrderId: number
) {
  return prisma.stockReservation.findMany({
    where: {
      productionOrderId,
    },
    include: {
      supplierItem: {
        select: { id: true, nombre: true, codigoProveedor: true, unidad: true },
      },
      warehouse: {
        select: { id: true, nombre: true },
      },
    },
    orderBy: { fechaReserva: 'desc' },
  });
}

/**
 * Get summary of reservations by type
 */
export async function getReservationsSummary(
  companyId: number,
  warehouseId?: number
) {
  const where: Prisma.StockReservationWhereInput = {
    companyId,
    estado: {
      in: [StockReservationStatus.ACTIVA, StockReservationStatus.CONSUMIDA_PARCIAL],
    },
  };

  if (warehouseId) {
    where.warehouseId = warehouseId;
  }

  const reservations = await prisma.stockReservation.groupBy({
    by: ['tipo'],
    where,
    _sum: {
      cantidad: true,
      cantidadConsumida: true,
    },
    _count: true,
  });

  return reservations.map(r => ({
    tipo: r.tipo,
    count: r._count,
    totalReservado: decimalToNumber(r._sum.cantidad),
    totalConsumido: decimalToNumber(r._sum.cantidadConsumida),
    pendiente: decimalToNumber(r._sum.cantidad) - decimalToNumber(r._sum.cantidadConsumida),
  }));
}
