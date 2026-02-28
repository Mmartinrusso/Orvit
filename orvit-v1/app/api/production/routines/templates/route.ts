import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth/shared-helpers';
import { PRODUCCION_PERMISSIONS } from '@/lib/permissions';
import { validateRequest } from '@/lib/validations/helpers';
import { CreateRoutineTemplateSchema } from '@/lib/validations/production';

export const dynamic = 'force-dynamic';

// GET /api/production/routines/templates - List routine templates
export async function GET(request: Request) {
  try {
    const { user, error } = await requirePermission(PRODUCCION_PERMISSIONS.RUTINAS.VIEW);
    if (error) return error;
    const companyId = user!.companyId;
    const { searchParams } = new URL(request.url);

    const type = searchParams.get('type');
    const workCenterId = searchParams.get('workCenterId');
    const activeOnly = searchParams.get('activeOnly') === 'true';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    const where: any = { companyId };

    if (type) where.type = type;
    if (workCenterId) where.workCenterId = parseInt(workCenterId);
    if (activeOnly) where.isActive = true;

    const [rawTemplates, total] = await Promise.all([
      prisma.productionRoutineTemplate.findMany({
        where,
        include: {
          workCenter: {
            select: { id: true, name: true, code: true }
          },
          sector: {
            select: { id: true, name: true }
          },
          _count: {
            select: { executions: true }
          }
        },
        orderBy: { name: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.productionRoutineTemplate.count({ where }),
    ]);

    // Transform templates to include itemsStructure at top level
    const templates = rawTemplates.map((template) => {
      const itemsData = template.items as any;
      // Check if it's the new format (object with itemsStructure) or old format (array)
      const isNewFormat = itemsData && typeof itemsData === 'object' && !Array.isArray(itemsData) && 'itemsStructure' in itemsData;

      return {
        ...template,
        itemsStructure: isNewFormat ? itemsData.itemsStructure : 'flat',
        items: isNewFormat ? itemsData.items : itemsData,
        groups: isNewFormat ? itemsData.groups : null,
        sections: isNewFormat ? itemsData.sections : [],
        preExecutionInputs: isNewFormat ? itemsData.preExecutionInputs : [],
        scheduleConfig: isNewFormat ? itemsData.scheduleConfig : null,
      };
    });

    return NextResponse.json({
      success: true,
      templates,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching routine templates:', error);
    return NextResponse.json(
      { success: false, error: 'Error al obtener plantillas de rutinas' },
      { status: 500 }
    );
  }
}

// POST /api/production/routines/templates - Create routine template
export async function POST(request: Request) {
  try {
    const { user, error } = await requirePermission(PRODUCCION_PERMISSIONS.RUTINAS.MANAGE);
    if (error) return error;
    const companyId = user!.companyId;
    const body = await request.json();

    const validation = validateRequest(CreateRoutineTemplateSchema, body);
    if (!validation.success) return validation.response;

    const { code, name, type, workCenterId, sectorId, items, groups, sections, itemsStructure, preExecutionInputs, scheduleConfig, frequency, isActive, maxCompletionTimeMinutes, enableCompletionReminders } = validation.data;

    // Check for duplicate code
    const existing = await prisma.productionRoutineTemplate.findFirst({
      where: { companyId, code },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: 'Ya existe una plantilla con ese código' },
        { status: 400 }
      );
    }

    // Prepare items data - store items, groups, sections, preExecutionInputs and scheduleConfig in the items field as JSON
    const itemsData = {
      itemsStructure: itemsStructure || 'flat',
      items: items || [],
      groups: groups || null,
      sections: sections || [],
      preExecutionInputs: preExecutionInputs || [],
      scheduleConfig: scheduleConfig || null,
    };

    const template = await prisma.productionRoutineTemplate.create({
      data: {
        code,
        name,
        type,
        workCenterId: workCenterId || null,
        sectorId: sectorId || null,
        items: itemsData,
        frequency: frequency || 'EVERY_SHIFT',
        isActive: isActive !== false,
        maxCompletionTimeMinutes: maxCompletionTimeMinutes || 60,
        enableCompletionReminders: enableCompletionReminders !== false,
        companyId,
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

    return NextResponse.json({ success: true, template: responseTemplate }, { status: 201 });
  } catch (error) {
    console.error('Error creating routine template:', error);
    return NextResponse.json(
      { success: false, error: 'Error al crear plantilla de rutina' },
      { status: 500 }
    );
  }
}
