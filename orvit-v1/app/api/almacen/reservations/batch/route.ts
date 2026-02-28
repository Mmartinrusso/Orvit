import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { StockReservationStatus } from '@prisma/client';
import { requirePermission } from '@/lib/auth/shared-helpers';

export const dynamic = 'force-dynamic';

interface BatchResult {
  id: number;
  success: boolean;
  error?: string;
}

/**
 * POST /api/almacen/reservations/batch
 *
 * Realizar acciones masivas sobre reservas
 *
 * Body:
 * - ids: number[] (required) - IDs de las reservas
 * - action: string (required) - 'release' | 'expire'
 * - motivo: string (optional)
 * - companyId: number (required)
 */
export async function POST(request: NextRequest) {
  try {
    // Permission check: batch release requires almacen.reservation.release
    const { user, error: authError } = await requirePermission('almacen.reservation.release');
    if (authError) return authError;

    const body = await request.json();
    const { ids, action, motivo, companyId } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: 'ids es requerido y debe ser un array no vacío' },
        { status: 400 }
      );
    }

    if (!action) {
      return NextResponse.json(
        { error: 'action es requerido' },
        { status: 400 }
      );
    }

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId es requerido' },
        { status: 400 }
      );
    }

    const results: BatchResult[] = [];
    const errors: BatchResult[] = [];

    for (const id of ids) {
      try {
        const reservation = await prisma.stockReservation.findFirst({
          where: { id: Number(id), companyId: Number(companyId) },
          include: { supplierItem: true },
        });

        if (!reservation) {
          errors.push({ id, success: false, error: 'Reserva no encontrada' });
          continue;
        }

        switch (action) {
          case 'release': {
            // Solo se pueden liberar reservas activas o parcialmente consumidas
            if (
              reservation.estado !== StockReservationStatus.ACTIVA &&
              reservation.estado !== StockReservationStatus.CONSUMIDA_PARCIAL
            ) {
              errors.push({ id, success: false, error: 'Solo se pueden liberar reservas ACTIVA o CONSUMIDA_PARCIAL' });
              continue;
            }

            // Calcular cantidad a liberar
            const cantidadLiberar = reservation.cantidad - (reservation.cantidadConsumida || 0);

            if (cantidadLiberar <= 0) {
              errors.push({ id, success: false, error: 'No hay cantidad para liberar' });
              continue;
            }

            // Actualizar reserva a LIBERADA
            await prisma.$transaction([
              prisma.stockReservation.update({
                where: { id: Number(id) },
                data: {
                  estado: StockReservationStatus.LIBERADA,
                  fechaLiberacion: new Date(),
                  motivoLiberacion: motivo || 'Liberación masiva',
                },
              }),
              // Actualizar stock reservado en StockLocation
              prisma.stockLocation.updateMany({
                where: {
                  supplierItemId: reservation.supplierItemId,
                  warehouseId: reservation.warehouseId,
                },
                data: {
                  reservedQuantity: {
                    decrement: cantidadLiberar,
                  },
                },
              }),
            ]);

            results.push({ id, success: true });
            break;
          }

          case 'expire': {
            // Solo se pueden expirar reservas activas
            if (reservation.estado !== StockReservationStatus.ACTIVA) {
              errors.push({ id, success: false, error: 'Solo se pueden expirar reservas ACTIVA' });
              continue;
            }

            const cantidadLiberar = reservation.cantidad - (reservation.cantidadConsumida || 0);

            await prisma.$transaction([
              prisma.stockReservation.update({
                where: { id: Number(id) },
                data: {
                  estado: StockReservationStatus.EXPIRADA,
                  fechaLiberacion: new Date(),
                  motivoLiberacion: motivo || 'Expiración masiva',
                },
              }),
              prisma.stockLocation.updateMany({
                where: {
                  supplierItemId: reservation.supplierItemId,
                  warehouseId: reservation.warehouseId,
                },
                data: {
                  reservedQuantity: {
                    decrement: cantidadLiberar,
                  },
                },
              }),
            ]);

            results.push({ id, success: true });
            break;
          }

          default:
            errors.push({ id, success: false, error: 'Acción no válida' });
        }
      } catch (err) {
        errors.push({
          id,
          success: false,
          error: err instanceof Error ? err.message : 'Error desconocido',
        });
      }
    }

    return NextResponse.json({
      results,
      errors,
      total: ids.length,
      success: results.length,
      failed: errors.length,
    });
  } catch (error) {
    console.error('Error en POST /api/almacen/reservations/batch:', error);
    return NextResponse.json(
      { error: 'Error en acción masiva' },
      { status: 500 }
    );
  }
}
