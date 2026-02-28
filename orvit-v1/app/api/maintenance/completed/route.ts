import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { startPerf, endParse, startDb, endDb, startCompute, endCompute, startJson, endJson, withPerfHeaders, shouldDisableCache } from '@/lib/perf';
import { requireAuth } from '@/lib/auth/shared-helpers';

export const dynamic = 'force-dynamic';

// ✅ OPTIMIZADO: Función para obtener nombres de usuarios en batch
async function getUserNamesInBatch(userIds: number[]): Promise<Map<number, string>> {
  const userMap = new Map<number, string>();
  if (userIds.length === 0) return userMap;
  
  try {
    const uniqueIds = Array.from(new Set(userIds));
    const users = await prisma.user.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true, name: true }
    });
    users.forEach(u => userMap.set(u.id, u.name || 'Sin asignar'));
  } catch (error) {
    console.error('Error getting user names in batch:', error);
  }
  return userMap;
}

export async function GET(request: NextRequest) {
  const perfCtx = startPerf();
  const { searchParams } = new URL(request.url);
  
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    const companyId = searchParams.get('companyId');
    const sectorId = searchParams.get('sectorId');
    const machineId = searchParams.get('machineId');
    const priority = searchParams.get('priority');
    const type = searchParams.get('type');
    const todayOnly = searchParams.get('todayOnly');
    const timeFilter = searchParams.get('timeFilter'); // 'today', 'week', 'month', 'all'
    const minFrequencyDays = searchParams.get('minFrequencyDays');
    const maxFrequencyDays = searchParams.get('maxFrequencyDays');
    const machineIds = searchParams.get('machineIds');
    const unidadMovilIds = searchParams.get('unidadMovilIds');
    const page = Math.max(parseInt(searchParams.get('page') || '0', 10), 0);
    const pageSizeQuery = parseInt(searchParams.get('pageSize') || '50', 10);
    const pageSize = !isNaN(pageSizeQuery) && pageSizeQuery > 0 ? Math.min(pageSizeQuery, 200) : 50;

    if (!companyId) {
      endParse(perfCtx);
      const metrics = endJson(perfCtx);
      return withPerfHeaders(
        NextResponse.json(
          { error: 'companyId es requerido' },
          { status: 400 }
        ),
        metrics,
        searchParams
      );
    }

    endParse(perfCtx);
    startDb(perfCtx);

    // Buscar work orders completados
    const workOrderWhere: any = {
      companyId: parseInt(companyId),
      status: 'COMPLETED'
    };

    // Aplicar filtros de tiempo
    if (todayOnly === 'true' || timeFilter === 'today') {
      // Usar zona horaria de Argentina (UTC-3) para consistencia
      const now = new Date();
      const argOffset = -3 * 60; // Argentina es UTC-3 (en minutos)
      const argTime = new Date(now.getTime() + (argOffset * 60 * 1000));
      
      const today = new Date(argTime);
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      workOrderWhere.completedDate = {
        gte: today,
        lte: new Date(tomorrow.getTime() - 1) // Incluir todo el día de hoy
      };
      
    } else if (timeFilter === 'week') {
      // Esta semana (lunes a domingo)
      const now = new Date();
      const argOffset = -3 * 60;
      const argTime = new Date(now.getTime() + (argOffset * 60 * 1000));
      
      const today = new Date(argTime);
      const dayOfWeek = today.getDay();
      const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Domingo = 0, Lunes = 1
      
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() + daysToMonday);
      startOfWeek.setHours(0, 0, 0, 0);
      
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      endOfWeek.setHours(23, 59, 59, 999);
      
      workOrderWhere.completedDate = {
        gte: startOfWeek,
        lte: endOfWeek
      };
      
    } else if (timeFilter === 'month') {
      // Este mes
      const now = new Date();
      const argOffset = -3 * 60;
      const argTime = new Date(now.getTime() + (argOffset * 60 * 1000));
      
      const startOfMonth = new Date(argTime.getFullYear(), argTime.getMonth(), 1);
      const endOfMonth = new Date(argTime.getFullYear(), argTime.getMonth() + 1, 0, 23, 59, 59, 999);
      
      workOrderWhere.completedDate = {
        gte: startOfMonth,
        lte: endOfMonth
      };
      
    }
    // Si timeFilter es 'all' o no se especifica, no aplicar filtro de fecha

    if (sectorId) {
      const sectorIdNum = parseInt(sectorId);
      // Filtrar por sectorId directo O por máquina que pertenezca al sector O unidades móviles (sin sector)
      const sectorFilter = {
        OR: [
          { sectorId: sectorIdNum },
          {
            machine: {
              sectorId: sectorIdNum
            }
          },
          // Incluir unidades móviles (que no tienen sectorId o tienen null)
          {
            AND: [
              { unidadMovilId: { not: null } },
              { sectorId: null }
            ]
          }
        ]
      };
      
      // Combinar con filtros existentes usando AND
      const existingFilters = { ...workOrderWhere };
      const andConditions: any[] = [
        { companyId: existingFilters.companyId },
        { status: existingFilters.status }
      ];
      
      if (existingFilters.machineId) {
        andConditions.push({ machineId: existingFilters.machineId });
      }
      if (existingFilters.unidadMovilId) {
        andConditions.push({ unidadMovilId: existingFilters.unidadMovilId });
      }
      if (existingFilters.priority) {
        andConditions.push({ priority: existingFilters.priority });
      }
      if (existingFilters.type) {
        andConditions.push({ type: existingFilters.type });
      }
      
      // Agregar el filtro de sector
      andConditions.push(sectorFilter);
      
      workOrderWhere.AND = andConditions;
      // Limpiar propiedades que ya están en AND
      delete workOrderWhere.companyId;
      delete workOrderWhere.status;
      delete workOrderWhere.machineId;
      delete workOrderWhere.unidadMovilId;
      delete workOrderWhere.priority;
      delete workOrderWhere.type;
      
    }

    if (machineId) {
      workOrderWhere.machineId = parseInt(machineId);
    } else if (machineIds) {
      // Filtrar por múltiples máquinas
      const machineIdArray = machineIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
      if (machineIdArray.length > 0) {
        workOrderWhere.machineId = { in: machineIdArray };
      }
    } else if (unidadMovilIds) {
      // Filtrar por múltiples unidades móviles
      const unidadMovilIdArray = unidadMovilIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
      if (unidadMovilIdArray.length > 0) {
        workOrderWhere.unidadMovilId = { in: unidadMovilIdArray };
      }
    }

    if (priority) {
      workOrderWhere.priority = priority;
    }

    if (type && type !== 'PREVENTIVE') {
      workOrderWhere.type = type;
    }

    const completedWorkOrders = await prisma.workOrder.findMany({
      where: workOrderWhere,
      include: {
        machine: {
          select: {
            id: true,
            name: true,
            type: true,
            status: true
          }
        },
        component: {
          select: {
            id: true,
            name: true,
            type: true
          }
        },
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        assignedWorker: {
          select: {
            id: true,
            name: true,
            phone: true
          }
        },
        sector: {
          select: {
            id: true,
            name: true
          }
        },
        unidadMovil: {
          select: {
            id: true,
            nombre: true,
            tipo: true,
            estado: true
          }
        },
        attachments: {
          select: {
            id: true,
            url: true,
            fileName: true,
            fileType: true,
            fileSize: true,
            uploadedAt: true
          }
        }
      },
      orderBy: [
        { completedDate: 'desc' }
      ]
    });

    // Log detallado de work orders encontrados para debug
    if (todayOnly === 'true') {
      completedWorkOrders.forEach((wo, index) => {
        
        // Verificar específicamente mantenimientos correctivos
        if (wo.type === 'CORRECTIVE') {
        }
      });
    }

    // Buscar mantenimientos preventivos completados (que tienen lastMaintenanceDate)
    let completedPreventiveTemplates: any[] = [];
    
    try {
      // Solo buscar preventivos si no se especifica un tipo específico o si es PREVENTIVE
      if (!type || type === 'PREVENTIVE') {
        const preventiveMaintenanceWhere: any = {
          entityType: 'PREVENTIVE_MAINTENANCE_TEMPLATE'
        };

        // Construir filtros para la URL JSON (sin filtrar por lastMaintenanceDate aquí)
        let urlFilters = [`"companyId":${companyId}`];
        
        if (sectorId) {
          urlFilters.push(`"sectorId":${sectorId}`);
        }
        
        if (machineId) {
          urlFilters.push(`"machineId":${machineId}`);
        } else if (machineIds) {
          // Filtrar por múltiples máquinas en mantenimientos preventivos
          const machineIdArray = machineIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
          if (machineIdArray.length > 0) {
            // Para múltiples máquinas, vamos a filtrar después de cargar los datos
          }
        } else if (unidadMovilIds) {
          // Para unidades móviles, vamos a filtrar después de cargar los datos
        }

        // Aplicar filtros de prioridad si están especificados
        if (priority) {
          urlFilters.push(`"priority":"${priority}"`);
        }
        
        preventiveMaintenanceWhere.url = {
          contains: urlFilters.join(',')
        };

        completedPreventiveTemplates = await prisma.document.findMany({
          where: preventiveMaintenanceWhere,
          orderBy: {
            updatedAt: 'desc'
          }
        });
      }

      // Debug: Log raw templates data
      completedPreventiveTemplates.forEach(template => {
        try {
          const templateData = JSON.parse(template.url);
        } catch (error) {
        }
      });
    } catch (error) {
      console.error('❌ Error fetching completed preventive templates:', error);
      completedPreventiveTemplates = [];
    }

    // Convertir templates de mantenimiento preventivo completados a formato compatible
    const completedPreventiveMaintenances = [];
    
    // Filtrar por máquinas múltiples o unidades móviles si se especificó
    let filteredCompletedTemplates = completedPreventiveTemplates;
    if (machineIds || unidadMovilIds) {
      let machineIdArray: number[] = [];
      let unidadMovilIdArray: number[] = [];
      
      if (machineIds) {
        machineIdArray = machineIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
      }
      
      if (unidadMovilIds) {
        unidadMovilIdArray = unidadMovilIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
      }
      
      if (machineIdArray.length > 0 || unidadMovilIdArray.length > 0) {
        filteredCompletedTemplates = completedPreventiveTemplates.filter(template => {
          try {
            const templateData = JSON.parse(template.url);
            const templateMachineId = templateData.machineId;
            const templateUnidadMovilId = templateData.unidadMovilId;
            
            // Verificar si coincide con máquina o unidad móvil
            const machineMatches = machineIdArray.length > 0 && machineIdArray.includes(templateMachineId);
            const unidadMovilMatches = unidadMovilIdArray.length > 0 && unidadMovilIdArray.includes(templateUnidadMovilId);
            const matches = machineMatches || unidadMovilMatches;
            
            return matches;
          } catch (error) {
            console.error('Error parsing completed template for machine/unidad movil filter:', error);
            return false;
          }
        });
      }
    }
    
    // ✅ OPTIMIZADO: Pre-procesar templates para extraer IDs necesarios
    const validTemplates: { template: any; templateData: any }[] = [];
    const allComponentIds = new Set<number>();
    const allSubcomponentIds = new Set<number>();
    const allUserIds = new Set<number>();
    const templateIds: string[] = [];
    
    // Calcular fecha de hoy una sola vez si es necesario
    let todayStart: Date | null = null;
    if (todayOnly === 'true') {
      const now = new Date();
      const argOffset = -3 * 60;
      const argTime = new Date(now.getTime() + (argOffset * 60 * 1000));
      todayStart = new Date(argTime);
      todayStart.setHours(0, 0, 0, 0);
    }
    
    // Primera pasada: filtrar y recolectar IDs
    for (const template of filteredCompletedTemplates) {
      try {
        const templateData = JSON.parse(template.url);
        
        // Aplicar filtro de frecuencia por días
        let frequencyMatches = true;
        if (minFrequencyDays || maxFrequencyDays) {
          const frequencyDays = templateData.frequencyDays || 0;
          if (minFrequencyDays && frequencyDays < parseInt(minFrequencyDays)) {
            frequencyMatches = false;
          }
          if (maxFrequencyDays && frequencyDays > parseInt(maxFrequencyDays)) {
            frequencyMatches = false;
          }
        }

        if (!templateData.lastMaintenanceDate || !frequencyMatches) continue;
        
        // Filtro de fecha si todayOnly
        if (todayStart) {
          const lastMaintenanceDateOnly = new Date(templateData.lastMaintenanceDate);
          lastMaintenanceDateOnly.setHours(0, 0, 0, 0);
          if (lastMaintenanceDateOnly.getTime() !== todayStart.getTime()) continue;
        }
        
        // Template válido - recolectar IDs
        validTemplates.push({ template, templateData });
        templateIds.push(template.id.toString());
        
        if (templateData.componentIds?.length > 0) {
          templateData.componentIds.forEach((id: any) => allComponentIds.add(Number(id)));
        }
        if (templateData.subcomponentIds?.length > 0) {
          templateData.subcomponentIds.forEach((id: any) => allSubcomponentIds.add(Number(id)));
        }
        if (templateData.assignedToId && !templateData.assignedToName) {
          allUserIds.add(templateData.assignedToId);
        }
      } catch (error) {
        console.error('❌ Error parsing template:', template.id, error);
      }
    }
    
    // ✅ OPTIMIZADO: Batch queries para todos los datos relacionados
    const [allInstructives, allComponents, userNamesMap] = await Promise.all([
      // Obtener todos los instructivos de una vez
      templateIds.length > 0 ? prisma.document.findMany({
        where: {
          entityType: 'PREVENTIVE_MAINTENANCE_INSTRUCTIVE',
          entityId: { in: templateIds }
        },
        orderBy: { createdAt: 'asc' }
      }) : Promise.resolve([]),
      
      // Obtener todos los componentes y subcomponentes de una vez
      allComponentIds.size > 0 || allSubcomponentIds.size > 0 ? prisma.component.findMany({
        where: {
          id: { in: Array.from(allComponentIds).concat(Array.from(allSubcomponentIds)) }
        },
        select: { id: true, name: true, type: true }
      }) : Promise.resolve([]),
      
      // Obtener nombres de usuarios
      getUserNamesInBatch(Array.from(allUserIds))
    ]);
    
    endDb(perfCtx);
    startCompute(perfCtx);
    
    // Crear mapas para acceso rápido
    const instructivesByTemplateId = new Map<string, any[]>();
    allInstructives.forEach(inst => {
      const key = inst.entityId || '';
      if (!instructivesByTemplateId.has(key)) {
        instructivesByTemplateId.set(key, []);
      }
      instructivesByTemplateId.get(key)!.push({
        id: inst.id,
        url: inst.url,
        originalName: inst.originalName,
        fileName: inst.originalName,
        description: '',
        uploadedAt: inst.createdAt.toISOString(),
        isTemporary: false
      });
    });
    
    const componentsMap = new Map<number, any>();
    allComponents.forEach(c => componentsMap.set(c.id, c));
    
    // Segunda pasada: construir objetos de respuesta (sin queries adicionales)
    for (const { template, templateData } of validTemplates) {
      const instructivesData = instructivesByTemplateId.get(template.id.toString()) || [];
      
      const componentsData = (templateData.componentIds || [])
        .map((id: any) => componentsMap.get(Number(id)))
        .filter(Boolean);
      
      const subcomponentsData = (templateData.subcomponentIds || [])
        .map((id: any) => componentsMap.get(Number(id)))
        .filter(Boolean);
      
      const userName = templateData.assignedToName || 
        (templateData.assignedToId ? userNamesMap.get(templateData.assignedToId) : null) || 
        'Sin asignar';

      completedPreventiveMaintenances.push({
        id: template.id,
        title: templateData.title,
        description: templateData.description,
        priority: templateData.priority,
        type: 'PREVENTIVE',
        status: 'COMPLETED',
        scheduledDate: new Date(templateData.lastMaintenanceDate),
        completedDate: new Date(templateData.lastMaintenanceDate),
        estimatedHours: templateData.estimatedHours,
        estimatedMinutes: templateData.estimatedMinutes,
        estimatedTimeType: templateData.estimatedTimeType,
        maintenanceInterval: templateData.maintenanceInterval,
        maintenanceIntervalType: templateData.maintenanceIntervalType,
        actualHours: templateData.lastExecutionDuration || 0,
        machineId: templateData.machineId,
        machine: templateData.machineId ? {
          id: templateData.machineId,
          name: templateData.machineName,
          type: 'PRODUCTION',
          status: 'ACTIVE'
        } : null,
        unidadMovilId: templateData.unidadMovilId,
        unidadMovil: templateData.unidadMovilId ? {
          id: templateData.unidadMovilId,
          nombre: templateData.unidadMovilName,
          tipo: templateData.unidadMovilTipo || 'AUTOLEVADOR',
          estado: 'ACTIVO'
        } : null,
        component: templateData.componentIds?.length > 0 ? {
          id: templateData.componentIds[0],
          name: templateData.componentNames?.[0] || 'Componente',
          type: 'COMPONENT'
        } : null,
        componentIds: templateData.componentIds || [],
        subcomponentIds: templateData.subcomponentIds || [],
        components: componentsData,
        subcomponents: subcomponentsData,
        assignedToId: templateData.assignedToId,
        assignedTo: templateData.assignedToId ? { id: templateData.assignedToId, name: userName } : null,
        assignedWorker: templateData.assignedToId ? { id: templateData.assignedToId, name: userName } : null,
        assignedToName: userName,
        sector: { id: templateData.sectorId, name: 'Sector' },
        isPreventive: true,
        frequencyDays: templateData.frequencyDays,
        frequency: templateData.frequency,
        frequencyUnit: templateData.frequencyUnit || (templateData.frequencyDays ? 
          (templateData.frequencyDays >= 365 ? 'YEARS' :
           templateData.frequencyDays >= 30 ? 'MONTHS' :
           templateData.frequencyDays >= 7 ? 'WEEKS' : 'DAYS') : 'MONTHS'),
        maintenanceCount: templateData.maintenanceCount || 0,
        tags: templateData.tags || [],
        executionWindow: templateData.executionWindow || 'ANY_TIME',
        timeUnit: templateData.timeUnit || 'HOURS',
        timeValue: templateData.timeValue || 1,
        alertDaysBefore: templateData.alertDaysBefore || [3, 2, 1, 0],
        instructives: instructivesData,
        toolsRequired: templateData.toolsRequired || [],
        spareParts: templateData.spareParts || [],
        notes: templateData.lastExecutionNotes || '',
        comments: templateData.comments || '',
        rootCause: templateData.rootCause || '',
        solution: templateData.solution || '',
        lastMaintenanceDate: templateData.lastMaintenanceDate,
        nextMaintenanceDate: templateData.nextMaintenanceDate
      });
    }

    // Log detallado de mantenimientos preventivos encontrados para debug
    if (todayOnly === 'true') {
      completedPreventiveMaintenances.forEach((pm, index) => {
      });
    }

    // Mapear work orders completados para incluir campos faltantes
    const mappedCompletedWorkOrders = completedWorkOrders.map(workOrder => {
      // ✅ Extraer datos de notes para obtener appliedBy, reportedByName, etc.
      let notesData: any = {};
      try {
        if (workOrder.notes) {
          notesData = JSON.parse(workOrder.notes);
        }
      } catch (e) {
        // Si no es JSON válido, ignorar
      }

      return {
        ...workOrder,
        type: workOrder.type || 'CORRECTIVE',
        isPreventive: false,
        assignedToName: workOrder.assignedTo?.name || workOrder.assignedWorker?.name || 'Sin asignar',
        // ✅ Extraer información del reportador (quien reportó la falla)
        reportedByName: notesData.reportedByName || null,
        reportedById: notesData.reportedById || null,
        // ✅ Extraer información de quien aplicó la solución
        appliedBy: notesData.appliedBy || null,
        appliedDate: notesData.appliedDate || null,
        // ✅ Extraer otros datos de la solución
        solution: notesData.solution || workOrder.solution,
        failureType: notesData.failureType || null,
        affectedComponents: notesData.affectedComponents || [],
        componentNames: notesData.componentNames || [],
        timeUnit: notesData.timeUnit || notesData.solutionTimeUnit || 'hours',
        timeValue: notesData.estimatedTime || workOrder.estimatedHours || 0,
        instructives: workOrder.attachments?.map(attachment => ({
          id: attachment.id,
          url: attachment.url,
          originalName: attachment.fileName,
          fileName: attachment.fileName,
          description: '',
          uploadedAt: attachment.uploadedAt.toISOString(),
          isTemporary: false
        })) || [],
        toolsRequired: notesData.toolsUsed || [],
        spareParts: notesData.sparePartsUsed || [],
        frequencyDays: null,
        frequency: null,
        frequencyUnit: null,
        maintenanceCount: 0,
        executionWindow: 'ANY_TIME',
        lastMaintenanceDate: workOrder.completedDate?.toISOString(),
        nextMaintenanceDate: null
      };
    });

    // Combinar work orders y mantenimientos preventivos completados
    const completedMaintenances = [...mappedCompletedWorkOrders, ...completedPreventiveMaintenances];

    endDb(perfCtx);
    startCompute(perfCtx);

    const startIndex = page * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedMaintenances = completedMaintenances.slice(startIndex, endIndex);
    const hasMore = endIndex < completedMaintenances.length;

    endCompute(perfCtx);
    startJson(perfCtx);

    const responseData = {
      maintenances: paginatedMaintenances,
      pagination: {
        page,
        pageSize,
        total: completedMaintenances.length,
        hasMore,
        nextPage: hasMore ? page + 1 : null
      }
    };

    const metrics = endJson(perfCtx, responseData);

    const disableCache = shouldDisableCache(searchParams);
    const response = NextResponse.json(responseData);
    
    // Agregar headers de cache
    response.headers.set(
      'Cache-Control',
      disableCache 
        ? 'no-store, no-cache, must-revalidate' 
        : 'private, max-age=30, s-maxage=30'
    );

    return withPerfHeaders(response, metrics, searchParams);

  } catch (error) {
    console.error('❌ Error fetching completed maintenances:', error);
    try {
      const metrics = endJson(perfCtx);
      return withPerfHeaders(
        NextResponse.json(
          { error: 'Error interno del servidor' },
          { status: 500 }
        ),
        metrics,
        searchParams
      );
    } catch (perfError) {
      // Si hay error con perf, retornar respuesta simple
      console.error('Error en performance tracking:', perfError);
      return NextResponse.json(
        { error: 'Error interno del servidor' },
        { status: 500 }
      );
    }
  }
}
