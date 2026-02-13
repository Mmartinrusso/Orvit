/**
 * API: /api/work-orders/[id]/assign-and-plan
 *
 * POST - Asignar técnico y planificar fecha en un solo click
 *        Combina asignación + programación + SLA automático + watchers
 *
 * P3: "Asignar y Planificar" 1-click
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// SLA por defecto según prioridad (en horas)
const DEFAULT_SLA_HOURS: Record<string, number> = {
  URGENT: 4,    // P1: 4 horas
  HIGH: 24,     // P2: 24 horas
  MEDIUM: 72,   // P3: 72 horas (3 días)
  LOW: 168,     // P4: 168 horas (7 días)
};

const assignAndPlanSchema = z.object({
  // Asignación (obligatorio)
  assignedToId: z.number().int().positive('Debe seleccionar un técnico'),

  // Planificación (opcional - si no se pasa, queda solo asignada)
  // Acepta formato datetime-local (YYYY-MM-DDTHH:mm) o ISO completo
  scheduledDate: z.string().optional().refine(
    (val) => !val || !isNaN(Date.parse(val)),
    { message: 'Fecha inválida' }
  ),

  // Opcionales
  startImmediately: z.boolean().optional().default(false),
  estimatedMinutes: z.number().int().min(1).optional(),
  estimatedHours: z.number().positive().optional(), // Legacy, preferir estimatedMinutes
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  slaDueAt: z.string().optional().refine(
    (val) => !val || !isNaN(Date.parse(val)),
    { message: 'Fecha SLA inválida' }
  ),
  notes: z.string().max(500).optional(),
});

/**
 * POST /api/work-orders/[id]/assign-and-plan
 * Asignar y planificar en un solo paso
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
    const workOrderId = parseInt(params.id);

    if (isNaN(workOrderId)) {
      return NextResponse.json({ error: 'ID de orden inválido' }, { status: 400 });
    }

    // 2. Parsear body
    const body = await request.json();
    const validationResult = assignAndPlanSchema.safeParse(body);

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

    // 3. Verificar que la OT existe y pertenece a la empresa
    const workOrder = await prisma.workOrder.findFirst({
      where: {
        id: workOrderId,
        companyId,
      },
      include: {
        assignedTo: { select: { id: true, name: true } },
        failureOccurrences: { select: { id: true, title: true } }
      }
    });

    if (!workOrder) {
      return NextResponse.json(
        { error: 'Orden de trabajo no encontrada' },
        { status: 404 }
      );
    }

    // 4. Verificar que la OT no está cerrada
    if (workOrder.status === 'COMPLETED' || workOrder.status === 'CANCELLED') {
      return NextResponse.json(
        { error: `La orden está ${workOrder.status === 'COMPLETED' ? 'completada' : 'cancelada'}` },
        { status: 400 }
      );
    }

    // 5. Verificar que el técnico existe y pertenece a la empresa
    const technician = await prisma.userOnCompany.findFirst({
      where: {
        userId: data.assignedToId,
        companyId,
      },
      include: {
        user: { select: { id: true, name: true, email: true } }
      }
    });

    if (!technician) {
      return NextResponse.json(
        { error: 'El técnico no pertenece a esta empresa' },
        { status: 400 }
      );
    }

    // 6. Calcular SLA automático si no se proporciona
    const priority = data.priority || workOrder.priority;
    let slaDueAt: Date | null = null;

    if (data.slaDueAt) {
      slaDueAt = new Date(data.slaDueAt);
    } else if (!workOrder.slaDueAt) {
      // Calcular SLA automático según prioridad
      const slaHours = DEFAULT_SLA_HOURS[priority] || 72;
      slaDueAt = new Date();
      slaDueAt.setHours(slaDueAt.getHours() + slaHours);
    }

    // 7. Construir datos de actualización
    const now = new Date();
    const scheduledDate = data.scheduledDate ? new Date(data.scheduledDate) : null;

    const updateData: any = {
      assignedToId: data.assignedToId,
      assignedAt: now,
    };

    // Fecha planificada
    if (scheduledDate) {
      updateData.scheduledDate = scheduledDate;
      updateData.plannedAt = now;
    }

    // Prioridad
    if (data.priority) {
      updateData.priority = data.priority;
    }

    // SLA
    if (slaDueAt) {
      updateData.slaDueAt = slaDueAt;
      updateData.slaStatus = 'OK';
    }

    // Estimación de tiempo
    if (data.estimatedMinutes) {
      updateData.estimatedHours = data.estimatedMinutes / 60;
    } else if (data.estimatedHours) {
      updateData.estimatedHours = data.estimatedHours;
    }

    // Nota
    if (data.notes) {
      updateData.notes = workOrder.notes
        ? `${workOrder.notes}\n\n[Asignación ${now.toLocaleDateString()}] ${data.notes}`
        : `[Asignación ${now.toLocaleDateString()}] ${data.notes}`;
    }

    // Estado según acciones
    if (data.startImmediately) {
      updateData.status = 'IN_PROGRESS';
      updateData.startedDate = now;
    } else if (scheduledDate) {
      updateData.status = 'SCHEDULED';
    } else {
      updateData.status = 'PENDING'; // Solo asignada, sin fecha
    }

    // 8. Actualizar la OT
    const updatedWorkOrder = await prisma.workOrder.update({
      where: { id: workOrderId },
      data: updateData,
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
        machine: { select: { id: true, name: true } },
        failureOccurrences: { select: { id: true, title: true, priority: true } },
        watchers: { select: { userId: true } }
      }
    });

    // 9. Agregar watcher automático al responsable (si no existe)
    const existingWatcher = updatedWorkOrder.watchers.find(
      (w) => w.userId === data.assignedToId
    );
    if (!existingWatcher) {
      await prisma.workOrderWatcher.create({
        data: {
          workOrderId,
          userId: data.assignedToId,
          reason: 'AUTO_ASSIGNED',
        },
      }).catch(() => {
        // Ignorar error si ya existe (race condition)
      });
    }

    // 10. Registrar en historial (comentario del sistema)
    const slaInfo = slaDueAt
      ? ` SLA: ${slaDueAt.toLocaleDateString('es-AR')} ${slaDueAt.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`
      : '';
    const scheduleInfo = scheduledDate
      ? ` para ${scheduledDate.toLocaleDateString('es-AR')}`
      : '';

    await prisma.workOrderComment.create({
      data: {
        workOrderId,
        content: `OT asignada a ${technician.user.name}${scheduleInfo}.${slaInfo}`,
        type: 'system',
        authorId: userId,
      },
    });

    // 11. Si tiene FailureOccurrence y se inicia, actualizar estado
    if (data.startImmediately && updatedWorkOrder.failureOccurrences.length > 0) {
      await prisma.failureOccurrence.updateMany({
        where: {
          id: { in: updatedWorkOrder.failureOccurrences.map(f => f.id) }
        },
        data: {
          status: 'IN_PROGRESS'
        }
      });
    }

    console.log(
      `✅ OT ${workOrderId} asignada a ${technician.user.name}` +
      `${scheduledDate ? ` para ${scheduledDate.toLocaleDateString()}` : ''}` +
      ` por usuario ${userId}${data.startImmediately ? ' (iniciada)' : ''}`
    );
    if (slaDueAt) {
      console.log(`   SLA: ${slaDueAt.toISOString()}`);
    }

    // TODO: Agregar notificación Discord cuando esté implementado

    return NextResponse.json({
      success: true,
      message: data.startImmediately
        ? 'Orden asignada, planificada e iniciada'
        : scheduledDate
          ? 'Orden asignada y planificada'
          : 'Orden asignada',
      workOrder: {
        id: updatedWorkOrder.id,
        title: updatedWorkOrder.title,
        status: updatedWorkOrder.status,
        priority: updatedWorkOrder.priority,
        assignedTo: updatedWorkOrder.assignedTo,
        scheduledDate: updatedWorkOrder.scheduledDate,
        startedDate: updatedWorkOrder.startedDate,
        estimatedHours: updatedWorkOrder.estimatedHours,
        slaDueAt: updatedWorkOrder.slaDueAt,
        slaStatus: updatedWorkOrder.slaStatus,
      },
      assignedTo: technician.user,
      scheduledFor: scheduledDate,
      slaDueAt,
      wasStarted: data.startImmediately,
    });

  } catch (error: any) {
    console.error('❌ Error en POST /api/work-orders/[id]/assign-and-plan:', error);
    return NextResponse.json(
      { error: 'Error al asignar y planificar', detail: error.message },
      { status: 500 }
    );
  }
}
