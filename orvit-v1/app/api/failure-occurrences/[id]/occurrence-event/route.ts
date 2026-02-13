/**
 * API: /api/failure-occurrences/[id]/occurrence-event
 *
 * POST - Agregar evento "Pasó otra vez" a una falla RESUELTA
 *        Sin crear nueva FailureOccurrence, solo agrega al array occurrenceEvents
 *
 * GET - Obtener historial de eventos de ocurrencia
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

/**
 * Schema de validación para occurrence event
 */
const occurrenceEventSchema = z.object({
  // Síntomas observados (opcional)
  symptoms: z.array(z.number().int().positive()).optional(),

  // Fotos/evidencia (opcional)
  attachments: z.array(z.string().url()).optional(),

  // Notas del operario (opcional pero recomendado)
  notes: z.string().max(1000).optional(),

  // ¿Causó downtime esta vez?
  causedDowntime: z.boolean().optional().default(false),
});

interface OccurrenceEvent {
  id: string;
  reportedBy: number;
  reportedByName?: string;
  reportedAt: string;
  symptoms?: number[];
  attachments?: string[];
  notes?: string;
  causedDowntime: boolean;
}

/**
 * GET /api/failure-occurrences/[id]/occurrence-event
 * Obtener historial de eventos de ocurrencia
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 1. Verificar autenticación
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload || !payload.companyId) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const companyId = payload.companyId as number;
    const occurrenceId = parseInt(params.id);

    if (isNaN(occurrenceId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    // 2. Obtener la falla
    const occurrence = await prisma.failureOccurrence.findFirst({
      where: {
        id: occurrenceId,
        companyId,
      },
      select: {
        id: true,
        occurrenceEvents: true,
        status: true,
      },
    });

    if (!occurrence) {
      return NextResponse.json(
        { error: 'Falla no encontrada' },
        { status: 404 }
      );
    }

    // 3. Parsear eventos
    let events: OccurrenceEvent[] = [];
    if (occurrence.occurrenceEvents) {
      events = typeof occurrence.occurrenceEvents === 'string'
        ? JSON.parse(occurrence.occurrenceEvents)
        : occurrence.occurrenceEvents as OccurrenceEvent[];
    }

    // 4. Resolver nombres de usuarios
    const userIds = events.map(e => e.reportedBy).filter(Boolean);
    if (userIds.length > 0) {
      const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true },
      });
      const userMap = new Map(users.map(u => [u.id, u.name]));

      events = events.map(e => ({
        ...e,
        reportedByName: userMap.get(e.reportedBy) || 'Usuario desconocido',
      }));
    }

    return NextResponse.json({
      events,
      count: events.length,
    });
  } catch (error: any) {
    console.error('❌ Error en GET /api/failure-occurrences/[id]/occurrence-event:', error);
    return NextResponse.json(
      { error: 'Error al obtener eventos', detail: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/failure-occurrences/[id]/occurrence-event
 * Agregar evento "Pasó otra vez"
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 1. Verificar autenticación
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload || !payload.companyId || !payload.userId) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const companyId = payload.companyId as number;
    const userId = payload.userId as number;
    const occurrenceId = parseInt(params.id);

    if (isNaN(occurrenceId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    // 2. Parsear body
    const body = await request.json();
    const validationResult = occurrenceEventSchema.safeParse(body);

    if (!validationResult.success) {
      const errors = validationResult.error.errors
        .map((e) => `${e.path.join('.')}: ${e.message}`)
        .join(', ');
      return NextResponse.json(
        { error: `Validación falló: ${errors}` },
        { status: 400 }
      );
    }

    const data = validationResult.data;

    // 3. Obtener la falla
    const occurrence = await prisma.failureOccurrence.findFirst({
      where: {
        id: occurrenceId,
        companyId,
      },
      select: {
        id: true,
        occurrenceEvents: true,
        status: true,
        title: true,
        machineId: true,
        failureId: true,
      },
    });

    if (!occurrence) {
      return NextResponse.json(
        { error: 'Falla no encontrada' },
        { status: 404 }
      );
    }

    // 4. Verificar que la falla está resuelta (solo se puede agregar a fallas resueltas)
    if (occurrence.status !== 'RESOLVED' && occurrence.status !== 'RESOLVED_IMMEDIATE') {
      return NextResponse.json(
        {
          error: 'Solo se puede reportar "pasó otra vez" en fallas ya resueltas',
          currentStatus: occurrence.status,
          hint: 'Si la falla sigue abierta, actualice el estado en lugar de crear un evento',
        },
        { status: 400 }
      );
    }

    // 5. Obtener nombre del usuario
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });

    // 6. Crear nuevo evento
    const newEvent: OccurrenceEvent = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      reportedBy: userId,
      reportedByName: user?.name || 'Usuario',
      reportedAt: new Date().toISOString(),
      symptoms: data.symptoms,
      attachments: data.attachments,
      notes: data.notes,
      causedDowntime: data.causedDowntime || false,
    };

    // 7. Parsear eventos existentes y agregar el nuevo
    let events: OccurrenceEvent[] = [];
    if (occurrence.occurrenceEvents) {
      events = typeof occurrence.occurrenceEvents === 'string'
        ? JSON.parse(occurrence.occurrenceEvents)
        : occurrence.occurrenceEvents as OccurrenceEvent[];
    }
    events.push(newEvent);

    // 8. Actualizar la falla con el nuevo evento
    // También reabrimos la falla automáticamente (cambia a IN_PROGRESS)
    const updatedOccurrence = await prisma.failureOccurrence.update({
      where: { id: occurrenceId },
      data: {
        occurrenceEvents: events,
        status: 'IN_PROGRESS', // Reabrir automáticamente
        reopenedFrom: occurrenceId,
        reopenedAt: new Date(),
        reopenedById: userId,
        reopenReason: `Evento: ${data.notes || 'Pasó otra vez'}`,
      },
    });

    // 9. También reabrir la OT si estaba completada
    await prisma.workOrder.update({
      where: { id: occurrence.failureId },
      data: {
        status: 'IN_PROGRESS',
        isCompleted: false,
        notes: prisma.$queryRaw`CONCAT(COALESCE(notes, ''), '\n\n[REABIERTA] Evento reportado: ${data.notes || 'Pasó otra vez'}')`,
      },
    }).catch(() => {
      // Fallback si el CONCAT falla
      return prisma.workOrder.update({
        where: { id: occurrence.failureId },
        data: {
          status: 'IN_PROGRESS',
          isCompleted: false,
        },
      });
    });

    console.log(`✅ Evento de ocurrencia agregado a falla ${occurrenceId} por usuario ${userId}`);

    return NextResponse.json({
      success: true,
      message: 'Evento registrado y falla reabierta',
      event: newEvent,
      occurrence: {
        id: updatedOccurrence.id,
        status: updatedOccurrence.status,
        eventsCount: events.length,
      },
    }, { status: 201 });

  } catch (error: any) {
    console.error('❌ Error en POST /api/failure-occurrences/[id]/occurrence-event:', error);
    return NextResponse.json(
      { error: 'Error al crear evento', detail: error.message },
      { status: 500 }
    );
  }
}
