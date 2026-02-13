/**
 * Pickup Reservation Detail API - O2C Phase 4
 *
 * Manage individual pickup reservations (arrive, load, complete, cancel).
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// GET - Get reservation detail
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.TURNOS_VIEW);
    if (error) return error;

    const { id } = await params;
    const reservationId = parseInt(id);

    if (!reservationId) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const reservation = await prisma.pickupReservation.findUnique({
      where: { id: reservationId },
      include: {
        slot: true,
        sale: {
          select: {
            id: true,
            numero: true,
            estado: true,
            total: true,
            items: {
              select: {
                id: true,
                productId: true,
                product: { select: { name: true } },
                cantidad: true,
                cantidadEntregada: true,
              },
            },
          },
        },
        client: {
          select: { id: true, name: true, phone: true },
        },
      },
    });

    if (!reservation) {
      return NextResponse.json(
        { error: 'Reservación no encontrada' },
        { status: 404 }
      );
    }

    return NextResponse.json(reservation);
  } catch (error) {
    console.error('Error fetching reservation:', error);
    return NextResponse.json(
      { error: 'Error al obtener reservación' },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PATCH - Update reservation status
// ═══════════════════════════════════════════════════════════════════════════════

interface UpdateReservationRequest {
  action:
    | 'arrive'
    | 'startLoading'
    | 'complete'
    | 'cancel'
    | 'cancelLate'
    | 'noShow';
  retiroNombre?: string;
  retiroDNI?: string;
  retiroVehiculo?: string;
  observaciones?: string;
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.TURNOS_MANAGE);
    if (error) return error;

    const { id } = await params;
    const reservationId = parseInt(id);
    const body: UpdateReservationRequest = await req.json();

    if (!reservationId) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const reservation = await prisma.pickupReservation.findUnique({
      where: { id: reservationId },
      include: { slot: true },
    });

    if (!reservation) {
      return NextResponse.json(
        { error: 'Reservación no encontrada' },
        { status: 404 }
      );
    }

    switch (body.action) {
      case 'arrive': {
        if (reservation.estado !== 'RESERVADO') {
          return NextResponse.json(
            { error: 'Solo se puede registrar llegada para reservaciones activas' },
            { status: 422 }
          );
        }

        await prisma.pickupReservation.update({
          where: { id: reservationId },
          data: {
            estado: 'EN_ESPERA',
            llegadaAt: new Date(),
          },
        });

        return NextResponse.json({
          success: true,
          message: 'Llegada registrada',
        });
      }

      case 'startLoading': {
        if (reservation.estado !== 'EN_ESPERA') {
          return NextResponse.json(
            { error: 'Solo se puede iniciar carga para clientes en espera' },
            { status: 422 }
          );
        }

        await prisma.pickupReservation.update({
          where: { id: reservationId },
          data: {
            estado: 'EN_CARGA',
            inicioAt: new Date(),
          },
        });

        return NextResponse.json({
          success: true,
          message: 'Carga iniciada',
        });
      }

      case 'complete': {
        if (reservation.estado !== 'EN_CARGA') {
          return NextResponse.json(
            { error: 'Solo se puede completar una carga en proceso' },
            { status: 422 }
          );
        }

        await prisma.pickupReservation.update({
          where: { id: reservationId },
          data: {
            estado: 'COMPLETADO',
            finAt: new Date(),
            retiroFecha: new Date(),
            retiroNombre: body.retiroNombre,
            retiroDNI: body.retiroDNI,
            retiroVehiculo: body.retiroVehiculo,
            observaciones: body.observaciones || reservation.observaciones,
          },
        });

        return NextResponse.json({
          success: true,
          message: 'Retiro completado',
        });
      }

      case 'cancel': {
        if (
          !['RESERVADO', 'EN_ESPERA'].includes(reservation.estado)
        ) {
          return NextResponse.json(
            { error: 'No se puede cancelar esta reservación' },
            { status: 422 }
          );
        }

        // Check cancellation deadline
        const salesConfig = await prisma.salesConfig.findUnique({
          where: { companyId: reservation.companyId },
        });

        const deadlineHours = salesConfig?.cancellationDeadlineHours ?? 24;
        const slotDate = new Date(reservation.slot.fecha);
        const [hours, minutes] = reservation.slot.horaInicio.split(':');
        slotDate.setHours(parseInt(hours), parseInt(minutes));

        const deadline = new Date(slotDate);
        deadline.setHours(deadline.getHours() - deadlineHours);

        const isLate = new Date() > deadline;

        await prisma.pickupReservation.update({
          where: { id: reservationId },
          data: {
            estado: isLate ? 'CANCELADO_TARDE' : 'CANCELADO',
            observaciones: body.observaciones || reservation.observaciones,
          },
        });

        return NextResponse.json({
          success: true,
          isLate,
          message: isLate
            ? 'Reservación cancelada (fuera de plazo)'
            : 'Reservación cancelada',
        });
      }

      case 'cancelLate': {
        await prisma.pickupReservation.update({
          where: { id: reservationId },
          data: {
            estado: 'CANCELADO_TARDE',
            observaciones: body.observaciones || reservation.observaciones,
          },
        });

        return NextResponse.json({
          success: true,
          message: 'Reservación cancelada tardíamente',
        });
      }

      case 'noShow': {
        if (reservation.estado !== 'RESERVADO') {
          return NextResponse.json(
            { error: 'Solo se puede marcar no-show para reservaciones activas' },
            { status: 422 }
          );
        }

        await prisma.pickupReservation.update({
          where: { id: reservationId },
          data: {
            estado: 'NO_SHOW',
            observaciones: body.observaciones || reservation.observaciones,
          },
        });

        return NextResponse.json({
          success: true,
          message: 'Marcado como no presentado',
        });
      }

      default:
        return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error updating reservation:', error);
    return NextResponse.json(
      { error: 'Error al actualizar reservación' },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// DELETE - Delete reservation (only if RESERVADO)
// ═══════════════════════════════════════════════════════════════════════════════

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.TURNOS_MANAGE);
    if (error) return error;

    const { id } = await params;
    const reservationId = parseInt(id);

    if (!reservationId) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const reservation = await prisma.pickupReservation.findUnique({
      where: { id: reservationId },
    });

    if (!reservation) {
      return NextResponse.json(
        { error: 'Reservación no encontrada' },
        { status: 404 }
      );
    }

    if (reservation.estado !== 'RESERVADO') {
      return NextResponse.json(
        { error: 'Solo se pueden eliminar reservaciones pendientes' },
        { status: 422 }
      );
    }

    await prisma.pickupReservation.delete({
      where: { id: reservationId },
    });

    return NextResponse.json({
      success: true,
      message: 'Reservación eliminada',
    });
  } catch (error) {
    console.error('Error deleting reservation:', error);
    return NextResponse.json(
      { error: 'Error al eliminar reservación' },
      { status: 500 }
    );
  }
}
