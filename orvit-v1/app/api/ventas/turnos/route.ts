/**
 * Pickup Slots API - O2C Phase 4
 *
 * Manages pickup slots for customer pickups.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import { Prisma } from '@prisma/client';
import { createPickupSlotSchema } from '@/lib/ventas/validation-schemas';
import { applyViewMode, getViewMode, isExtendedMode, DOC_TYPE } from '@/lib/view-mode';
import {
  getIdempotencyKey,
  withIdempotency,
  handleIdempotencyError,
  idempotencyHeaders,
} from '@/lib/ventas/idempotency-helper';

export const dynamic = 'force-dynamic';

// ═══════════════════════════════════════════════════════════════════════════════
// GET - List pickup slots
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET(req: NextRequest) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.TURNOS_VIEW);
    if (error) return error;

    const companyId = user!.companyId;
    const { searchParams } = new URL(req.url);
    const fechaDesde = searchParams.get('fechaDesde');
    const fechaHasta = searchParams.get('fechaHasta');
    const onlyAvailable = searchParams.get('onlyAvailable') === 'true';
    const viewMode = getViewMode(req);

    const where: Prisma.PickupSlotWhereInput = applyViewMode({
      companyId,
      ...(fechaDesde &&
        fechaHasta && {
          fecha: {
            gte: new Date(fechaDesde),
            lte: new Date(fechaHasta),
          },
        }),
    }, viewMode);

    const slots = await prisma.pickupSlot.findMany({
      where,
      include: {
        reservations: {
          where: {
            estado: { in: ['RESERVADO', 'EN_ESPERA', 'EN_CARGA'] },
          },
          select: {
            id: true,
            estado: true,
            saleId: true,
            client: {
              select: { id: true, name: true },
            },
          },
        },
        _count: {
          select: {
            reservations: {
              where: {
                estado: { in: ['RESERVADO', 'EN_ESPERA', 'EN_CARGA'] },
              },
            },
          },
        },
      },
      orderBy: [{ fecha: 'asc' }, { horaInicio: 'asc' }],
    });

    // Filter only available slots if requested
    const result = onlyAvailable
      ? slots.filter((slot) => slot._count.reservations < slot.capacidadMaxima)
      : slots;

    // Add availability info
    const slotsWithAvailability = result.map((slot) => ({
      ...slot,
      reservadas: slot._count.reservations,
      disponibles: slot.capacidadMaxima - slot._count.reservations,
      estaDisponible: slot._count.reservations < slot.capacidadMaxima,
    }));

    return NextResponse.json(slotsWithAvailability);
  } catch (error) {
    console.error('Error fetching pickup slots:', error);
    return NextResponse.json(
      { error: 'Error al obtener turnos' },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// POST - Create pickup slots (bulk or single)
// ═══════════════════════════════════════════════════════════════════════════════

export async function POST(req: NextRequest) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.TURNOS_CREATE);
    if (error) return error;

    const companyId = user!.companyId;
    const idempotencyKey = getIdempotencyKey(req);
    const docType = isExtendedMode(req) ? DOC_TYPE.T2 : DOC_TYPE.T1;
    const body = await req.json();

    // Validate with Zod schema
    const validation = createPickupSlotSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Datos de entrada inválidos', details: validation.error.errors },
        { status: 400 }
      );
    }

    const data = validation.data;

    // Execute with idempotency support
    const idempotencyResult = await withIdempotency(
      idempotencyKey,
      companyId,
      'CREATE_PICKUP_SLOT',
      async () => {
        // Generate dates for slots
        const dates: Date[] = [];
        const startDate = new Date(data.fecha);
        const endDate = data.repeatUntil ? new Date(data.repeatUntil) : startDate;
        const excludeSet = new Set(data.excludeDates || []);

        let currentDate = new Date(startDate);
        while (currentDate <= endDate) {
          const dayOfWeek = currentDate.getDay();
          const dateStr = currentDate.toISOString().split('T')[0];

          // Skip weekends if excluded
          const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
          if (data.excludeWeekends !== false && isWeekend) {
            currentDate.setDate(currentDate.getDate() + 1);
            continue;
          }

          // Skip excluded dates
          if (excludeSet.has(dateStr)) {
            currentDate.setDate(currentDate.getDate() + 1);
            continue;
          }

          dates.push(new Date(currentDate));
          currentDate.setDate(currentDate.getDate() + 1);
        }

        // Check for existing slots
        const existingSlots = await prisma.pickupSlot.findMany({
          where: {
            companyId,
            fecha: { in: dates },
            horaInicio: data.horaInicio,
          },
          select: { fecha: true },
        });

        const existingDates = new Set(
          existingSlots.map((s) => s.fecha.toISOString().split('T')[0])
        );

        // Filter out dates that already have slots
        const newDates = dates.filter(
          (d) => !existingDates.has(d.toISOString().split('T')[0])
        );

        if (newDates.length === 0) {
          throw new Error('ALL_SLOTS_EXIST');
        }

        // Create slots
        const slots = await prisma.pickupSlot.createMany({
          data: newDates.map((date) => ({
            fecha: date,
            horaInicio: data.horaInicio,
            horaFin: data.horaFin,
            capacidadMaxima: data.capacidadMaxima,
            docType,
            companyId,
            createdBy: user!.id,
          })),
        });

        return {
          created: slots.count,
          skipped: dates.length - newDates.length,
          message: `${slots.count} turnos creados`,
        };
      },
      {
        entityType: 'PickupSlot',
        getEntityId: () => 0,
      }
    );

    return NextResponse.json(idempotencyResult.response, {
      status: idempotencyResult.isReplay ? 200 : 201,
      headers: idempotencyHeaders(idempotencyResult.idempotencyKey, idempotencyResult.isReplay),
    });
  } catch (error) {
    console.error('Error creating pickup slots:', error);

    // Handle idempotency conflict error
    const idempotencyError = handleIdempotencyError(error);
    if (idempotencyError) return idempotencyError;

    // Handle custom errors
    if (error instanceof Error) {
      if (error.message === 'ALL_SLOTS_EXIST') {
        return NextResponse.json(
          { error: 'Todos los turnos ya existen' },
          { status: 409 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Error al crear turnos' },
      { status: 500 }
    );
  }
}
