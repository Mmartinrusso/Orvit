import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserName } from '@/lib/maintenance-helpers';

export const dynamic = 'force-dynamic';

// POST /api/maintenance/preventive - Crear mantenimiento preventivo
export async function POST(request: NextRequest) {
  try {
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
          sector: {
            select: {
              id: true,
              name: true,
              area: true
            }
          }
        }
      });
      equipmentName = equipment?.name || '';
    } else if (unidadMovilId) {
      equipment = await prisma.unidadMovil.findUnique({
        where: { id: Number(unidadMovilId) },
        include: {
          sector: {
            select: {
              id: true,
              name: true,
              area: true
            }
          }
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
      // Convertir todos los IDs a números para la consulta
      const numericComponentIds = componentIds.map(id => Number(id));
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
      // Convertir todos los IDs a números para la consulta
      const numericSubcomponentIds = subcomponentIds.map(id => Number(id));
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

    // Establecer fecha de inicio por defecto si no se proporciona
    let effectiveStartDate = startDate;
    if (!effectiveStartDate) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      effectiveStartDate = tomorrow.toISOString().split('T')[0];
    }

    // Calcular la primera fecha ajustada a día laboral
    const firstDate = adjustToWeekday(new Date(effectiveStartDate));
    
    // Crear el template de mantenimiento preventivo
    const templateData = {
      templateType: 'PREVENTIVE_MAINTENANCE',
      title,
      description,
      priority,
      frequencyDays: Number(frequencyDays),
      estimatedHours: estimatedHours ? Number(estimatedHours) : null,
      alertDaysBefore: Array.isArray(alertDaysBefore) ? alertDaysBefore : [alertDaysBefore],
      machineId: machineId ? Number(machineId) : null,
      unidadMovilId: unidadMovilId ? Number(unidadMovilId) : null,
      machineName: equipmentName,
      componentIds: componentIds && componentIds.length > 0 ? componentIds.map((id: any) => Number(id)) : [],
      componentNames: components.length > 0 ? components.map(c => c.name) : [],
      subcomponentIds: subcomponentIds && subcomponentIds.length > 0 ? subcomponentIds.map((id: any) => Number(id)) : [],
      subcomponentNames: subcomponents.length > 0 ? subcomponents.map(s => s.name) : [],
      executionWindow: executionWindow || 'ANY_TIME',
      timeUnit: timeUnit || 'HOURS',
      timeValue: timeValue || 1,
      assignedToId: assignedToId ? Number(assignedToId) : null,
      assignedToName: assignedToId ? await getUserName(assignedToId) : null,
      companyId: Number(companyId),
      sectorId: Number(sectorId),
      createdById: Number(createdById),
      notes,
      isActive,
      toolsRequired: toolsRequired || [],
      instructives: instructives || [],
      nextMaintenanceDate: firstDate.toISOString(),
      lastMaintenanceDate: null,
      weekdaysOnly: true, // Indicar que solo se programa en días laborables
      maintenanceCount: 0,
      createdAt: new Date().toISOString(),
      isMobileUnit: isMobileUnit
    };

    // ✅ OPTIMIZADO: Usar transacción atómica para crear template + instructivos + instancias
    const result = await prisma.$transaction(async (tx) => {
      // 1. Crear template
      const preventiveTemplate = await tx.document.create({
        data: {
          entityType: 'PREVENTIVE_MAINTENANCE_TEMPLATE',
          entityId: isMobileUnit ?
            `mobile-${unidadMovilId}` :
            `machine-${machineId}${componentIds && componentIds.length > 0 ? `-components-${componentIds.join('-')}` : ''}${subcomponentIds && subcomponentIds.length > 0 ? `-subcomponents-${subcomponentIds.join('-')}` : ''}`,
          originalName: `Mantenimiento Preventivo: ${title}`,
          url: JSON.stringify(templateData)
        }
      });

      // 2. Guardar instructivos (batch insert)
      if (instructives && instructives.length > 0) {
        await tx.document.createMany({
          data: instructives.map((instructive: any) => ({
            entityType: 'PREVENTIVE_MAINTENANCE_INSTRUCTIVE',
            entityId: preventiveTemplate.id.toString(),
            originalName: instructive.originalName || instructive.fileName,
            url: instructive.url,
          }))
        });
      }

      // 3. Crear instancias programadas (batch insert)
      const instanceDates = [firstDate];
      for (let i = 1; i < 4; i++) {
        const nextDate = new Date(effectiveStartDate);
        nextDate.setDate(nextDate.getDate() + (i * Number(frequencyDays)));
        instanceDates.push(adjustToWeekday(nextDate));
      }

      const instancesData = instanceDates.map(scheduledDate => ({
        entityType: 'PREVENTIVE_MAINTENANCE_INSTANCE',
        entityId: `template-${preventiveTemplate.id}-${scheduledDate.toISOString().split('T')[0]}`,
        originalName: `${templateData.title} - ${scheduledDate.toLocaleDateString('es-ES')}`,
        url: JSON.stringify({
          ...templateData,
          templateId: preventiveTemplate.id.toString(),
          scheduledDate: scheduledDate.toISOString(),
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
      }));

      await tx.document.createMany({ data: instancesData });

      // 4. Obtener las instancias creadas para la respuesta
      const instances = await tx.document.findMany({
        where: {
          entityType: 'PREVENTIVE_MAINTENANCE_INSTANCE',
          entityId: { startsWith: `template-${preventiveTemplate.id}-` }
        },
        orderBy: { createdAt: 'asc' }
      });

      return { preventiveTemplate, instances };
    });

    const { preventiveTemplate, instances } = result;

    return NextResponse.json({
      success: true,
      template: {
        id: preventiveTemplate.id,
        title,
        machine: equipmentName,
        frequency: `${frequencyDays} días`,
        nextMaintenance: firstDate.toISOString(),
        weekdaysOnly: true,
        isMobileUnit
      },
      instances: instances.map(i => ({
        id: i.id,
        scheduledDate: JSON.parse(i.url).scheduledDate,
        status: JSON.parse(i.url).status
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
// ✅ OPTIMIZADO: Batch queries en lugar de N+1

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const machineId = searchParams.get('machineId');

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId es requerido' },
        { status: 400 }
      );
    }

    // ✅ OPTIMIZADO: Filtrar por companyId en la query usando contains en el JSON
    const templates = await prisma.document.findMany({
      where: {
        entityType: 'PREVENTIVE_MAINTENANCE_TEMPLATE',
        url: { contains: `"companyId":${companyId}` }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Filtrar por machineId si se especifica (en memoria, ya que el set es pequeño)
    const filteredTemplates = machineId
      ? templates.filter(t => {
          try {
            return JSON.parse(t.url).machineId === Number(machineId);
          } catch { return false; }
        })
      : templates;

    if (filteredTemplates.length === 0) {
      return NextResponse.json([]);
    }

    // ✅ OPTIMIZADO: Batch query para instancias e instructivos
    const templateIds = filteredTemplates.map(t => t.id);

    const [allInstances, allInstructives] = await Promise.all([
      // Todas las instancias de los templates filtrados
      prisma.document.findMany({
        where: {
          entityType: 'PREVENTIVE_MAINTENANCE_INSTANCE',
          OR: templateIds.map(id => ({
            entityId: { startsWith: `template-${id}` }
          }))
        },
        orderBy: { createdAt: 'asc' }
      }),
      // Todos los instructivos de los templates filtrados
      prisma.document.findMany({
        where: {
          entityType: 'PREVENTIVE_MAINTENANCE_INSTRUCTIVE',
          entityId: { in: templateIds.map(id => id.toString()) }
        },
        orderBy: { createdAt: 'asc' }
      })
    ]);

    // Indexar instancias e instructivos por templateId
    const instancesByTemplate = new Map<number, any[]>();
    const instructivesByTemplate = new Map<number, any[]>();

    for (const instance of allInstances) {
      // Extraer templateId del entityId (formato: template-{id}-{date})
      const match = instance.entityId.match(/^template-(\d+)/);
      if (match) {
        const templateId = Number(match[1]);
        if (!instancesByTemplate.has(templateId)) {
          instancesByTemplate.set(templateId, []);
        }
        try {
          instancesByTemplate.get(templateId)!.push(JSON.parse(instance.url));
        } catch {}
      }
    }

    for (const instructive of allInstructives) {
      const templateId = Number(instructive.entityId);
      if (!instructivesByTemplate.has(templateId)) {
        instructivesByTemplate.set(templateId, []);
      }
      instructivesByTemplate.get(templateId)!.push({
        id: instructive.id,
        fileName: instructive.originalName,
        url: instructive.url,
        uploadedAt: instructive.createdAt
      });
    }

    // Construir respuesta
    const result = filteredTemplates.map(template => {
      const templateData = JSON.parse(template.url);
      return {
        id: template.id,
        ...templateData,
        instances: instancesByTemplate.get(template.id) || [],
        instructivesFiles: instructivesByTemplate.get(template.id) || []
      };
    });

    // ✅ OPTIMIZADO: Cache headers para reducir requests
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
  if (dayOfWeek === 0) { // Si es domingo, mover a lunes
    date.setDate(date.getDate() + 1);
  } else if (dayOfWeek === 6) { // Si es sábado, mover a lunes
    date.setDate(date.getDate() + 2);
  }
  return date;
}

 