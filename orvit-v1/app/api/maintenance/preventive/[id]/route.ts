import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { getUserName, getComponentNames } from '@/lib/maintenance-helpers';
import { requirePermission } from '@/lib/auth/shared-helpers';
import {
  getTemplateById,
  updateTemplate,
  deleteTemplate,
  templateToLegacyJson,
} from '@/lib/maintenance/preventive-template.repository';

// Helper: verificar autenticación
async function getAuth() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) return null;
  return verifyToken(token);
}

// GET /api/maintenance/preventive/[id] - Obtener mantenimiento preventivo por ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const payload = await getAuth();
    if (!payload || !payload.userId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const id = Number(params.id);
    const template = await getTemplateById(id);

    if (!template) {
      return NextResponse.json(
        { error: 'Mantenimiento preventivo no encontrado' },
        { status: 404 }
      );
    }

    // Company boundary check
    const tokenCompanyId = payload.companyId as number | undefined;
    if (tokenCompanyId && template.companyId !== tokenCompanyId) {
      return NextResponse.json({ error: 'No autorizado para esta empresa' }, { status: 403 });
    }

    const legacyData = templateToLegacyJson(template);

    const response = NextResponse.json({
      id: template.id,
      ...legacyData,
      instances: (template.instances ?? []).map(inst => ({
        id: inst.id,
        templateId: inst.templateId,
        scheduledDate: inst.scheduledDate.toISOString(),
        status: inst.status,
        actualStartDate: inst.actualStartDate?.toISOString() ?? null,
        actualEndDate: inst.actualEndDate?.toISOString() ?? null,
        actualHours: inst.actualHours,
        completedById: inst.completedById,
        completionNotes: inst.completionNotes,
      })),
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

// PUT /api/maintenance/preventive/[id] - Actualizar mantenimiento preventivo
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verificar permiso de editar mantenimiento preventivo
    const { user: permUser, error: permError } = await requirePermission('preventive_maintenance.edit');
    if (permError) return permError;

    const payload = await getAuth();
    if (!payload || !payload.userId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const id = Number(params.id);
    const body = await request.json();

    // Verificar que existe
    const existing = await prisma.preventiveTemplate.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: 'Mantenimiento preventivo no encontrado' },
        { status: 404 }
      );
    }

    // Company boundary check
    const tokenCompanyId = payload.companyId as number | undefined;
    if (tokenCompanyId && existing.companyId !== tokenCompanyId) {
      return NextResponse.json({ error: 'No autorizado para esta empresa' }, { status: 403 });
    }

    // Procesar assignedToId
    let assignedToId = existing.assignedToId;
    let assignedToName = existing.assignedToName;
    if (body.assignedToId !== undefined) {
      if (body.assignedToId && body.assignedToId !== 'none') {
        assignedToId = Number(body.assignedToId);
        assignedToName = await getUserName(body.assignedToId);
      } else {
        assignedToId = null;
        assignedToName = null;
      }
    }

    // Procesar componentIds
    let componentIds = existing.componentIds;
    let componentNames = existing.componentNames;
    if (body.componentIds !== undefined) {
      componentIds = Array.isArray(body.componentIds)
        ? body.componentIds.map((cid: any) => Number(cid)).filter((cid: number) => !isNaN(cid))
        : [];
      componentNames = componentIds.length > 0 ? await getComponentNames(componentIds) : [];
    }

    // Procesar subcomponentIds
    let subcomponentIds = existing.subcomponentIds;
    let subcomponentNames = existing.subcomponentNames;
    if (body.subcomponentIds !== undefined) {
      subcomponentIds = Array.isArray(body.subcomponentIds)
        ? body.subcomponentIds.map((sid: any) => Number(sid)).filter((sid: number) => !isNaN(sid))
        : [];
      subcomponentNames = subcomponentIds.length > 0 ? await getComponentNames(subcomponentIds) : [];
    }

    // Detectar cambio de frecuencia para recalcular instancias
    const frequencyChanged = body.frequencyDays !== undefined &&
      Number(body.frequencyDays) !== existing.frequencyDays;

    // Actualizar template
    const updateData: Record<string, any> = {};
    if (body.title !== undefined) updateData.title = body.title;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.priority !== undefined) updateData.priority = body.priority;
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (body.machineId !== undefined) updateData.machineId = body.machineId ? Number(body.machineId) : null;
    if (body.unidadMovilId !== undefined) updateData.unidadMovilId = body.unidadMovilId ? Number(body.unidadMovilId) : null;
    updateData.assignedToId = assignedToId;
    updateData.assignedToName = assignedToName;
    updateData.componentIds = componentIds;
    updateData.componentNames = componentNames;
    updateData.subcomponentIds = subcomponentIds;
    updateData.subcomponentNames = subcomponentNames;
    if (body.frequencyDays !== undefined) updateData.frequencyDays = Number(body.frequencyDays);
    if (body.timeValue !== undefined) updateData.timeValue = Number(body.timeValue);
    if (body.timeUnit !== undefined) updateData.timeUnit = body.timeUnit;
    if (body.executionWindow !== undefined) updateData.executionWindow = body.executionWindow;
    if (body.alertDaysBefore !== undefined) updateData.alertDaysBefore = body.alertDaysBefore;
    if (body.toolsRequired !== undefined) updateData.toolsRequired = body.toolsRequired;
    if (body.isActive !== undefined) updateData.isActive = body.isActive;
    if (body.instructives !== undefined) updateData.instructives = body.instructives;

    const updatedTemplate = await updateTemplate(
      id,
      updateData,
      frequencyChanged
    );

    // Actualizar instructivos legacy en Document si se envían nuevos
    if (body.instructives && Array.isArray(body.instructives) && existing.legacyDocumentId) {
      await prisma.$transaction(async (tx) => {
        await tx.document.deleteMany({
          where: {
            entityType: 'PREVENTIVE_MAINTENANCE_INSTRUCTIVE',
            entityId: existing.legacyDocumentId!.toString()
          }
        });

        const validInstructives = body.instructives.filter(
          (i: any) => i.url && i.originalName
        );
        if (validInstructives.length > 0) {
          await tx.document.createMany({
            data: validInstructives.map((instructive: any) => ({
              originalName: instructive.originalName,
              url: instructive.url,
              entityType: 'PREVENTIVE_MAINTENANCE_INSTRUCTIVE',
              entityId: existing.legacyDocumentId!.toString(),
              companyId: existing.companyId,
              uploadDate: new Date()
            }))
          });
        }
      });
    }

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
    // Verificar permiso de eliminar mantenimiento preventivo
    const { user: permUser, error: permError } = await requirePermission('preventive_maintenance.delete');
    if (permError) return permError;

    const payload = await getAuth();
    if (!payload || !payload.userId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const id = Number(params.id);

    const existing = await prisma.preventiveTemplate.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: 'Mantenimiento preventivo no encontrado' },
        { status: 404 }
      );
    }

    // Company boundary check
    const tokenCompanyId = payload.companyId as number | undefined;
    if (tokenCompanyId && existing.companyId !== tokenCompanyId) {
      return NextResponse.json({ error: 'No autorizado para esta empresa' }, { status: 403 });
    }

    // Eliminar documentos legacy asociados si existen
    if (existing.legacyDocumentId) {
      await prisma.$transaction(async (tx) => {
        await tx.document.deleteMany({
          where: {
            entityType: 'PREVENTIVE_MAINTENANCE_INSTANCE',
            entityId: { startsWith: `template-${existing.legacyDocumentId}-` }
          }
        });
        await tx.document.deleteMany({
          where: {
            entityType: 'PREVENTIVE_MAINTENANCE_INSTRUCTIVE',
            entityId: existing.legacyDocumentId!.toString()
          }
        });
        // No eliminar el Document legacy, se mantiene como referencia
      });
    }

    // Eliminar template (cascade elimina instancias)
    await deleteTemplate(id);

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
