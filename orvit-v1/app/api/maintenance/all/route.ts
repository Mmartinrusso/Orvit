import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// ✅ OPTIMIZADO: Eliminados console.log excesivos y queries en loops

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const sectorId = searchParams.get('sectorId');
    const machineId = searchParams.get('machineId');
    const priority = searchParams.get('priority');
    const type = searchParams.get('type');
    const status = searchParams.get('status');
    const minFrequencyDays = searchParams.get('minFrequencyDays');
    const maxFrequencyDays = searchParams.get('maxFrequencyDays');
    const machineIds = searchParams.get('machineIds');
    const unidadMovilIds = searchParams.get('unidadMovilIds');

    if (!companyId) {
      return NextResponse.json({ error: 'companyId es requerido' }, { status: 400 });
    }

    const companyIdNum = parseInt(companyId);
    const cleanSectorId = sectorId && sectorId !== 'null' && sectorId !== 'undefined' ? parseInt(sectorId) : null;
    const cleanMachineId = machineId && machineId !== 'null' && machineId !== 'undefined' ? parseInt(machineId) : null;

    // ✅ OPTIMIZACIÓN: Construir filtros de work orders
    const workOrderWhere: any = { companyId: companyIdNum };

    if (status && status !== 'all') workOrderWhere.status = status;
    if (cleanMachineId) {
      workOrderWhere.machineId = cleanMachineId;
    } else if (machineIds) {
      const ids = machineIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
      if (ids.length > 0) workOrderWhere.machineId = { in: ids };
    } else if (unidadMovilIds) {
      const ids = unidadMovilIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
      if (ids.length > 0) workOrderWhere.unidadMovilId = { in: ids };
    }
    if (priority) workOrderWhere.priority = priority;
    if (type && type !== 'PREVENTIVE') workOrderWhere.type = type;

    // Filtro de sector
    if (cleanSectorId && !cleanMachineId) {
      workOrderWhere.OR = [
        { sectorId: cleanSectorId },
        { machine: { sectorId: cleanSectorId } },
        { AND: [{ unidadMovilId: { not: null } }, { sectorId: null }] }
      ];
    }

    // ✅ OPTIMIZACIÓN: Ejecutar queries en paralelo
    const [allWorkOrders, preventiveTemplates] = await Promise.all([
      prisma.workOrder.findMany({
        where: workOrderWhere,
        include: {
          machine: { select: { id: true, name: true, type: true, status: true, sectorId: true } },
          component: { select: { id: true, name: true, type: true } },
          assignedTo: { select: { id: true, name: true, email: true } },
          assignedWorker: { select: { id: true, name: true, phone: true } },
          sector: { select: { id: true, name: true } },
          unidadMovil: { select: { id: true, nombre: true, tipo: true, estado: true } },
          attachments: { select: { id: true, url: true, fileName: true, fileType: true, fileSize: true, uploadedAt: true } }
        },
        orderBy: [{ createdAt: 'desc' }],
        take: 200
      }),

      (!type || type === 'PREVENTIVE') ? prisma.document.findMany({
        where: {
          entityType: 'PREVENTIVE_MAINTENANCE_TEMPLATE',
          url: { contains: `"companyId":${companyId}` }
        },
        orderBy: { updatedAt: 'desc' },
        take: 300
      }) : Promise.resolve([])
    ]);

    // ✅ OPTIMIZACIÓN: Procesar templates sin queries en loop
    const machineIdsToFetch = new Set<number>();
    const unidadMovilIdsToFetch = new Set<number>();
    const validTemplates: any[] = [];

    for (const template of preventiveTemplates) {
      try {
        const data = JSON.parse(template.url);

        // Filtros
        if (cleanSectorId && data.sectorId !== cleanSectorId) continue;
        if (cleanMachineId && data.machineId !== cleanMachineId) continue;
        if (machineIds) {
          const ids = machineIds.split(',').map(id => parseInt(id.trim()));
          if (!ids.includes(data.machineId)) continue;
        }
        if (unidadMovilIds) {
          const ids = unidadMovilIds.split(',').map(id => parseInt(id.trim()));
          if (!ids.includes(data.unidadMovilId)) continue;
        }
        if (minFrequencyDays && (data.frequencyDays || 0) < parseInt(minFrequencyDays)) continue;
        if (maxFrequencyDays && (data.frequencyDays || 0) > parseInt(maxFrequencyDays)) continue;

        // Determinar status
        const isCompleted = !!data.lastMaintenanceDate;
        const maintenanceStatus = isCompleted ? 'COMPLETED' : 'PENDING';
        if (status && status !== 'all' && status !== maintenanceStatus) continue;

        if (data.machineId) machineIdsToFetch.add(data.machineId);
        if (data.unidadMovilId) unidadMovilIdsToFetch.add(data.unidadMovilId);

        validTemplates.push({ template, data, isCompleted, maintenanceStatus });
      } catch (e) {
        // Skip invalid
      }
    }

    // ✅ OPTIMIZACIÓN: Batch queries
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

    const machinesMap = new Map(machines.map(m => [m.id, m]));
    const unidadesMap = new Map(unidadesMoviles.map(u => [u.id, u]));

    // Construir preventivos
    const preventiveMaintenances = validTemplates.map(({ template, data, isCompleted, maintenanceStatus }) => {
      const machine = data.machineId ? machinesMap.get(data.machineId) : null;
      const unidadMovil = data.unidadMovilId ? unidadesMap.get(data.unidadMovilId) : null;

      let nextMaintenanceDate = null;
      if (data.lastMaintenanceDate && data.frequencyDays) {
        const lastDate = new Date(data.lastMaintenanceDate);
        nextMaintenanceDate = new Date(lastDate);
        nextMaintenanceDate.setDate(nextMaintenanceDate.getDate() + data.frequencyDays);
      } else if (data.nextMaintenanceDate) {
        nextMaintenanceDate = new Date(data.nextMaintenanceDate);
      }

      // Construir arrays de componentes y subcomponentes
      const componentIds = Array.isArray(data.componentIds) ? data.componentIds : [];
      const subcomponentIds = Array.isArray(data.subcomponentIds) ? data.subcomponentIds : [];
      const componentNames = Array.isArray(data.componentNames) ? data.componentNames : [];
      const subcomponentNames = Array.isArray(data.subcomponentNames) ? data.subcomponentNames : [];

      const components = componentIds.map((id: number, index: number) => ({
        id,
        name: componentNames[index] || `Componente ${id}`
      }));

      const subcomponents = subcomponentIds.map((id: number, index: number) => ({
        id,
        name: subcomponentNames[index] || `Subcomponente ${id}`
      }));

      return {
        id: template.id,
        title: data.title,
        description: data.description,
        priority: data.priority || 'MEDIUM',
        type: 'PREVENTIVE',
        status: maintenanceStatus,
        scheduledDate: isCompleted ? new Date(data.lastMaintenanceDate) : nextMaintenanceDate,
        completedDate: isCompleted ? new Date(data.lastMaintenanceDate) : null,
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
        sector: data.sectorId ? { id: data.sectorId, name: 'Sector' } : null,
        isPreventive: true,
        frequencyDays: data.frequencyDays,
        frequency: data.frequency || data.frequencyDays,
        frequencyUnit: data.frequencyUnit,
        lastMaintenanceDate: data.lastMaintenanceDate,
        nextMaintenanceDate: nextMaintenanceDate?.toISOString(),
        instructives: data.instructives || [],
        toolsRequired: data.toolsRequired || [],
        tags: data.tags || [],
        componentIds,
        componentNames,
        subcomponentIds,
        subcomponentNames,
        components,
        subcomponents,
        executionWindow: data.executionWindow,
        createdAt: template.createdAt,
        updatedAt: template.updatedAt
      };
    });

    // Mapear work orders
    const mappedWorkOrders = allWorkOrders.map(wo => {
      // ✅ Extraer datos de notes para obtener timeUnit, componentes, etc.
      let notesData: any = {};
      try {
        if (wo.notes) {
          notesData = JSON.parse(wo.notes);
        }
      } catch (e) {
        // Si no es JSON válido, ignorar
      }

      return {
        ...wo,
        type: wo.type || 'CORRECTIVE',
        isPreventive: false,
        assignedToName: wo.assignedTo?.name || wo.assignedWorker?.name || 'Sin asignar',
        // ✅ Extraer timeUnit y timeValue de notes
        timeUnit: notesData.timeUnit || notesData.solutionTimeUnit || 'hours',
        timeValue: notesData.estimatedTime || wo.estimatedHours || 0,
        // ✅ Extraer componentes afectados
        affectedComponents: notesData.affectedComponents || [],
        componentNames: notesData.componentNames || [],
        failureType: notesData.failureType,
        solution: notesData.solution || wo.solution,
        // ✅ Extraer información del reportador (quien reportó la falla)
        reportedByName: notesData.reportedByName || null,
        reportedById: notesData.reportedById || null,
        // ✅ Extraer información de quien aplicó la solución
        appliedBy: notesData.appliedBy || null,
        appliedDate: notesData.appliedDate || null,
        instructives: wo.attachments?.map(a => ({
          id: a.id,
          url: a.url,
          fileName: a.fileName,
          uploadedAt: a.uploadedAt
        })) || []
      };
    });

    // Combinar y ordenar por fecha
    const allMaintenances = [...mappedWorkOrders, ...preventiveMaintenances]
      .sort((a, b) => {
        const dateA = new Date(a.createdAt || a.scheduledDate || 0);
        const dateB = new Date(b.createdAt || b.scheduledDate || 0);
        return dateB.getTime() - dateA.getTime();
      });

    return NextResponse.json({
      maintenances: allMaintenances,
      total: allMaintenances.length,
      workOrdersCount: mappedWorkOrders.length,
      preventiveCount: preventiveMaintenances.length
    });

  } catch (error) {
    console.error('Error fetching all maintenances:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
