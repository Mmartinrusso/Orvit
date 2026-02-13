import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// ✅ OPTIMIZADO: Eliminados console.log, queries en loops, y PrismaClient duplicado

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const sectorId = searchParams.get('sectorId');
    const machineId = searchParams.get('machineId');
    const componentId = searchParams.get('componentId');
    const subcomponentId = searchParams.get('subcomponentId');
    const unidadMovilId = searchParams.get('unidadMovilId');
    const machineIds = searchParams.get('machineIds');
    const unidadMovilIds = searchParams.get('unidadMovilIds');
    const searchTerm = searchParams.get('searchTerm')?.trim();
    const page = Math.max(parseInt(searchParams.get('page') || '0', 10), 0);
    const pageSize = Math.min(parseInt(searchParams.get('pageSize') || '50', 10), 100);

    if (!companyId) {
      return NextResponse.json({ error: 'Company ID is required' }, { status: 400 });
    }

    const companyIdNum = parseInt(companyId);
    const sectorIdNum = sectorId ? parseInt(sectorId) : null;
    const machineIdNum = machineId ? parseInt(machineId) : null;
    const componentIdNum = componentId ? parseInt(componentId) : null;
    const subcomponentIdNum = subcomponentId ? parseInt(subcomponentId) : null;
    const unidadMovilIdNum = unidadMovilId ? parseInt(unidadMovilId) : null;

    // ✅ OPTIMIZACIÓN: Construir filtros
    const workOrderWhere: any = { companyId: companyIdNum };

    if (machineIdNum) {
      workOrderWhere.machineId = machineIdNum;
    } else if (machineIds) {
      const ids = machineIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
      if (ids.length > 0) workOrderWhere.machineId = { in: ids };
    }

    // Filtro por componente
    if (componentIdNum) {
      workOrderWhere.componentId = componentIdNum;
    }

    if (unidadMovilIdNum) {
      workOrderWhere.unidadMovilId = unidadMovilIdNum;
    } else if (unidadMovilIds) {
      const ids = unidadMovilIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
      if (ids.length > 0) workOrderWhere.unidadMovilId = { in: ids };
    }

    if (searchTerm) {
      workOrderWhere.OR = [
        { title: { contains: searchTerm, mode: 'insensitive' } },
        { description: { contains: searchTerm, mode: 'insensitive' } }
      ];
    }

    // Filtro de sector
    if (sectorIdNum && !machineIdNum && !unidadMovilIdNum) {
      workOrderWhere.OR = [
        { sectorId: sectorIdNum },
        { machine: { sectorId: sectorIdNum } },
        { unidadMovil: { sectorId: sectorIdNum } }
      ];
    }

    // Construir filtros para maintenance_history
    const maintenanceHistoryWhere: any = {};
    if (machineIdNum) {
      maintenanceHistoryWhere.machineId = machineIdNum;
    }
    if (componentIdNum) {
      maintenanceHistoryWhere.componentId = componentIdNum;
    }

    // ✅ OPTIMIZACIÓN: Ejecutar queries en paralelo
    const [workOrders, templates, maintenanceHistoryRecords] = await Promise.all([
      prisma.workOrder.findMany({
        where: workOrderWhere,
        include: {
          machine: { select: { id: true, name: true, sectorId: true } },
          unidadMovil: { select: { id: true, nombre: true, sectorId: true } },
          assignedWorker: { select: { id: true, name: true } },
          sector: { select: { id: true, name: true } },
          component: { select: { id: true, name: true } }
        },
        orderBy: { completedDate: 'desc' },
        take: 200
      }),
      // Buscar templates - sin filtrar por companyId en la query para incluir templates que tienen companyId en el JSON
      prisma.document.findMany({
        where: {
          entityType: { in: ['PREVENTIVE_MAINTENANCE_TEMPLATE', 'MAINTENANCE_CHECKLIST'] }
        },
        orderBy: { updatedAt: 'desc' },
        take: 500
      }),
      // Consultar maintenance_history si hay filtros específicos
      (machineIdNum || componentIdNum) ? prisma.maintenance_history.findMany({
        where: maintenanceHistoryWhere,
        include: {
          Machine: { select: { id: true, name: true } },
          Component: { select: { id: true, name: true } },
          User: { select: { id: true, name: true } },
          work_orders: { select: { id: true, title: true, description: true, type: true, priority: true, status: true } }
        },
        orderBy: { executedAt: 'desc' },
        take: 200
      }) : Promise.resolve([])
    ]);

    // Procesar work orders
    const workOrderHistory = workOrders.map(order => ({
      id: `workorder-${order.id}`,
      maintenanceId: order.id,
      maintenanceType: order.type === 'PREVENTIVE' ? 'PREVENTIVE' : 'CORRECTIVE',
      type: order.type || 'WORK_ORDER',
      title: order.title,
      description: order.description,
      machineId: order.machine?.id ?? null,
      machineName: order.machine?.name ?? order.unidadMovil?.nombre ?? null,
      assignedToName: order.assignedWorker?.name ?? null,
      executedAt: (order.completedDate || order.updatedAt || order.createdAt).toISOString(),
      actualDuration: order.actualHours ? Math.round(Number(order.actualHours) * 60) : null,
      notes: order.notes ?? null,
      completionStatus: (order.status as string) === 'RESCHEDULED' ? 'RESCHEDULED' : 'COMPLETED',
      companyId: order.companyId,
      priority: order.priority ?? null,
      status: order.status ?? null,
      scheduledDate: order.scheduledDate?.toISOString() ?? null,
      completedDate: order.completedDate?.toISOString() ?? null,
      isFromChecklist: false
    }));

    // ✅ OPTIMIZACIÓN: Procesar templates sin queries adicionales
    const templateHistory: any[] = [];
    let templatesProcessed = 0;
    let templatesFiltered = 0;
    
    for (const template of templates) {
      try {
        const data = JSON.parse(template.url);
        templatesProcessed++;
        
        // Filtros básicos - verificar companyId (el campo companyId puede estar en el JSON o en el Document)
        const templateCompanyId = data.companyId || template.companyId;
        if (templateCompanyId && templateCompanyId !== companyIdNum) {
          continue;
        }
        
        // Filtro de sector
        if (sectorIdNum && data.sectorId && data.sectorId !== sectorIdNum) continue;
        
        // Filtro de máquina - incluir templates que tienen el machineId exacto
        let matchesMachine = true;
        if (machineIdNum) {
          // El machineId del template debe coincidir con el solicitado (comparar como números)
          const templateMachineId = data.machineId ? Number(data.machineId) : null;
          matchesMachine = templateMachineId === machineIdNum;
          
        }
        if (!matchesMachine) {
          templatesFiltered++;
          continue;
        }
        
        if (machineIds) {
          const ids = machineIds.split(',').map(id => parseInt(id.trim()));
          if (data.machineId && !ids.includes(data.machineId)) continue;
        }
        
        // Filtro de componente - si se especifica, filtrar por componentIds
        if (componentIdNum) {
          const templateComponentIds = data.componentIds || [];
          if (templateComponentIds.length > 0 && !templateComponentIds.includes(componentIdNum)) continue;
        }
        
        // Filtro de unidad móvil
        if (unidadMovilIdNum && data.unidadMovilId !== unidadMovilIdNum) continue;
        if (unidadMovilIds) {
          const ids = unidadMovilIds.split(',').map(id => parseInt(id.trim()));
          if (data.unidadMovilId && !ids.includes(data.unidadMovilId)) continue;
        }

        // Procesar historial de ejecuciones
        const historyEntries = Array.isArray(data.executionHistory) ? data.executionHistory : [];
        
        if (historyEntries.length === 0 && data.lastMaintenanceDate) {
          // Solo última ejecución
          templateHistory.push({
            id: `template-${template.id}-last`,
            maintenanceId: template.id,
            maintenanceType: 'PREVENTIVE',
            type: 'PREVENTIVE_TEMPLATE',
            title: data.title,
            description: data.description,
            machineId: data.machineId ?? null,
            machineName: data.machineName ?? null,
            assignedToName: data.lastExecutedBy ?? null,
            executedAt: new Date(data.lastMaintenanceDate).toISOString(),
            actualDuration: data.lastExecutionDuration ? Math.round(Number(data.lastExecutionDuration) * 60) : null,
            notes: data.lastExecutionNotes ?? '',
            completionStatus: 'COMPLETED',
            companyId: data.companyId || companyIdNum,
            priority: data.priority || 'MEDIUM',
            status: 'COMPLETED',
            scheduledDate: data.nextMaintenanceDate ? new Date(data.nextMaintenanceDate).toISOString() : null,
            completedDate: new Date(data.lastMaintenanceDate).toISOString(),
            isFromChecklist: true
          });
        } else if (historyEntries.length > 0) {
          // Múltiples ejecuciones
          for (const entry of historyEntries) {
            templateHistory.push({
              id: `${template.id}-${entry.id}`,
              maintenanceId: template.id,
              maintenanceType: 'PREVENTIVE',
              type: 'PREVENTIVE_TEMPLATE',
              title: data.title,
              description: data.description,
              machineId: entry.machineId ?? data.machineId ?? null,
              machineName: data.machineName ?? null,
              assignedToName: entry.executedBy ?? data.lastExecutedBy ?? null,
              executedAt: entry.executedAt ? new Date(entry.executedAt).toISOString() : new Date().toISOString(),
              actualDuration: entry.actualDuration ? Math.round(Number(entry.actualDuration)) : null,
              notes: entry.notes ?? '',
              completionStatus: entry.completionStatus || 'COMPLETED',
              companyId: data.companyId || companyIdNum,
              priority: data.priority || 'MEDIUM',
              status: entry.completionStatus === 'RESCHEDULED' ? 'SCHEDULED' : 'COMPLETED',
              scheduledDate: data.nextMaintenanceDate ? new Date(data.nextMaintenanceDate).toISOString() : null,
              completedDate: entry.executedAt ? new Date(entry.executedAt).toISOString() : null,
              isFromChecklist: true
            });
          }
        } else {
          // No hay ejecuciones, pero mostrar el mantenimiento programado
          const scheduledDate = data.nextMaintenanceDate || data.scheduledDate || data.startDate;
          if (scheduledDate) {
            templateHistory.push({
              id: `template-${template.id}-scheduled`,
              maintenanceId: template.id,
              maintenanceType: 'PREVENTIVE',
              type: 'PREVENTIVE_TEMPLATE',
              title: data.title,
              description: data.description,
              machineId: data.machineId ?? null,
              machineName: data.machineName ?? null,
              assignedToName: data.assignedToName ?? null,
              executedAt: new Date(scheduledDate).toISOString(),
              actualDuration: null,
              notes: '',
              completionStatus: 'PENDING',
              companyId: data.companyId || companyIdNum,
              priority: data.priority || 'MEDIUM',
              status: 'PENDING',
              scheduledDate: new Date(scheduledDate).toISOString(),
              completedDate: null,
              isFromChecklist: true,
              frequencyDays: data.frequencyDays ?? null
            });
          }
        }
      } catch (e) {
        // Skip invalid templates
      }
    }

    // Procesar maintenance_history records
    const maintenanceHistoryData = maintenanceHistoryRecords.map((record: any) => ({
      id: `history-${record.id}`,
      maintenanceId: record.workOrderId,
      maintenanceType: record.work_orders?.type || 'PREVENTIVE',
      type: 'MAINTENANCE_HISTORY',
      title: record.work_orders?.title || 'Mantenimiento',
      description: record.work_orders?.description || record.notes || '',
      machineId: record.machineId ?? null,
      machineName: record.Machine?.name ?? null,
      componentId: record.componentId ?? null,
      componentName: record.Component?.name ?? null,
      assignedToName: record.User?.name ?? null,
      executedAt: record.executedAt.toISOString(),
      actualDuration: record.duration ? Math.round(Number(record.duration) * 60) : null,
      notes: record.notes ?? '',
      rootCause: record.rootCause ?? null,
      correctiveActions: record.correctiveActions ?? null,
      preventiveActions: record.preventiveActions ?? null,
      completionStatus: 'COMPLETED',
      companyId: companyIdNum,
      priority: record.work_orders?.priority || 'MEDIUM',
      status: record.work_orders?.status || 'COMPLETED',
      scheduledDate: null,
      completedDate: record.executedAt.toISOString(),
      isFromChecklist: false,
      mttr: record.mttr ?? null,
      mtbf: record.mtbf ?? null,
      cost: record.cost ?? null
    }));

    // Combinar y ordenar
    const combinedHistory = [...workOrderHistory, ...templateHistory, ...maintenanceHistoryData]
      .sort((a, b) => new Date(b.executedAt).getTime() - new Date(a.executedAt).getTime());

    // Paginar
    const startIndex = page * pageSize;
    const paginatedHistory = combinedHistory.slice(startIndex, startIndex + pageSize);
    const hasMore = startIndex + pageSize < combinedHistory.length;

    return NextResponse.json({
      success: true,
      data: { executions: paginatedHistory },
      pagination: {
        page,
        pageSize,
        total: combinedHistory.length,
        hasMore,
        nextPage: hasMore ? page + 1 : null
      }
    });

  } catch (error) {
    console.error('Error fetching maintenance history:', error);
    return NextResponse.json({ error: 'Failed to fetch maintenance history' }, { status: 500 });
  }
}
