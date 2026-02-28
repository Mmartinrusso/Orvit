import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth/shared-helpers';
import { PRODUCCION_PERMISSIONS } from '@/lib/permissions';
import { validateRequest } from '@/lib/validations/helpers';
import { UpdateRoutineTemplateSchema } from '@/lib/validations/production';

export const dynamic = 'force-dynamic';

// GET /api/production/routines/templates/[id] - Get template by ID
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await requirePermission(PRODUCCION_PERMISSIONS.RUTINAS.VIEW);
    if (error) return error;
    const companyId = user!.companyId;
    const id = parseInt(params.id);

    const template = await prisma.productionRoutineTemplate.findFirst({
      where: { id, companyId },
      include: {
        workCenter: {
          select: { id: true, name: true, code: true }
        },
        sector: {
          select: { id: true, name: true }
        },
        executions: {
          take: 10,
          orderBy: { executedAt: 'desc' },
          include: {
            executedBy: { select: { id: true, name: true } },
            shift: { select: { id: true, name: true } },
          }
        },
        _count: {
          select: { executions: true }
        }
      },
    });

    if (!template) {
      return NextResponse.json(
        { success: false, error: 'Plantilla no encontrada' },
        { status: 404 }
      );
    }

    // Transform template to include itemsStructure at top level
    const itemsData = template.items as any;
    const isNewFormat = itemsData && typeof itemsData === 'object' && !Array.isArray(itemsData) && 'itemsStructure' in itemsData;

    const transformedTemplate = {
      ...template,
      itemsStructure: isNewFormat ? itemsData.itemsStructure : 'flat',
      items: isNewFormat ? itemsData.items : itemsData,
      groups: isNewFormat ? itemsData.groups : null,
      sections: isNewFormat ? itemsData.sections : [],
      preExecutionInputs: isNewFormat ? itemsData.preExecutionInputs : [],
      scheduleConfig: isNewFormat ? itemsData.scheduleConfig : null,
    };

    return NextResponse.json({ success: true, template: transformedTemplate });
  } catch (error) {
    console.error('Error fetching routine template:', error);
    return NextResponse.json(
      { success: false, error: 'Error al obtener plantilla' },
      { status: 500 }
    );
  }
}

// PUT /api/production/routines/templates/[id] - Update template
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await requirePermission(PRODUCCION_PERMISSIONS.RUTINAS.MANAGE);
    if (error) return error;
    const companyId = user!.companyId;
    const id = parseInt(params.id);
    const body = await request.json();

    const validation = validateRequest(UpdateRoutineTemplateSchema, body);
    if (!validation.success) return validation.response;

    const existing = await prisma.productionRoutineTemplate.findFirst({
      where: { id, companyId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Plantilla no encontrada' },
        { status: 404 }
      );
    }

    const validated = validation.data;

    // Check for duplicate code (if changing)
    if (validated.code && validated.code !== existing.code) {
      const duplicate = await prisma.productionRoutineTemplate.findFirst({
        where: { companyId, code: validated.code, NOT: { id } },
      });

      if (duplicate) {
        return NextResponse.json(
          { success: false, error: 'Ya existe una plantilla con ese código' },
          { status: 400 }
        );
      }
    }

    // Prepare items data - store itemsStructure, items, groups, sections, preExecutionInputs and scheduleConfig together
    let itemsData = existing.items;
    if (validated.items !== undefined || validated.groups !== undefined || validated.sections !== undefined || validated.itemsStructure !== undefined || validated.preExecutionInputs !== undefined || validated.scheduleConfig !== undefined) {
      const existingData = (existing.items as any) || {};
      itemsData = {
        itemsStructure: validated.itemsStructure || existingData.itemsStructure || 'flat',
        items: validated.items !== undefined ? validated.items : (existingData.items || []),
        groups: validated.groups !== undefined ? validated.groups : (existingData.groups || null),
        sections: validated.sections !== undefined ? validated.sections : (existingData.sections || []),
        preExecutionInputs: validated.preExecutionInputs !== undefined ? validated.preExecutionInputs : (existingData.preExecutionInputs || []),
        scheduleConfig: validated.scheduleConfig !== undefined ? validated.scheduleConfig : (existingData.scheduleConfig || null),
      };
    }

    const template = await prisma.productionRoutineTemplate.update({
      where: { id },
      data: {
        code: validated.code || existing.code,
        name: validated.name || existing.name,
        type: validated.type || existing.type,
        workCenterId: validated.workCenterId !== undefined
          ? (validated.workCenterId || null)
          : existing.workCenterId,
        sectorId: validated.sectorId !== undefined
          ? (validated.sectorId || null)
          : existing.sectorId,
        items: itemsData,
        frequency: validated.frequency || existing.frequency,
        isActive: validated.isActive !== undefined ? validated.isActive : existing.isActive,
        maxCompletionTimeMinutes: validated.maxCompletionTimeMinutes !== undefined
          ? validated.maxCompletionTimeMinutes
          : existing.maxCompletionTimeMinutes,
        enableCompletionReminders: validated.enableCompletionReminders !== undefined
          ? validated.enableCompletionReminders
          : existing.enableCompletionReminders,
      },
      include: {
        workCenter: {
          select: { id: true, name: true, code: true }
        },
        sector: {
          select: { id: true, name: true }
        },
      },
    });

    // Transform response to include itemsStructure at top level
    const responseTemplate = {
      ...template,
      itemsStructure: (template.items as any)?.itemsStructure || 'flat',
      items: (template.items as any)?.items || template.items,
      groups: (template.items as any)?.groups || null,
      sections: (template.items as any)?.sections || [],
      preExecutionInputs: (template.items as any)?.preExecutionInputs || [],
      scheduleConfig: (template.items as any)?.scheduleConfig || null,
    };

    return NextResponse.json({ success: true, template: responseTemplate });
  } catch (error) {
    console.error('Error updating routine template:', error);
    return NextResponse.json(
      { success: false, error: 'Error al actualizar plantilla' },
      { status: 500 }
    );
  }
}

// DELETE /api/production/routines/templates/[id] - Delete template
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await requirePermission(PRODUCCION_PERMISSIONS.RUTINAS.MANAGE);
    if (error) return error;
    const companyId = user!.companyId;
    const id = parseInt(params.id);

    const existing = await prisma.productionRoutineTemplate.findFirst({
      where: { id, companyId },
      include: { _count: { select: { executions: true } } }
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Plantilla no encontrada' },
        { status: 404 }
      );
    }

    const executionCount = existing._count.executions;

    // Cascade delete: remove executions first, then the template
    await prisma.$transaction(async (tx) => {
      await tx.productionRoutine.deleteMany({ where: { templateId: id } });
      await tx.productionRoutineTemplate.delete({ where: { id } });
    });

    return NextResponse.json({
      success: true,
      message: executionCount > 0
        ? `Plantilla eliminada junto con ${executionCount} ejecución(es)`
        : 'Plantilla eliminada',
    });
  } catch (error) {
    console.error('Error deleting routine template:', error);
    return NextResponse.json(
      { success: false, error: 'Error al eliminar plantilla' },
      { status: 500 }
    );
  }
}
