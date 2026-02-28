import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { getUserName } from '@/lib/maintenance-helpers';
import { requirePermission } from '@/lib/auth/shared-helpers';
import {
  createTemplate,
  listTemplates,
  type PreventiveTemplateData,
} from '@/lib/maintenance/preventive-template.repository';

export const dynamic = 'force-dynamic';

// Helper: verificar autenticación y obtener payload
async function getAuth() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) return null;
  return verifyToken(token);
}

// POST /api/maintenance/preventive - Crear mantenimiento preventivo
export async function POST(request: NextRequest) {
  try {
    // Verificar permiso de crear mantenimiento preventivo
    const { user: permUser, error: permError } = await requirePermission('preventive_maintenance.create');
    if (permError) return permError;

    // Autenticación
    const payload = await getAuth();
    if (!payload || !payload.userId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();

    const {
      title,
      description,
      priority,
      frequencyDays,
      estimatedHours,
      machineId,
      unidadMovilId,
      componentIds,
      subcomponentIds,
      assignedToId,
      startDate,
      notes,
      alertDaysBefore,
      isActive,
      companyId,
      sectorId,
      createdById,
      toolsRequired,
      instructives,
      executionWindow,
      timeUnit,
      timeValue
    } = body;

    // Company boundary check: el companyId del body debe coincidir con el del token
    const tokenCompanyId = payload.companyId as number | undefined;
    if (tokenCompanyId && companyId && Number(companyId) !== tokenCompanyId) {
      return NextResponse.json({ error: 'No autorizado para esta empresa' }, { status: 403 });
    }

    // Validaciones
    if (!title || (!machineId && !unidadMovilId) || !frequencyDays || !startDate) {
      return NextResponse.json(
        { error: 'Campos requeridos: título, máquina/unidad móvil, frecuencia y fecha de inicio' },
        { status: 400 }
      );
    }

    if (frequencyDays < 1 || frequencyDays > 365) {
      return NextResponse.json(
        { error: 'La frecuencia debe estar entre 1 y 365 días' },
        { status: 400 }
      );
    }

    // Verificar que la máquina o unidad móvil existe
    let equipment: any = null;
    let equipmentName = '';
    let isMobileUnit = false;

    if (machineId) {
      equipment = await prisma.machine.findUnique({
        where: { id: Number(machineId) },
        include: {
          sector: { select: { id: true, name: true, area: true } }
        }
      });
      equipmentName = equipment?.name || '';
    } else if (unidadMovilId) {
      equipment = await prisma.unidadMovil.findUnique({
        where: { id: Number(unidadMovilId) },
        include: {
          sector: { select: { id: true, name: true, area: true } }
        }
      });
      equipmentName = equipment?.nombre || '';
      isMobileUnit = true;
    }

    if (!equipment) {
      return NextResponse.json(
        { error: isMobileUnit ? 'Unidad móvil no encontrada' : 'Máquina no encontrada' },
        { status: 404 }
      );
    }

    // Verificar componentes si se especifican (solo para máquinas regulares)
    let components: any[] = [];
    if (componentIds && componentIds.length > 0 && machineId) {
      const numericComponentIds = componentIds.map((id: any) => Number(id));
      components = await prisma.component.findMany({
        where: {
          id: { in: numericComponentIds },
          machineId: Number(machineId)
        }
      });
      if (components.length !== componentIds.length) {
        return NextResponse.json(
          { error: 'Algunos componentes no fueron encontrados para esta máquina' },
          { status: 404 }
        );
      }
    }

    // Verificar subcomponentes si se especifican
    let subcomponents: any[] = [];
    if (subcomponentIds && subcomponentIds.length > 0 && componentIds && componentIds.length > 0) {
      const firstComponentId = Number(componentIds[0]);
      const numericSubcomponentIds = subcomponentIds.map((id: any) => Number(id));
      subcomponents = await prisma.component.findMany({
        where: {
          id: { in: numericSubcomponentIds },
          parentId: firstComponentId
        }
      });
      if (subcomponents.length !== subcomponentIds.length) {
        return NextResponse.json(
          { error: 'Algunos subcomponentes no fueron encontrados para este componente' },
          { status: 404 }
        );
      }
    }

    // Calcular la primera fecha ajustada a día laboral
    let effectiveStartDate = startDate;
    if (!effectiveStartDate) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      effectiveStartDate = tomorrow.toISOString().split('T')[0];
    }
    const firstDate = adjustToWeekday(new Date(effectiveStartDate));

    // Generar instancias programadas
    const instanceDates = [firstDate];
    for (let i = 1; i < 4; i++) {
      const nextDate = new Date(effectiveStartDate);
      nextDate.setDate(nextDate.getDate() + (i * Number(frequencyDays)));
      instanceDates.push(adjustToWeekday(nextDate));
    }

    // Crear template con instancias usando el repositorio
    const templateData: PreventiveTemplateData = {
      title,
      description,
      priority,
      notes,
      machineId: machineId ? Number(machineId) : null,
      machineName: equipmentName,
      unidadMovilId: unidadMovilId ? Number(unidadMovilId) : null,
      isMobileUnit,
      componentIds: componentIds?.length > 0 ? componentIds.map((id: any) => Number(id)) : [],
      componentNames: components.map(c => c.name),
      subcomponentIds: subcomponentIds?.length > 0 ? subcomponentIds.map((id: any) => Number(id)) : [],
      subcomponentNames: subcomponents.map(s => s.name),
      frequencyDays: Number(frequencyDays),
      nextMaintenanceDate: firstDate,
      estimatedHours: estimatedHours ? Number(estimatedHours) : null,
      timeUnit: timeUnit || 'HOURS',
      timeValue: timeValue || 1,
      executionWindow: executionWindow || 'ANY_TIME',
      toolsRequired: toolsRequired || [],
      assignedToId: assignedToId ? Number(assignedToId) : null,
      assignedToName: assignedToId ? await getUserName(assignedToId) : null,
      companyId: Number(companyId),
      sectorId: sectorId ? Number(sectorId) : null,
      createdById: createdById ? Number(createdById) : null,
      isActive: isActive ?? true,
      alertDaysBefore: Array.isArray(alertDaysBefore) ? alertDaysBefore : [alertDaysBefore ?? 3],
      instructives: instructives || [],
    };

    const instances = instanceDates.map(date => ({
      templateId: 0, // Se asigna en createTemplate
      scheduledDate: date,
      status: 'PENDING',
    }));

    const template = await createTemplate(templateData, instances);

    // Obtener las instancias creadas
    const createdInstances = await prisma.preventiveInstance.findMany({
      where: { templateId: template.id },
      orderBy: { scheduledDate: 'asc' },
    });

    return NextResponse.json({
      success: true,
      template: {
        id: template.id,
        title,
        machine: equipmentName,
        frequency: `${frequencyDays} días`,
        nextMaintenance: firstDate.toISOString(),
        weekdaysOnly: true,
        isMobileUnit
      },
      instances: createdInstances.map(i => ({
        id: i.id,
        scheduledDate: i.scheduledDate.toISOString(),
        status: i.status
      })),
      message: `Mantenimiento preventivo creado para ${isMobileUnit ? 'unidad móvil' : 'máquina'}. Las fechas se ajustaron automáticamente a días laborables (lunes a viernes).`
    });

  } catch (error) {
    console.error('Error en POST /api/maintenance/preventive:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// GET /api/maintenance/preventive - Obtener mantenimientos preventivos
export async function GET(request: NextRequest) {
  try {
    // Autenticación
    const payload = await getAuth();
    if (!payload || !payload.userId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const machineId = searchParams.get('machineId');

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId es requerido' },
        { status: 400 }
      );
    }

    // Company boundary check
    const tokenCompanyId = payload.companyId as number | undefined;
    if (tokenCompanyId && Number(companyId) !== tokenCompanyId) {
      return NextResponse.json({ error: 'No autorizado para esta empresa' }, { status: 403 });
    }

    const templates = await listTemplates({
      companyId: Number(companyId),
      machineId: machineId ? Number(machineId) : undefined,
      includeInstances: true,
    });

    if (templates.length === 0) {
      return NextResponse.json([]);
    }

    // Batch query para instructivos legacy (archivos S3 en Document)
    const templateIdsWithLegacy = templates
      .filter(t => t.legacyDocumentId != null)
      .map(t => t.legacyDocumentId!);

    let instructivesByTemplate = new Map<number, any[]>();
    if (templateIdsWithLegacy.length > 0) {
      const legacyInstructives = await prisma.document.findMany({
        where: {
          entityType: 'PREVENTIVE_MAINTENANCE_INSTRUCTIVE',
          entityId: { in: templateIdsWithLegacy.map(id => id.toString()) }
        },
        orderBy: { createdAt: 'asc' }
      });

      for (const inst of legacyInstructives) {
        const legacyId = Number(inst.entityId);
        if (!instructivesByTemplate.has(legacyId)) {
          instructivesByTemplate.set(legacyId, []);
        }
        instructivesByTemplate.get(legacyId)!.push({
          id: inst.id,
          fileName: inst.originalName,
          url: inst.url,
          uploadedAt: inst.createdAt,
        });
      }
    }

    // Construir respuesta compatible con el formato legacy
    const result = templates.map(template => ({
      id: template.id,
      templateType: 'PREVENTIVE_MAINTENANCE',
      title: template.title,
      description: template.description,
      priority: template.priority,
      notes: template.notes,
      machineId: template.machineId,
      machineName: template.machineName ?? template.machine?.name ?? null,
      machine: template.machine ?? null,
      unidadMovilId: template.unidadMovilId,
      isMobileUnit: template.isMobileUnit,
      componentIds: template.componentIds,
      componentNames: template.componentNames,
      subcomponentIds: template.subcomponentIds,
      subcomponentNames: template.subcomponentNames,
      frequencyDays: template.frequencyDays,
      nextMaintenanceDate: template.nextMaintenanceDate?.toISOString() ?? null,
      lastMaintenanceDate: template.lastMaintenanceDate?.toISOString() ?? null,
      weekdaysOnly: template.weekdaysOnly,
      estimatedHours: template.estimatedHours,
      timeUnit: template.timeUnit,
      timeValue: template.timeValue,
      executionWindow: template.executionWindow,
      toolsRequired: template.toolsRequired,
      assignedToId: template.assignedToId,
      assignedToName: template.assignedToName ?? template.assignedTo?.name ?? null,
      companyId: template.companyId,
      sectorId: template.sectorId,
      createdById: template.createdById,
      isActive: template.isActive,
      maintenanceCount: template.maintenanceCount,
      alertDaysBefore: template.alertDaysBefore,
      averageDuration: template.averageDuration,
      lastExecutionDuration: template.lastExecutionDuration,
      executionHistory: template.executionHistory,
      instructives: template.instructives,
      createdAt: template.createdAt.toISOString(),
      // Instancias y archivos
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
        toolsUsed: inst.toolsUsed,
        photoUrls: inst.photoUrls,
      })),
      instructivesFiles: template.legacyDocumentId
        ? (instructivesByTemplate.get(template.legacyDocumentId) || [])
        : [],
    }));

    const response = NextResponse.json(result);
    response.headers.set('Cache-Control', 'private, max-age=30, s-maxage=30');
    return response;

  } catch (error) {
    console.error('Error en GET /api/maintenance/preventive:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// Función helper para ajustar fecha a día laboral (lunes a viernes)
function adjustToWeekday(date: Date): Date {
  const dayOfWeek = date.getDay(); // 0 = domingo, 6 = sábado
  if (dayOfWeek === 0) {
    date.setDate(date.getDate() + 1);
  } else if (dayOfWeek === 6) {
    date.setDate(date.getDate() + 2);
  }
  return date;
}
