/**
 * Pickup Reservation API - O2C Phase 4
 *
 * Handles pickup slot reservations with transactional locking.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

// ═══════════════════════════════════════════════════════════════════════════════
// POST - Reserve a pickup slot (with lock)
// ═══════════════════════════════════════════════════════════════════════════════

interface ReserveSlotRequest {
  slotId: number;
  saleId: number;
  clientId: string;
  observaciones?: string;
  docType: 'T1' | 'T2';
}

export async function POST(req: NextRequest) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.TURNOS_RESERVE);
    if (error) return error;

    const companyId = user!.companyId;

    const body: ReserveSlotRequest = await req.json();
    const { slotId, saleId, clientId, observaciones, docType } = body;

    // Validate
    if (!slotId || !saleId || !clientId) {
      return NextResponse.json(
        { error: 'slotId, saleId, and clientId are required' },
        { status: 400 }
      );
    }

    // Use Serializable isolation to prevent race conditions
    const reservation = await prisma.$transaction(
      async (tx) => {
        // 1. Check if sale already has a reservation
        const existingReservation = await tx.pickupReservation.findUnique({
          where: { saleId },
        });

        if (existingReservation && existingReservation.estado !== 'CANCELADO') {
          throw new Error('El pedido ya tiene un turno reservado');
        }

        // 2. Get slot with lock (via Serializable isolation)
        const slot = await tx.pickupSlot.findUnique({
          where: { id: slotId },
          include: {
            reservations: {
              where: {
                estado: { in: ['RESERVADO', 'EN_ESPERA', 'EN_CARGA'] },
              },
            },
          },
        });

        if (!slot) {
          throw new Error('Turno no encontrado');
        }

        if (slot.companyId !== companyId) {
          throw new Error('Turno no pertenece a esta empresa');
        }

        // 3. Check capacity
        const reservadas = slot.reservations.length;
        if (reservadas >= slot.capacidadMaxima) {
          throw new Error('El turno está completo');
        }

        // 4. Get sales config for no-show penalty check
        const salesConfig = await tx.salesConfig.findUnique({
          where: { companyId },
        });

        const noShowPenaltyDays = salesConfig?.noShowPenaltyDays ?? 7;

        // 5. Check for recent no-show penalty
        const penaltyDate = new Date();
        penaltyDate.setDate(penaltyDate.getDate() - noShowPenaltyDays);

        const recentNoShow = await tx.pickupReservation.findFirst({
          where: {
            clientId,
            estado: 'NO_SHOW',
            updatedAt: { gte: penaltyDate },
          },
        });

        if (recentNoShow) {
          const penaltyEndDate = new Date(recentNoShow.updatedAt);
          penaltyEndDate.setDate(penaltyEndDate.getDate() + noShowPenaltyDays);
          throw new Error(
            `Cliente en período de penalización hasta ${penaltyEndDate.toLocaleDateString()}`
          );
        }

        // 6. Create reservation
        const newReservation = await tx.pickupReservation.create({
          data: {
            slotId,
            saleId,
            clientId,
            estado: 'RESERVADO',
            observaciones,
            companyId,
            docType,
            createdBy: user!.id,
          },
          include: {
            slot: true,
            client: { select: { id: true, name: true } },
          },
        });

        return newReservation;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 10000,
      }
    );

    return NextResponse.json(
      {
        id: reservation.id,
        slotId: reservation.slotId,
        saleId: reservation.saleId,
        fecha: reservation.slot.fecha,
        horaInicio: reservation.slot.horaInicio,
        horaFin: reservation.slot.horaFin,
        message: 'Turno reservado exitosamente',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error reserving slot:', error);
    const message =
      error instanceof Error ? error.message : 'Error al reservar turno';
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
