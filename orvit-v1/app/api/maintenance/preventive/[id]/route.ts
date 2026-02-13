import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserName, getComponentNames } from '@/lib/maintenance-helpers';

// PUT /api/maintenance/preventive/[id] - Actualizar mantenimiento preventivo
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;
    const body = await request.json();

    // Buscar el template existente
    const existingTemplate = await prisma.document.findFirst({
      where: {
        id: Number(id),
        entityType: 'PREVENTIVE_MAINTENANCE_TEMPLATE'
      }
    });

    if (!existingTemplate) {
      return NextResponse.json(
        { error: 'Mantenimiento preventivo no encontrado' },
        { status: 404 }
      );
    }

    // Parsear los datos existentes
    const existingData = JSON.parse(existingTemplate.url);

    // Procesar assignedToId y obtener el nombre
    let assignedToId = existingData.assignedToId;
    let assignedToName = existingData.assignedToName;
    if (body.assignedToId !== undefined) {
      if (body.assignedToId && body.assignedToId !== 'none') {
        assignedToId = Number(body.assignedToId);
        assignedToName = await getUserName(body.assignedToId);
      } else {
        assignedToId = null;
        assignedToName = null;
      }
    }

    // Procesar componentIds y obtener nombres
    let componentIds = existingData.componentIds || [];
    let componentNames = existingData.componentNames || [];
    if (body.componentIds !== undefined) {
      componentIds = Array.isArray(body.componentIds)
        ? body.componentIds.map((cid: any) => Number(cid)).filter((cid: number) => !isNaN(cid))
        : [];
      if (componentIds.length > 0) {
        componentNames = await getComponentNames(componentIds);
      } else {
        componentNames = [];
      }
    }

    // Procesar subcomponentIds y obtener nombres
    let subcomponentIds = existingData.subcomponentIds || [];
    let subcomponentNames = existingData.subcomponentNames || [];
    if (body.subcomponentIds !== undefined) {
      subcomponentIds = Array.isArray(body.subcomponentIds)
        ? body.subcomponentIds.map((sid: any) => Number(sid)).filter((sid: number) => !isNaN(sid))
        : [];
      if (subcomponentIds.length > 0) {
        subcomponentNames = await getComponentNames(subcomponentIds);
      } else {
        subcomponentNames = [];
      }
    }

    // Combinar datos existentes con los nuevos, procesando campos específicos
    const updatedData = {
      ...existingData,
      // Campos de información general
      title: body.title !== undefined ? body.title : existingData.title,
      description: body.description !== undefined ? body.description : existingData.description,
      priority: body.priority !== undefined ? body.priority : existingData.priority,
      notes: body.notes !== undefined ? body.notes : existingData.notes,
      // Campos de asignación
      assignedToId: assignedToId,
      assignedToName: assignedToName,
      // Campos de equipamiento
      machineId: body.machineId !== undefined ? (body.machineId ? Number(body.machineId) : null) : existingData.machineId,
      unidadMovilId: body.unidadMovilId !== undefined ? (body.unidadMovilId ? Number(body.unidadMovilId) : null) : existingData.unidadMovilId,
      componentIds: componentIds,
      componentNames: componentNames,
      subcomponentIds: subcomponentIds,
      subcomponentNames: subcomponentNames,
      // Campos de programación
      frequencyDays: body.frequencyDays !== undefined ? Number(body.frequencyDays) : existingData.frequencyDays,
      timeValue: body.timeValue !== undefined ? Number(body.timeValue) : existingData.timeValue,
      timeUnit: body.timeUnit !== undefined ? body.timeUnit : existingData.timeUnit,
      executionWindow: body.executionWindow !== undefined ? body.executionWindow : existingData.executionWindow,
      alertDaysBefore: body.alertDaysBefore !== undefined ? body.alertDaysBefore : existingData.alertDaysBefore,
      startDate: body.startDate !== undefined ? body.startDate : existingData.startDate,
      // Campos de herramientas y configuración
      toolsRequired: body.toolsRequired !== undefined ? body.toolsRequired : existingData.toolsRequired,
      isActive: body.isActive !== undefined ? body.isActive : existingData.isActive,
      // Metadatos
      updatedAt: new Date().toISOString()
    };

    // Detectar si cambió la frecuencia para recalcular instancias
    const frequencyChanged = body.frequencyDays !== undefined &&
      Number(body.frequencyDays) !== existingData.frequencyDays;

    // ✅ OPTIMIZADO: Usar transacción atómica para update + instructivos + recálculo
    const updatedTemplate = await prisma.$transaction(async (tx) => {
      // 1. Eliminar instructivos existentes si se envían nuevos
      if (body.instructives && Array.isArray(body.instructives)) {
        await tx.document.deleteMany({
          where: {
            entityType: 'PREVENTIVE_MAINTENANCE_INSTRUCTIVE',
            entityId: id.toString()
          }
        });

        // 2. Crear nuevos instructivos (batch insert)
        const validInstructives = body.instructives.filter(
          (i: any) => i.url && i.originalName
        );
        if (validInstructives.length > 0) {
          await tx.document.createMany({
            data: validInstructives.map((instructive: any) => ({
              originalName: instructive.originalName,
              url: instructive.url,
              entityType: 'PREVENTIVE_MAINTENANCE_INSTRUCTIVE',
              entityId: id.toString(),
              companyId: body.companyId || 1,
              uploadDate: new Date()
            }))
          });
        }
      }

      // 3. Si cambió la frecuencia, recalcular instancias PENDING
      if (frequencyChanged) {
        // Eliminar instancias PENDING existentes
        const existingInstances = await tx.document.findMany({
          where: {
            entityType: 'PREVENTIVE_MAINTENANCE_INSTANCE',
            entityId: { startsWith: `template-${id}-` }
          }
        });

        // Solo eliminar instancias que estén PENDING
        const pendingInstanceIds = existingInstances
          .filter(inst => {
            try {
              const data = JSON.parse(inst.url);
              return data.status === 'PENDING';
            } catch { return false; }
          })
          .map(inst => inst.id);

        if (pendingInstanceIds.length > 0) {
          await tx.document.deleteMany({
            where: { id: { in: pendingInstanceIds } }
          });
        }

        // Calcular nueva fecha base (última ejecución o startDate o hoy)
        const baseDate = existingData.lastMaintenanceDate
          ? new Date(existingData.lastMaintenanceDate)
          : existingData.startDate
            ? new Date(existingData.startDate)
            : new Date();

        const newFrequency = Number(body.frequencyDays);

        // Función helper para ajustar a día laboral
        const adjustToWeekday = (date: Date): Date => {
          const d = new Date(date);
          const dayOfWeek = d.getDay();
          if (dayOfWeek === 0) d.setDate(d.getDate() + 1);
          else if (dayOfWeek === 6) d.setDate(d.getDate() + 2);
          return d;
        };

        // Crear nuevas instancias (próximas 4)
        const newInstances = [];
        for (let i = 1; i <= 4; i++) {
          const scheduledDate = new Date(baseDate);
          scheduledDate.setDate(scheduledDate.getDate() + (i * newFrequency));
          const adjustedDate = adjustToWeekday(scheduledDate);

          newInstances.push({
            entityType: 'PREVENTIVE_MAINTENANCE_INSTANCE',
            entityId: `template-${id}-${adjustedDate.toISOString().split('T')[0]}`,
            originalName: `${updatedData.title} - ${adjustedDate.toLocaleDateString('es-ES')}`,
            url: JSON.stringify({
              ...updatedData,
              templateId: id.toString(),
              scheduledDate: adjustedDate.toISOString(),
              status: 'PENDING',
              actualStartDate: null,
              actualEndDate: null,
              actualHours: null,
              completedById: null,
              completionNotes: '',
              toolsUsed: [],
              photoUrls: [],
              createdAt: new Date().toISOString()
            })
          });
        }

        if (newInstances.length > 0) {
          await tx.document.createMany({ data: newInstances });
        }

        // Actualizar nextMaintenanceDate en updatedData
        const firstInstance = newInstances[0];
        if (firstInstance) {
          const firstData = JSON.parse(firstInstance.url);
          updatedData.nextMaintenanceDate = firstData.scheduledDate;
        }
      }

      // 4. Actualizar el template
      return tx.document.update({
        where: { id: Number(id) },
        data: {
          originalName: `Mantenimiento Preventivo: ${updatedData.title || body.title}`,
          url: JSON.stringify(updatedData)
        }
      });
    });

    return NextResponse.json({
      success: true,
      template: updatedTemplate,
      instancesRecalculated: frequencyChanged,
      message: frequencyChanged
        ? 'Mantenimiento preventivo actualizado. Las instancias pendientes fueron recalculadas con la nueva frecuencia.'
        : 'Mantenimiento preventivo actualizado exitosamente'
    });

  } catch (error) {
    console.error('Error en PUT /api/maintenance/preventive/[id]:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// DELETE /api/maintenance/preventive/[id] - Eliminar mantenimiento preventivo
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;

    // Buscar el template existente
    const existingTemplate = await prisma.document.findFirst({
      where: {
        id: Number(id),
        entityType: 'PREVENTIVE_MAINTENANCE_TEMPLATE'
      }
    });

    if (!existingTemplate) {
      return NextResponse.json(
        { error: 'Mantenimiento preventivo no encontrado' },
        { status: 404 }
      );
    }

    // ✅ OPTIMIZADO: Usar transacción y entityId prefix (más rápido con índice)
    await prisma.$transaction(async (tx) => {
      // 1. Eliminar instancias usando entityId prefix (indexado)
      await tx.document.deleteMany({
        where: {
          entityType: 'PREVENTIVE_MAINTENANCE_INSTANCE',
          entityId: { startsWith: `template-${id}-` }
        }
      });

      // 2. Eliminar instructivos vinculados
      await tx.document.deleteMany({
        where: {
          entityType: 'PREVENTIVE_MAINTENANCE_INSTRUCTIVE',
          entityId: id.toString()
        }
      });

      // 3. Eliminar el template principal
      await tx.document.delete({
        where: { id: Number(id) }
      });
    });

    return NextResponse.json({
      success: true,
      message: 'Mantenimiento preventivo eliminado exitosamente'
    });

  } catch (error) {
    console.error('Error en DELETE /api/maintenance/preventive/[id]:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// GET /api/maintenance/preventive/[id] - Obtener mantenimiento preventivo por ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;

    const template = await prisma.document.findFirst({
      where: {
        id: Number(id),
        entityType: 'PREVENTIVE_MAINTENANCE_TEMPLATE'
      }
    });

    if (!template) {
      return NextResponse.json(
        { error: 'Mantenimiento preventivo no encontrado' },
        { status: 404 }
      );
    }

    const templateData = JSON.parse(template.url);

    // ✅ OPTIMIZADO: Cache headers
    const response = NextResponse.json({
      id: template.id,
      ...templateData
    });
    response.headers.set('Cache-Control', 'private, max-age=30, s-maxage=30');
    return response;

  } catch (error) {
    console.error('Error en GET /api/maintenance/preventive/[id]:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
} 