/**
 * API: /api/failure-occurrences/[id]
 *
 * GET - Obtener una falla por ID
 * PATCH - Actualizar una falla
 * DELETE - Eliminar una falla
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { expandSymptoms } from '@/lib/corrective/symptoms';
import { notifyPriorityEscalated, notifyFailureResolved } from '@/lib/discord/notifications';

export const dynamic = 'force-dynamic';

/**
 * GET /api/failure-occurrences/[id]
 * Obtiene una falla por su ID con todas las relaciones
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
    const id = parseInt(params.id);

    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    // 2. Buscar la falla con todas las relaciones
    const occurrence = await prisma.failureOccurrence.findFirst({
      where: {
        id,
        companyId, // Asegurar que pertenece a la empresa del usuario
      },
      include: {
        machine: {
          select: {
            id: true,
            name: true,
            nickname: true,
            serialNumber: true,
            type: true,
            brand: true,
            model: true,
            status: true,
          },
        },
        reporter: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        workOrder: {
          select: {
            id: true,
            title: true,
            status: true,
            priority: true,
            type: true,
            assignedToId: true,
            scheduledDate: true,
            completedDate: true,
            isSafetyRelated: true,
            componentId: true,
            component: {
              select: {
                id: true,
                name: true,
              },
            },
            assignedTo: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        failureType: {
          select: {
            id: true,
            title: true,
            failure_type: true, // Campo correcto del modelo Failure
            priority: true,
          },
        },
        solutions: {
          select: {
            id: true,
            title: true,
            description: true,
            effectiveness: true,
            isPreferred: true,
            appliedAt: true,
            createdAt: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
        // Ocurrencias vinculadas (duplicados)
        linkedDuplicates: {
          select: {
            id: true,
            title: true,
            reportedAt: true,
            linkedReason: true,
            reporter: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        // SolutionsApplied para el historial real
        solutionsApplied: {
          select: {
            id: true,
            diagnosis: true,
            solution: true,
            outcome: true,
            performedAt: true,
            actualMinutes: true,
            fixType: true,
            effectiveness: true,
            workOrderId: true,
            performedBy: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: {
            performedAt: 'desc',
          },
        },
      },
    });

    if (!occurrence) {
      return NextResponse.json(
        { error: 'Falla no encontrada' },
        { status: 404 }
      );
    }

    // 3. Preparar queries paralelas
    const affectedComponentsData = (occurrence as any).affectedComponents;
    const componentIds = Array.isArray(affectedComponentsData?.componentIds)
      ? affectedComponentsData.componentIds
      : [];
    const subcomponentIds = Array.isArray(affectedComponentsData?.subcomponentIds)
      ? affectedComponentsData.subcomponentIds
      : [];
    const allComponentIds = [...new Set([...componentIds, ...subcomponentIds])];

    // ✅ OPTIMIZADO: Ejecutar queries en paralelo
    const [downtimeLogsResult, componentsResult] = await Promise.allSettled([
      prisma.downtimeLog.findMany({
        where: { failureOccurrenceId: id },
        orderBy: { startedAt: 'desc' },
      }),
      allComponentIds.length > 0
        ? prisma.component.findMany({
            where: { id: { in: allComponentIds } },
            select: { id: true, name: true },
          })
        : Promise.resolve([])
    ]);

    // Procesar resultados
    const downtimeLogs = downtimeLogsResult.status === 'fulfilled' ? downtimeLogsResult.value : [];
    const allComponents = componentsResult.status === 'fulfilled' ? componentsResult.value : [];

    // Separar componentes y subcomponentes
    const components = allComponents.filter((c: any) => componentIds.includes(c.id));
    const subcomponents = allComponents.filter((c: any) => subcomponentIds.includes(c.id));

    // 4. Calcular tiempo desde reporte
    const reportedAt = new Date(occurrence.reportedAt);
    const now = new Date();
    const minutesSinceReport = Math.floor((now.getTime() - reportedAt.getTime()) / 1000 / 60);

    // 5. Expandir síntomas
    const symptomsArray = Array.isArray((occurrence as any).symptoms) ? (occurrence as any).symptoms : [];
    const symptomsList = expandSymptoms(symptomsArray);

    // 7. Transformar respuesta para coincidir con frontend
    // Frontend espera: reportedBy (objeto), workOrders (array), isSafetyRelated, component
    const transformedResponse = {
      ...occurrence,
      // Renombrar reporter a reportedBy para frontend
      reportedBy: occurrence.reporter,
      // Wrap workOrder en array como workOrders
      workOrders: occurrence.workOrder ? [occurrence.workOrder] : [],
      // isSafetyRelated viene del workOrder
      isSafetyRelated: occurrence.workOrder?.isSafetyRelated || false,
      // Componente viene del workOrder (compatibilidad)
      component: occurrence.workOrder?.component || (components.length > 0 ? components[0] : null),
      // Múltiples componentes y subcomponentes
      components: components.length > 0 ? components : (occurrence.workOrder?.component ? [occurrence.workOrder.component] : []),
      subcomponents,
      // Síntomas expandidos con labels
      symptomsList,
      // Transformar linkedDuplicates para tener reportedBy como objeto
      linkedDuplicates: occurrence.linkedDuplicates.map((dup: any) => ({
        ...dup,
        reportedBy: dup.reporter || { id: 0, name: 'Usuario' },
      })),
      // DowntimeLogs
      downtimeLogs,
      // Datos computados
      computed: {
        minutesSinceReport,
        hoursSinceReport: Math.floor(minutesSinceReport / 60),
        hasActiveDowntime: downtimeLogs.some((d: any) => !d.endedAt),
        totalDowntimeMinutes: downtimeLogs
          .filter((d: any) => d.totalMinutes)
          .reduce((sum: number, d: any) => sum + (d.totalMinutes || 0), 0),
      },
    };

    // 7. Retornar
    return NextResponse.json(transformedResponse);
  } catch (error: any) {
    console.error('❌ Error en GET /api/failure-occurrences/[id]:', error);
    console.error('❌ Stack:', error.stack);
    return NextResponse.json(
      {
        error: 'Error al obtener falla',
        detail: error.message,
        code: error.code,
        meta: error.meta
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/failure-occurrences/[id]
 * Actualiza una falla existente
 */
export async function PATCH(
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
    const id = parseInt(params.id);

    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    // 2. Verificar que la falla existe y pertenece a la empresa
    const existing = await prisma.failureOccurrence.findFirst({
      where: { id, companyId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Falla no encontrada' },
        { status: 404 }
      );
    }

    // 3. Parsear body
    const body = await request.json();

    // 4. Campos permitidos para actualizar
    const allowedFields = [
      'title',
      'description',
      'status',
      'priority',
      'failureCategory',
      'isIntermittent',
      'isObservation',
      'causedDowntime',
      'notes',
      'resolvedAt',
    ];

    const updateData: any = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    // 5. Actualizar
    const updated = await prisma.failureOccurrence.update({
      where: { id },
      data: updateData,
      include: {
        machine: {
          select: { id: true, name: true, sectorId: true },
        },
        reporter: {
          select: { id: true, name: true },
        },
        workOrder: {
          select: {
            assignedToId: true,
            assignedTo: { select: { name: true } }
          }
        },
        component: {
          select: { name: true }
        },
        subComponent: {
          select: { name: true }
        }
      },
    });

    console.log(`✅ FailureOccurrence ${id} actualizada:`, Object.keys(updateData));

    // 6. Notificar escalamiento de prioridad si cambió a mayor
    if (body.priority && body.priority !== existing.priority) {
      const priorityOrder = { P1: 1, P2: 2, P3: 3, P4: 4 };
      const oldOrder = priorityOrder[existing.priority as keyof typeof priorityOrder] || 4;
      const newOrder = priorityOrder[body.priority as keyof typeof priorityOrder] || 4;

      // Si la nueva prioridad es mayor (número menor)
      if (newOrder < oldOrder && updated.machine?.sectorId) {
        try {
          await notifyPriorityEscalated({
            failureId: id,
            title: updated.title,
            machineName: updated.machine.name,
            sectorId: updated.machine.sectorId,
            previousPriority: existing.priority || 'P4',
            newPriority: body.priority,
            reason: body.escalationReason, // Campo opcional del body
            assignedToId: updated.workOrder?.assignedToId || undefined,
            assignedTo: updated.workOrder?.assignedTo?.name
          });
        } catch (discordError) {
          console.warn('⚠️ Error enviando notificación de escalamiento:', discordError);
        }
      }
    }

    // 7. Notificar cuando la falla se resuelve
    if (body.status === 'RESOLVED' && existing.status !== 'RESOLVED' && updated.machine?.sectorId) {
      try {
        // Calcular tiempo de resolución
        let resolutionTime: string | undefined;
        if (existing.createdAt) {
          const diffMs = new Date().getTime() - new Date(existing.createdAt).getTime();
          const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
          const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
          resolutionTime = diffHours > 0 ? `${diffHours}h ${diffMins}min` : `${diffMins} min`;
        }

        await notifyFailureResolved({
          id: updated.id,
          title: updated.title,
          machineName: updated.machine.name,
          sectorId: updated.machine.sectorId,
          resolvedBy: payload.name || 'Usuario',
          resolutionTime,
          solution: body.resolution || body.notes,
          component: updated.component?.name,
          subComponent: updated.subComponent?.name
        });
      } catch (discordError) {
        console.warn('⚠️ Error enviando notificación de falla resuelta:', discordError);
      }
    }

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('❌ Error en PATCH /api/failure-occurrences/[id]:', error);
    console.error('❌ Stack:', error.stack);
    return NextResponse.json(
      {
        error: 'Error al actualizar falla',
        detail: error.message,
        code: error.code,
        meta: error.meta
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/failure-occurrences/[id]
 * Elimina una falla (solo si no tiene WorkOrder activa)
 */
export async function DELETE(
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
    const id = parseInt(params.id);

    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    // 2. Verificar que la falla existe
    const existing = await prisma.failureOccurrence.findFirst({
      where: { id, companyId },
      include: {
        workOrder: true,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Falla no encontrada' },
        { status: 404 }
      );
    }

    // 3. No permitir eliminar si tiene WorkOrder en progreso
    if (existing.workOrder && existing.workOrder.status === 'IN_PROGRESS') {
      return NextResponse.json(
        { error: 'No se puede eliminar una falla con orden de trabajo en progreso' },
        { status: 400 }
      );
    }

    // 4. Eliminar
    await prisma.failureOccurrence.delete({
      where: { id },
    });

    console.log(`🗑️ FailureOccurrence ${id} eliminada`);

    return NextResponse.json({ success: true, deletedId: id });
  } catch (error: any) {
    console.error('❌ Error en DELETE /api/failure-occurrences/[id]:', error);
    console.error('❌ Stack:', error.stack);
    return NextResponse.json(
      {
        error: 'Error al eliminar falla',
        detail: error.message,
        code: error.code,
        meta: error.meta
      },
      { status: 500 }
    );
  }
}
