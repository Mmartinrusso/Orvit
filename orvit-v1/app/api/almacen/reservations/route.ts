import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  createReservation,
  createBulkReservations,
  releaseReservation,
  getReservationsSummary,
} from '@/lib/almacen/reservation-service';
import { StockReservationStatus, StockReservationType } from '@prisma/client';

/**
 * GET /api/almacen/reservations
 *
 * Query params:
 * - companyId: number (required)
 * - warehouseId: number (optional)
 * - supplierItemId: number (optional)
 * - materialRequestId: number (optional)
 * - productionOrderId: number (optional)
 * - workOrderId: number (optional)
 * - estado: string (optional) - Filter by status
 * - summary: boolean (optional) - Return summary instead of list
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const companyId = Number(searchParams.get('companyId'));
    if (!companyId || isNaN(companyId)) {
      return NextResponse.json(
        { error: 'companyId es requerido' },
        { status: 400 }
      );
    }

    // If summary requested
    if (searchParams.get('summary') === 'true') {
      const warehouseId = searchParams.get('warehouseId');
      const summary = await getReservationsSummary(
        companyId,
        warehouseId ? Number(warehouseId) : undefined
      );
      return NextResponse.json({ summary });
    }

    // Build where clause
    const where: any = { companyId };

    const warehouseId = searchParams.get('warehouseId');
    if (warehouseId) where.warehouseId = Number(warehouseId);

    const supplierItemId = searchParams.get('supplierItemId');
    if (supplierItemId) where.supplierItemId = Number(supplierItemId);

    const materialRequestId = searchParams.get('materialRequestId');
    if (materialRequestId) where.materialRequestId = Number(materialRequestId);

    const productionOrderId = searchParams.get('productionOrderId');
    if (productionOrderId) where.productionOrderId = Number(productionOrderId);

    const workOrderId = searchParams.get('workOrderId');
    if (workOrderId) where.workOrderId = Number(workOrderId);

    const estado = searchParams.get('estado');
    if (estado) {
      where.estado = estado as StockReservationStatus;
    } else {
      // Default: only active reservations
      where.estado = {
        in: [StockReservationStatus.ACTIVA, StockReservationStatus.CONSUMIDA_PARCIAL],
      };
    }

    const reservations = await prisma.stockReservation.findMany({
      where,
      include: {
        supplierItem: {
          select: { id: true, nombre: true, codigoProveedor: true, unidad: true },
        },
        warehouse: {
          select: { id: true, nombre: true },
        },
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
      take: 100,
    });

    return NextResponse.json({ reservations });
  } catch (error) {
    console.error('Error en GET /api/almacen/reservations:', error);
    return NextResponse.json(
      { error: 'Error al obtener reservas' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/almacen/reservations
 *
 * Body:
 * - supplierItemId: number
 * - warehouseId: number
 * - cantidad: number
 * - tipo: StockReservationType
 * - materialRequestId?: number
 * - productionOrderId?: number
 * - workOrderId?: number
 * - motivo?: string
 * - fechaExpiracion?: string (ISO date)
 * - companyId: number
 * - createdBy: number
 *
 * Or for bulk:
 * - items: Array<{ supplierItemId, warehouseId, cantidad }>
 * - tipo: StockReservationType
 * - ... (same optional fields)
 * - allowPartial?: boolean
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
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
      // Bulk params
      items,
      allowPartial,
    } = body;

    if (!companyId || !createdBy || !tipo) {
      return NextResponse.json(
        { error: 'companyId, createdBy y tipo son requeridos' },
        { status: 400 }
      );
    }

    // Bulk reservation
    if (items && Array.isArray(items)) {
      const result = await createBulkReservations({
        items,
        tipo: tipo as StockReservationType,
        materialRequestId,
        productionOrderId,
        workOrderId,
        motivo,
        fechaExpiracion: fechaExpiracion ? new Date(fechaExpiracion) : undefined,
        companyId: Number(companyId),
        createdBy: Number(createdBy),
        allowPartial: allowPartial ?? false,
      });

      return NextResponse.json(result);
    }

    // Single reservation
    if (!supplierItemId || !warehouseId || !cantidad) {
      return NextResponse.json(
        { error: 'supplierItemId, warehouseId y cantidad son requeridos' },
        { status: 400 }
      );
    }

    const result = await createReservation({
      supplierItemId: Number(supplierItemId),
      warehouseId: Number(warehouseId),
      cantidad: Number(cantidad),
      tipo: tipo as StockReservationType,
      materialRequestId: materialRequestId ? Number(materialRequestId) : undefined,
      productionOrderId: productionOrderId ? Number(productionOrderId) : undefined,
      workOrderId: workOrderId ? Number(workOrderId) : undefined,
      motivo,
      fechaExpiracion: fechaExpiracion ? new Date(fechaExpiracion) : undefined,
      companyId: Number(companyId),
      createdBy: Number(createdBy),
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error, shortfall: result.shortfall },
        { status: 400 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error en POST /api/almacen/reservations:', error);
    return NextResponse.json(
      { error: 'Error al crear reserva' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/almacen/reservations
 *
 * Query params:
 * - id: number (required) - Reservation ID to release
 * - motivo: string (optional)
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json(
        { error: 'id es requerido' },
        { status: 400 }
      );
    }

    const motivo = searchParams.get('motivo') || undefined;

    const result = await releaseReservation(Number(id), motivo);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error en DELETE /api/almacen/reservations:', error);
    return NextResponse.json(
      { error: 'Error al liberar reserva' },
      { status: 500 }
    );
  }
}
