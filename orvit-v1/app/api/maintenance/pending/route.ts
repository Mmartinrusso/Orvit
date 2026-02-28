import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { startPerf, endParse, startDb, endDb, startCompute, endCompute, startJson, endJson, withPerfHeaders, shouldDisableCache } from '@/lib/perf';
import { requireAuth } from '@/lib/auth/shared-helpers';

export const dynamic = 'force-dynamic';

// ✅ OPTIMIZADO: Eliminados console.log excesivos y queries en loops

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

    // ✅ MIGRADO: Queries directas a preventiveTemplate en lugar de JSON-in-Document

    // Construir filtros para preventiveTemplate
    const templateWhere: any = {
      companyId: companyIdNum,
      isActive: true,
    };

    if (machineId) {
      templateWhere.machineId = parseInt(machineId);
    } else if (machineIds) {
      const ids = machineIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
      if (ids.length > 0) templateWhere.machineId = { in: ids };
    }

    if (unidadMovilIds) {
      const ids = unidadMovilIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
      if (ids.length > 0) templateWhere.unidadMovilId = { in: ids };
    }

    if (minFrequencyDays) templateWhere.frequencyDays = { ...(templateWhere.frequencyDays || {}), gte: parseInt(minFrequencyDays) };
    if (maxFrequencyDays) templateWhere.frequencyDays = { ...(templateWhere.frequencyDays || {}), lte: parseInt(maxFrequencyDays) };

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

      // Query 2: Templates preventivos directamente de la tabla preventiveTemplate
      (!type || type === 'PREVENTIVE') ? prisma.preventiveTemplate.findMany({
        where: templateWhere,
        include: {
          machine: { select: { id: true, name: true, type: true, status: true, sectorId: true } },
          unidadMovil: { select: { id: true, nombre: true, tipo: true, estado: true } },
          sector: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 200
      }) : Promise.resolve([])
    ]);

    endDb(perfCtx);
    startCompute(perfCtx);

    // Procesar templates preventivos con acceso directo a columnas
    const now = new Date();
    const preventiveMaintenances: any[] = [];

    for (const tpl of preventiveTemplates) {
      // Calcular próxima fecha
      const nextDate = tpl.nextMaintenanceDate ? new Date(tpl.nextMaintenanceDate) : now;
      const daysUntilDue = Math.ceil((nextDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      // Solo filtrar por urgencia si se especifica urgentOnly
      if (urgentOnly === 'true' && daysUntilDue > 1 && nextDate >= now) continue;

      // Verificar si ya fue ejecutado hoy
      if (tpl.lastMaintenanceDate) {
        const lastDate = new Date(tpl.lastMaintenanceDate);
        if (lastDate.toDateString() === now.toDateString()) continue;
      }

      // Si hay filtro de sector, verificar que pertenezca al sector
      if (sectorId) {
        const sectorIdNum = parseInt(sectorId);
        // Si tiene máquina, verificar que pertenezca al sector
        if (tpl.machine && (tpl.machine as any).sectorId !== sectorIdNum) continue;
        // Si tiene sectorId directo en el template, verificar
        if (tpl.sectorId && tpl.sectorId !== sectorIdNum && !tpl.unidadMovil) continue;
        // Las unidades móviles se incluyen siempre (no tienen sector fijo)
      }

      preventiveMaintenances.push({
        id: tpl.id,
        title: tpl.title,
        description: tpl.description,
        priority: tpl.priority || 'MEDIUM',
        type: 'PREVENTIVE',
        status: 'PENDING',
        scheduledDate: nextDate,
        estimatedHours: tpl.estimatedHours,
        // Campos de tiempo estimado para el frontend
        timeValue: tpl.timeValue,
        timeUnit: tpl.timeUnit,
        estimatedMinutes: null,
        estimatedTimeType: null,
        machineId: tpl.machineId,
        machine: tpl.machine,
        unidadMovilId: tpl.unidadMovilId,
        unidadMovil: tpl.unidadMovil,
        assignedTo: tpl.assignedToId ? { id: tpl.assignedToId, name: tpl.assignedToName || 'Sin asignar' } : null,
        assignedToName: tpl.assignedToName || null,
        // Componentes y subcomponentes
        componentIds: tpl.componentIds || [],
        componentNames: tpl.componentNames || [],
        subcomponentIds: tpl.subcomponentIds || [],
        subcomponentNames: tpl.subcomponentNames || [],
        sector: tpl.sector || (tpl.sectorId ? { id: tpl.sectorId, name: 'Sector' } : null),
        isPreventive: true,
        frequencyDays: tpl.frequencyDays,
        frequency: tpl.frequencyDays,
        frequencyUnit: 'DAYS',
        daysUntilDue,
        lastMaintenanceDate: tpl.lastMaintenanceDate?.toISOString() || null,
        nextMaintenanceDate: nextDate.toISOString(),
        instructives: tpl.instructives || [],
        toolsRequired: tpl.toolsRequired || [],
        tags: [],
        executionWindow: tpl.executionWindow
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
