/**
 * API: /api/failure-occurrences/[id]/occurrences
 *
 * GET  - Lista eventos "pasó otra vez" de una FailureOccurrence
 * POST - Registrar nuevo evento "pasó otra vez" (tabla normalizada)
 *
 * Nota: Estos son eventos ADICIONALES sobre la misma falla principal.
 *       La primera ocurrencia está en FailureOccurrence, las siguientes aquí.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

/**
 * Schema de validación para nuevo evento de ocurrencia
 */
const occurrenceEventSchema = z.object({
  notes: z.string().optional(),
  causedDowntime: z.boolean().default(false),
  isSafetyRelated: z.boolean().default(false),
  isIntermittent: z.boolean().default(false),
  symptoms: z.array(z.number().int().positive()).optional(),
  attachments: z.array(z.string()).optional(),
  createWorkOrder: z.boolean().default(false), // Si true, crea OT para este evento
});

/**
 * GET /api/failure-occurrences/[id]/occurrences
 * Lista todos los eventos "pasó otra vez" de una FailureOccurrence
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
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
    const failureOccurrenceId = parseInt(params.id);

    if (isNaN(failureOccurrenceId)) {
      return NextResponse.json(
        { error: 'ID de ocurrencia inválido' },
        { status: 400 }
      );
    }

    // Verificar que la FailureOccurrence existe y pertenece a la empresa
    const occurrence = await prisma.failureOccurrence.findFirst({
      where: { id: failureOccurrenceId, companyId },
      select: { id: true, title: true, status: true }
    });

    if (!occurrence) {
      return NextResponse.json(
        { error: 'Ocurrencia no encontrada' },
        { status: 404 }
      );
    }

    // Obtener todos los eventos de ocurrencia
    const events = await prisma.failureOccurrenceEvent.findMany({
      where: {
        failureOccurrenceId,
        companyId
      },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        workOrder: { select: { id: true, title: true, status: true } }
      },
      orderBy: { occurredAt: 'desc' }
    });

    return NextResponse.json({
      occurrence: {
        id: occurrence.id,
        title: occurrence.title,
        status: occurrence.status
      },
      events,
      totalEvents: events.length
    });

  } catch (error: any) {
    console.error('❌ Error en GET /api/failure-occurrences/[id]/occurrences:', error);
    return NextResponse.json(
      { error: 'Error al obtener eventos', detail: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/failure-occurrences/[id]/occurrences
 * Registrar un nuevo evento "pasó otra vez"
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
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
    const failureOccurrenceId = parseInt(params.id);

    if (isNaN(failureOccurrenceId)) {
      return NextResponse.json(
        { error: 'ID de ocurrencia inválido' },
        { status: 400 }
      );
    }

    // Parsear y validar body
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

    // Verificar que la FailureOccurrence existe y pertenece a la empresa
    const occurrence = await prisma.failureOccurrence.findFirst({
      where: { id: failureOccurrenceId, companyId },
      include: {
        machine: { select: { id: true, name: true } }
      }
    });

    if (!occurrence) {
      return NextResponse.json(
        { error: 'Ocurrencia no encontrada' },
        { status: 404 }
      );
    }

    // Verificar que la ocurrencia no está cerrada
    if (occurrence.status === 'RESOLVED' || occurrence.status === 'RESOLVED_IMMEDIATE') {
      return NextResponse.json(
        { error: 'No se pueden agregar eventos a una falla resuelta' },
        { status: 400 }
      );
    }

    // Crear el evento de ocurrencia (transacción)
    const result = await prisma.$transaction(async (tx) => {
      // 1. Crear el evento
      const event = await tx.failureOccurrenceEvent.create({
        data: {
          companyId,
          failureOccurrenceId,
          notes: data.notes,
          createdById: userId,
          causedDowntime: data.causedDowntime,
          isSafetyRelated: data.isSafetyRelated,
          isIntermittent: data.isIntermittent,
          symptoms: data.symptoms ? data.symptoms : undefined,
          attachments: data.attachments && data.attachments.length > 0
            ? data.attachments.map((url: string) => ({ url, uploadedAt: new Date().toISOString() }))
            : undefined
        },
        include: {
          createdBy: { select: { id: true, name: true, email: true } }
        }
      });

      // 2. Si fue marcado como safety o downtime, puede escalar la prioridad
      if (data.isSafetyRelated || data.causedDowntime) {
        // Escalar a P1 si hay safety, o mejorar prioridad si hay downtime
        const newPriority = data.isSafetyRelated ? 'P1' :
                           (occurrence.priority === 'P4' ? 'P3' :
                            occurrence.priority === 'P3' ? 'P2' : occurrence.priority);

        if (newPriority !== occurrence.priority) {
          await tx.failureOccurrence.update({
            where: { id: failureOccurrenceId },
            data: { priority: newPriority }
          });
        }
      }

      // 3. Si se solicita crear OT, crearla
      let workOrder = null;
      if (data.createWorkOrder) {
        workOrder = await tx.workOrder.create({
          data: {
            title: `Atender ocurrencia — ${occurrence.title}`,
            description: data.notes || `Nueva ocurrencia de: ${occurrence.title}`,
            type: 'CORRECTIVE',
            status: 'PENDING',
            priority: data.isSafetyRelated ? 'URGENT' : 'HIGH',
            origin: 'FAILURE',
            machineId: occurrence.machineId,
            companyId,
            createdById: userId,
            failureDescription: `Ocurrencia adicional: ${data.notes || occurrence.title}`,
            isSafetyRelated: data.isSafetyRelated
          }
        });

        // Vincular el evento a la OT
        await tx.failureOccurrenceEvent.update({
          where: { id: event.id },
          data: { workOrderId: workOrder.id }
        });
      }

      // 4. Si causó downtime, crear log
      let downtimeLog = null;
      if (data.causedDowntime) {
        try {
          downtimeLog = await tx.downtimeLog.create({
            data: {
              failureOccurrenceId,
              workOrderId: workOrder?.id || occurrence.failureId,
              machineId: occurrence.machineId,
              companyId,
              category: 'UNPLANNED'
            }
          });
        } catch (e) {
          console.warn('⚠️ No se pudo crear DowntimeLog (tabla puede no existir)');
        }
      }

      // 5. Registrar en timeline (ActivityEvent)
      try {
        await tx.activityEvent.create({
          data: {
            companyId,
            eventType: 'OCCURRENCE_REPORTED',
            entityType: 'FAILURE_OCCURRENCE',
            entityId: failureOccurrenceId,
            metadata: {
              eventId: event.id,
              causedDowntime: data.causedDowntime,
              isSafetyRelated: data.isSafetyRelated,
              workOrderCreated: !!workOrder
            },
            performedById: userId
          }
        });
      } catch (e) {
        console.warn('⚠️ No se pudo crear ActivityEvent (tabla puede no existir)');
      }

      return { event, workOrder, downtimeLog };
    });

    console.log(`✅ Evento de ocurrencia creado: ID ${result.event.id} para falla #${failureOccurrenceId}`);

    return NextResponse.json({
      success: true,
      event: result.event,
      workOrder: result.workOrder ? {
        id: result.workOrder.id,
        title: result.workOrder.title,
        status: result.workOrder.status
      } : null,
      downtimeLog: result.downtimeLog ? {
        id: result.downtimeLog.id,
        startedAt: result.downtimeLog.startedAt
      } : null,
      message: result.workOrder
        ? 'Evento registrado y OT creada'
        : 'Evento registrado exitosamente'
    }, { status: 201 });

  } catch (error: any) {
    console.error('❌ Error en POST /api/failure-occurrences/[id]/occurrences:', error);
    return NextResponse.json(
      { error: 'Error al crear evento', detail: error.message },
      { status: 500 }
    );
  }
}
