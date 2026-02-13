import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { startPerf, endParse, startDb, endDb, startCompute, endCompute, startJson, endJson, withPerfHeaders, shouldDisableCache } from '@/lib/perf';

export const dynamic = 'force-dynamic';

// ✅ OPTIMIZADO: Eliminados console.log excesivos y queries en loops

export async function GET(request: NextRequest) {
  const perfCtx = startPerf();
  const { searchParams } = new URL(request.url);
  
  try {
    const companyId = searchParams.get('companyId');
    const sectorId = searchParams.get('sectorId');
    const machineId = searchParams.get('machineId');
    const priority = searchParams.get('priority');
    const type = searchParams.get('type');
    const overdueDays = searchParams.get('overdueDays');
    const urgentOnly = searchParams.get('urgentOnly');
    const minFrequencyDays = searchParams.get('minFrequencyDays');
    const maxFrequencyDays = searchParams.get('maxFrequencyDays');
    const machineIds = searchParams.get('machineIds');
    const unidadMovilIds = searchParams.get('unidadMovilIds');
    const sortOrder = searchParams.get('sortOrder');

    if (!companyId) {
      endParse(perfCtx);
      const metrics = endJson(perfCtx);
      return withPerfHeaders(
        NextResponse.json({ error: 'companyId es requerido' }, { status: 400 }),
        metrics,
        searchParams
      );
    }

    endParse(perfCtx);
    startDb(perfCtx);
    
    const companyIdNum = parseInt(companyId);

    // ✅ OPTIMIZACIÓN: Construir filtros de work orders
    const workOrderWhere: any = {
      companyId: companyIdNum,
      status: { in: ['PENDING', 'IN_PROGRESS'] }
    };

    if (machineId) {
      workOrderWhere.machineId = parseInt(machineId);
    } else if (machineIds) {
      const ids = machineIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
      if (ids.length > 0) workOrderWhere.machineId = { in: ids };
    } else if (unidadMovilIds) {
      const ids = unidadMovilIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
      if (ids.length > 0) workOrderWhere.unidadMovilId = { in: ids };
    }

    if (priority) workOrderWhere.priority = priority;
    if (type && type !== 'PREVENTIVE') workOrderWhere.type = type;

    if (overdueDays) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - parseInt(overdueDays));
      workOrderWhere.scheduledDate = { lt: cutoffDate };
    }

    // Filtro de sector - NO aplicar a work orders, solo a preventivos
    // Los work orders ya tienen su propio sectorId o machine.sectorId
    // Aplicar filtro solo si se especifica sectorId
    if (sectorId && !machineId && !machineIds && !unidadMovilIds) {
      const sectorIdNum = parseInt(sectorId);
      // Usar AND para combinar con los filtros existentes
      workOrderWhere.AND = [
        { companyId: companyIdNum },
        { status: { in: ['PENDING', 'IN_PROGRESS'] } },
        {
          OR: [
            { sectorId: sectorIdNum },
            { machine: { sectorId: sectorIdNum } },
            // Incluir unidades móviles (no tienen sector fijo)
            { unidadMovilId: { not: null } }
          ]
        }
      ];
      // Limpiar los filtros que ya están en AND
      delete workOrderWhere.companyId;
      delete workOrderWhere.status;
    }

    // DEBUG: Log de filtros
    console.log('🔍 PENDING API - Filtros:', { companyId, sectorId, machineId, type, workOrderWhere });

    // ✅ OPTIMIZACIÓN: Ejecutar queries en paralelo
    const [pendingWorkOrders, preventiveTemplates] = await Promise.all([
      // Query 1: Work Orders pendientes
      prisma.workOrder.findMany({
        where: workOrderWhere,
        include: {
          machine: { select: { id: true, name: true, type: true, status: true } },
          component: { select: { id: true, name: true, type: true } },
          assignedTo: { select: { id: true, name: true, email: true } },
          assignedWorker: { select: { id: true, name: true, phone: true } },
          sector: { select: { id: true, name: true } },
          unidadMovil: { select: { id: true, nombre: true, tipo: true, estado: true } },
          attachments: { select: { id: true, url: true, fileName: true, fileType: true, fileSize: true, uploadedAt: true } }
        },
        orderBy: sortOrder === 'oldest' 
          ? [{ scheduledDate: 'asc' }, { createdAt: 'asc' }]
          : sortOrder === 'newest'
          ? [{ scheduledDate: 'desc' }, { createdAt: 'desc' }]
          : [{ priority: 'desc' }, { scheduledDate: 'asc' }],
        take: 100
      }),

      // Query 2: Templates preventivos (solo si no se filtra por tipo específico no-preventivo)
      (!type || type === 'PREVENTIVE') ? prisma.document.findMany({
        where: {
          entityType: 'PREVENTIVE_MAINTENANCE_TEMPLATE',
          url: { contains: `"companyId":${companyId}` }
        },
        orderBy: { createdAt: 'desc' },
        take: 200
      }) : Promise.resolve([])
    ]);

    // ✅ OPTIMIZACIÓN: Procesar templates preventivos sin queries adicionales en loop
    const now = new Date();
    const preventiveMaintenances: any[] = [];
    const machineIdsToFetch = new Set<number>();
    const unidadMovilIdsToFetch = new Set<number>();

    // Primera pasada: filtrar y recolectar IDs
    const validTemplates: any[] = [];
    for (const template of preventiveTemplates) {
      try {
        const data = JSON.parse(template.url);
        
        // Filtros básicos
        if (!data.isActive) continue;
        
        // Filtro de sector - se verificará después con la máquina real
        // No filtrar aquí porque data.sectorId puede no existir
        
        // Filtro de máquina
        if (machineId && data.machineId !== parseInt(machineId)) continue;
        if (machineIds) {
          const ids = machineIds.split(',').map(id => parseInt(id.trim()));
          if (!ids.includes(data.machineId)) continue;
        }
        
        // Filtro de unidad móvil
        if (unidadMovilIds) {
          const ids = unidadMovilIds.split(',').map(id => parseInt(id.trim()));
          if (!ids.includes(data.unidadMovilId)) continue;
        }

        // Filtro de frecuencia
        if (minFrequencyDays && (data.frequencyDays || 0) < parseInt(minFrequencyDays)) continue;
        if (maxFrequencyDays && (data.frequencyDays || 0) > parseInt(maxFrequencyDays)) continue;

        // Calcular próxima fecha
        const nextDate = new Date(data.nextMaintenanceDate || data.scheduledDate || now);
        const daysUntilDue = Math.ceil((nextDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        
        // Solo filtrar por urgencia si se especifica urgentOnly
        if (urgentOnly === 'true' && daysUntilDue > 1 && nextDate >= now) continue;

        // Verificar si ya fue ejecutado hoy
        if (data.lastMaintenanceDate) {
          const lastDate = new Date(data.lastMaintenanceDate);
          if (lastDate.toDateString() === now.toDateString()) continue;
        }

        // Recolectar IDs para batch query
        if (data.machineId) machineIdsToFetch.add(data.machineId);
        if (data.unidadMovilId) unidadMovilIdsToFetch.add(data.unidadMovilId);

        validTemplates.push({ template, data, nextDate, daysUntilDue });
      } catch (e) {
        // Skip invalid templates
      }
    }

    // ✅ OPTIMIZACIÓN: Batch queries para máquinas y unidades móviles
    const [machines, unidadesMoviles] = await Promise.all([
      machineIdsToFetch.size > 0 ? prisma.machine.findMany({
        where: { id: { in: Array.from(machineIdsToFetch) } },
        select: { id: true, name: true, type: true, status: true, sectorId: true }
      }) : Promise.resolve([]),
      unidadMovilIdsToFetch.size > 0 ? prisma.unidadMovil.findMany({
        where: { id: { in: Array.from(unidadMovilIdsToFetch) } },
        select: { id: true, nombre: true, tipo: true, estado: true }
      }) : Promise.resolve([])
    ]);

    endDb(perfCtx);
    startCompute(perfCtx);

    const machinesMap = new Map(machines.map(m => [m.id, m]));
    const unidadesMap = new Map(unidadesMoviles.map(u => [u.id, u]));

    // Segunda pasada: construir respuesta
    for (const { template, data, nextDate, daysUntilDue } of validTemplates) {
      const machine = data.machineId ? machinesMap.get(data.machineId) : null;
      const unidadMovil = data.unidadMovilId ? unidadesMap.get(data.unidadMovilId) : null;

      // Si hay filtro de sector, verificar que pertenezca al sector
      if (sectorId) {
        const sectorIdNum = parseInt(sectorId);
        // Si tiene máquina, verificar que pertenezca al sector
        if (machine && machine.sectorId !== sectorIdNum) continue;
        // Si tiene sectorId directo en el template, verificar
        if (data.sectorId && data.sectorId !== sectorIdNum && !unidadMovil) continue;
        // Las unidades móviles se incluyen siempre (no tienen sector fijo)
      }

      preventiveMaintenances.push({
        id: template.id,
        title: data.title,
        description: data.description,
        priority: data.priority || 'MEDIUM',
        type: 'PREVENTIVE',
        status: 'PENDING',
        scheduledDate: nextDate,
        estimatedHours: data.estimatedHours,
        // Campos de tiempo estimado para el frontend
        timeValue: data.timeValue,
        timeUnit: data.timeUnit,
        estimatedMinutes: data.estimatedMinutes,
        estimatedTimeType: data.estimatedTimeType,
        machineId: data.machineId,
        machine,
        unidadMovilId: data.unidadMovilId,
        unidadMovil,
        assignedTo: data.assignedToId ? { id: data.assignedToId, name: data.assignedToName || 'Sin asignar' } : null,
        assignedToName: data.assignedToName || null,
        // Componentes y subcomponentes
        componentIds: data.componentIds || [],
        componentNames: data.componentNames || [],
        subcomponentIds: data.subcomponentIds || [],
        subcomponentNames: data.subcomponentNames || [],
        sector: data.sectorId ? { id: data.sectorId, name: 'Sector' } : null,
        isPreventive: true,
        frequencyDays: data.frequencyDays,
        frequency: data.frequency || data.frequencyDays,
        frequencyUnit: data.frequencyUnit,
        daysUntilDue,
        lastMaintenanceDate: data.lastMaintenanceDate,
        nextMaintenanceDate: nextDate.toISOString(),
        instructives: data.instructives || [],
        toolsRequired: data.toolsRequired || [],
        tags: data.tags || [],
        executionWindow: data.executionWindow
      });
    }

    // Combinar y ordenar
    const allMaintenances = [
      ...pendingWorkOrders.map(wo => ({
        ...wo,
        isPreventive: false,
        assignedToName: wo.assignedTo?.name || wo.assignedWorker?.name || 'Sin asignar'
      })),
      ...preventiveMaintenances
    ];

    // Ordenar según sortOrder
    if (sortOrder === 'oldest') {
      allMaintenances.sort((a, b) => {
        const dateA = new Date(a.scheduledDate || a.createdAt || 0);
        const dateB = new Date(b.scheduledDate || b.createdAt || 0);
        return dateA.getTime() - dateB.getTime();
      });
    } else if (sortOrder === 'newest') {
      allMaintenances.sort((a, b) => {
        const dateA = new Date(a.scheduledDate || a.createdAt || 0);
        const dateB = new Date(b.scheduledDate || b.createdAt || 0);
        return dateB.getTime() - dateA.getTime();
      });
    }

    // DEBUG: Log de resultados
    console.log('🔍 PENDING API - Resultados:', {
      workOrders: pendingWorkOrders.length,
      templates: preventiveTemplates.length,
      validTemplates: validTemplates.length,
      preventiveMaintenances: preventiveMaintenances.length,
      total: allMaintenances.length
    });

    endCompute(perfCtx);
    startJson(perfCtx);

    const responseData = {
      maintenances: allMaintenances,
      total: allMaintenances.length,
      workOrdersCount: pendingWorkOrders.length,
      preventiveCount: preventiveMaintenances.length
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
    console.error('Error fetching pending maintenances:', error);
    try {
      const metrics = endJson(perfCtx);
      return withPerfHeaders(
        NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 }),
        metrics,
        searchParams
      );
    } catch (perfError) {
      // Si hay error con perf, retornar respuesta simple
      console.error('Error en performance tracking:', perfError);
      return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
    }
  }
}
