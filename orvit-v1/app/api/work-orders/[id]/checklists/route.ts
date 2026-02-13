/**
 * API: /api/work-orders/[id]/checklists
 *
 * GET  - Lista checklists asignados a una OT
 * POST - Asignar checklist a OT (desde template o manual)
 *
 * P5.3: Checklists por tipo de falla
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

/**
 * Schema para item completado
 */
const completedItemSchema = z.object({
  id: z.string(),
  checked: z.boolean().optional(),
  value: z.union([z.string(), z.number()]).optional(),
  notes: z.string().optional(),
  photo: z.string().optional()
});

/**
 * Schema para fase completada
 */
const completedPhaseSchema = z.object({
  id: z.string(),
  items: z.array(completedItemSchema),
  completedAt: z.string().datetime().optional()
});

/**
 * Schema para asignar checklist
 */
const assignChecklistSchema = z.object({
  templateId: z.number().int().positive().optional(), // Si viene de template
  name: z.string().min(3).max(255).optional(), // Nombre custom si no hay template
  phases: z.array(z.object({
    id: z.string(),
    name: z.string(),
    items: z.array(z.object({
      id: z.string(),
      description: z.string(),
      type: z.enum(['check', 'value', 'text', 'photo']),
      required: z.boolean().default(true),
      unit: z.string().optional(),
      minValue: z.number().optional(),
      maxValue: z.number().optional()
    }))
  })).optional() // Requerido si no hay templateId
});

/**
 * Schema para actualizar progreso
 */
const updateProgressSchema = z.object({
  completedPhases: z.array(completedPhaseSchema)
});

/**
 * GET /api/work-orders/[id]/checklists
 * Lista checklists de una OT
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
    const workOrderId = parseInt(params.id);

    if (isNaN(workOrderId)) {
      return NextResponse.json(
        { error: 'ID de orden inválido' },
        { status: 400 }
      );
    }

    // Verificar que la OT existe
    const workOrder = await prisma.workOrder.findFirst({
      where: { id: workOrderId, companyId },
      select: { id: true, title: true, status: true }
    });

    if (!workOrder) {
      return NextResponse.json(
        { error: 'Orden de trabajo no encontrada' },
        { status: 404 }
      );
    }

    // Obtener checklists
    const checklists = await prisma.workOrderChecklist.findMany({
      where: { workOrderId, companyId },
      include: {
        template: { select: { id: true, name: true } },
        completedBy: { select: { id: true, name: true } }
      },
      orderBy: { createdAt: 'asc' }
    });

    // Calcular progreso de cada checklist
    const checklistsWithProgress = checklists.map(cl => {
      const phases = cl.phases as any[];
      const completedPhases = cl.completedPhases as any[];

      let totalItems = 0;
      let completedItems = 0;

      phases.forEach(phase => {
        const phaseItems = phase.items || [];
        totalItems += phaseItems.length;

        const completed = completedPhases.find((cp: any) => cp.id === phase.id);
        if (completed) {
          completedItems += completed.items?.length || 0;
        }
      });

      const progress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

      return {
        id: cl.id,
        name: cl.name,
        template: cl.template,
        phases: cl.phases,
        completedPhases: cl.completedPhases,
        status: cl.status,
        progress,
        totalItems,
        completedItems,
        completedBy: cl.completedBy,
        completedAt: cl.completedAt,
        createdAt: cl.createdAt
      };
    });

    // También buscar plantillas sugeridas para esta OT
    const suggestedTemplates = await prisma.correctiveChecklistTemplate.findMany({
      where: {
        companyId,
        isActive: true,
        OR: [
          { machineId: workOrder.id }, // TODO: Debería ser machineId de la OT
          { componentId: null, machineId: null } // Plantillas genéricas
        ]
      },
      select: {
        id: true,
        name: true,
        description: true,
        minPriority: true,
        usageCount: true
      },
      orderBy: { usageCount: 'desc' },
      take: 5
    });

    return NextResponse.json({
      workOrder: {
        id: workOrder.id,
        title: workOrder.title,
        status: workOrder.status
      },
      checklists: checklistsWithProgress,
      totalChecklists: checklists.length,
      suggestedTemplates
    });

  } catch (error: any) {
    console.error('❌ Error en GET /api/work-orders/[id]/checklists:', error);
    return NextResponse.json(
      { error: 'Error al obtener checklists', detail: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/work-orders/[id]/checklists
 * Asignar checklist a OT
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
    const workOrderId = parseInt(params.id);

    if (isNaN(workOrderId)) {
      return NextResponse.json(
        { error: 'ID de orden inválido' },
        { status: 400 }
      );
    }

    // Parsear y validar body
    const body = await request.json();
    const validationResult = assignChecklistSchema.safeParse(body);

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

    // Verificar que la OT existe
    const workOrder = await prisma.workOrder.findFirst({
      where: { id: workOrderId, companyId }
    });

    if (!workOrder) {
      return NextResponse.json(
        { error: 'Orden de trabajo no encontrada' },
        { status: 404 }
      );
    }

    // Obtener fases desde template o data
    let phases: any[];
    let name: string;
    let templateId: number | null = null;

    if (data.templateId) {
      // Desde template
      const template = await prisma.correctiveChecklistTemplate.findFirst({
        where: { id: data.templateId, companyId, isActive: true }
      });

      if (!template) {
        return NextResponse.json(
          { error: 'Plantilla no encontrada' },
          { status: 404 }
        );
      }

      phases = template.phases as any[];
      name = template.name;
      templateId = template.id;

      // Incrementar contador de uso
      await prisma.correctiveChecklistTemplate.update({
        where: { id: template.id },
        data: { usageCount: { increment: 1 } }
      });
    } else if (data.phases) {
      // Manual
      phases = data.phases;
      name = data.name || 'Checklist Manual';
    } else {
      return NextResponse.json(
        { error: 'Debe proporcionar templateId o phases' },
        { status: 400 }
      );
    }

    // Crear checklist (transacción)
    const result = await prisma.$transaction(async (tx) => {
      const checklist = await tx.workOrderChecklist.create({
        data: {
          companyId,
          workOrderId,
          templateId,
          name,
          phases,
          completedPhases: [],
          status: 'PENDING'
        },
        include: {
          template: { select: { id: true, name: true } }
        }
      });

      // Registrar en timeline
      try {
        await tx.activityEvent.create({
          data: {
            companyId,
            eventType: 'CHECKLIST_STARTED',
            entityType: 'WORK_ORDER',
            entityId: workOrderId,
            newValue: checklist.name,
            metadata: {
              checklistId: checklist.id,
              templateId,
              phasesCount: phases.length
            },
            performedById: userId
          }
        });
      } catch (e) {
        console.warn('⚠️ No se pudo crear ActivityEvent');
      }

      return { checklist };
    });

    console.log(`✅ Checklist asignado: ID ${result.checklist.id} a OT #${workOrderId}`);

    return NextResponse.json({
      success: true,
      message: 'Checklist asignado exitosamente',
      checklist: {
        id: result.checklist.id,
        name: result.checklist.name,
        template: result.checklist.template,
        phases: result.checklist.phases,
        status: result.checklist.status,
        createdAt: result.checklist.createdAt
      }
    }, { status: 201 });

  } catch (error: any) {
    console.error('❌ Error en POST /api/work-orders/[id]/checklists:', error);
    return NextResponse.json(
      { error: 'Error al asignar checklist', detail: error.message },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/work-orders/[id]/checklists
 * Actualizar progreso de checklist (body incluye checklistId)
 */
export async function PATCH(
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
    const workOrderId = parseInt(params.id);

    if (isNaN(workOrderId)) {
      return NextResponse.json(
        { error: 'ID de orden inválido' },
        { status: 400 }
      );
    }

    // Parsear body
    const body = await request.json();
    const checklistId = body.checklistId;
    const completedPhases = body.completedPhases;
    const markComplete = body.markComplete === true;

    if (!checklistId) {
      return NextResponse.json(
        { error: 'checklistId es requerido' },
        { status: 400 }
      );
    }

    // Verificar que el checklist existe
    const checklist = await prisma.workOrderChecklist.findFirst({
      where: { id: checklistId, workOrderId, companyId }
    });

    if (!checklist) {
      return NextResponse.json(
        { error: 'Checklist no encontrado' },
        { status: 404 }
      );
    }

    // Actualizar
    const phases = checklist.phases as any[];
    const totalItems = phases.reduce((sum, p) => sum + (p.items?.length || 0), 0);
    const completedItems = completedPhases
      ? completedPhases.reduce((sum: number, cp: any) => sum + (cp.items?.length || 0), 0)
      : 0;

    const isComplete = markComplete || completedItems >= totalItems;

    const updated = await prisma.workOrderChecklist.update({
      where: { id: checklistId },
      data: {
        completedPhases: completedPhases || checklist.completedPhases,
        status: isComplete ? 'COMPLETED' : 'IN_PROGRESS',
        completedById: isComplete ? userId : null,
        completedAt: isComplete ? new Date() : null
      }
    });

    // Si se completó, registrar en timeline
    if (isComplete && checklist.status !== 'COMPLETED') {
      try {
        await prisma.activityEvent.create({
          data: {
            companyId,
            eventType: 'CHECKLIST_COMPLETED',
            entityType: 'WORK_ORDER',
            entityId: workOrderId,
            newValue: checklist.name,
            metadata: {
              checklistId,
              completedItems,
              totalItems
            },
            performedById: userId
          }
        });
      } catch (e) {
        console.warn('⚠️ No se pudo crear ActivityEvent');
      }
    }

    return NextResponse.json({
      success: true,
      message: isComplete ? 'Checklist completado' : 'Progreso guardado',
      checklist: {
        id: updated.id,
        name: updated.name,
        status: updated.status,
        progress: Math.round((completedItems / totalItems) * 100),
        completedItems,
        totalItems,
        completedAt: updated.completedAt
      }
    });

  } catch (error: any) {
    console.error('❌ Error en PATCH /api/work-orders/[id]/checklists:', error);
    return NextResponse.json(
      { error: 'Error al actualizar checklist', detail: error.message },
      { status: 500 }
    );
  }
}
