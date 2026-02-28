import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/shared-helpers';

export const dynamic = 'force-dynamic';

// ✅ OPTIMIZADO: Eliminados console.log excesivos y queries en loops

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

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
    const specificIds = searchParams.get('ids'); // IDs específicos para lookup sin límite

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

    // ✅ MIGRADO: Queries directas a preventiveTemplate en lugar de JSON-in-Document

    // Construir filtros para preventiveTemplate
    const templateWhere: any = {
      companyId: companyIdNum,
    };

    if (cleanSectorId) templateWhere.sectorId = cleanSectorId;
    if (cleanMachineId) {
      templateWhere.machineId = cleanMachineId;
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

    // Filtro de status para templates: COMPLETED = tiene lastMaintenanceDate, PENDING = no tiene
    if (status && status !== 'all') {
      if (status === 'COMPLETED') {
        templateWhere.lastMaintenanceDate = { not: null };
      } else if (status === 'PENDING') {
        templateWhere.lastMaintenanceDate = null;
      }
    }

    // Si se piden IDs específicos, añadirlos al filtro y omitir el take
    const specificIdsArray = specificIds
      ? specificIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id))
      : null;
    if (specificIdsArray && specificIdsArray.length > 0) {
      workOrderWhere.id = { in: specificIdsArray };
    }

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
        ...(specificIdsArray ? {} : { take: 200 })
      }),

      (!type || type === 'PREVENTIVE') ? prisma.preventiveTemplate.findMany({
        where: specificIdsArray && specificIdsArray.length > 0
          ? { companyId: companyIdNum, id: { in: specificIdsArray } }
          : templateWhere,
        include: {
          machine: { select: { id: true, name: true, type: true, status: true, sectorId: true } },
          unidadMovil: { select: { id: true, nombre: true, tipo: true, estado: true } },
          sector: { select: { id: true, name: true } },
        },
        orderBy: { updatedAt: 'desc' },
        ...(specificIdsArray ? {} : { take: 300 })
      }) : Promise.resolve([])
    ]);

    // Construir preventivos con acceso directo a columnas
    const preventiveMaintenances = preventiveTemplates.map((tpl) => {
      const isCompleted = !!tpl.lastMaintenanceDate;
      const maintenanceStatus = isCompleted ? 'COMPLETED' : 'PENDING';

      let nextMaintenanceDate: Date | null = null;
      if (tpl.lastMaintenanceDate && tpl.frequencyDays) {
        const lastDate = new Date(tpl.lastMaintenanceDate);
        nextMaintenanceDate = new Date(lastDate);
        nextMaintenanceDate.setDate(nextMaintenanceDate.getDate() + tpl.frequencyDays);
      } else if (tpl.nextMaintenanceDate) {
        nextMaintenanceDate = new Date(tpl.nextMaintenanceDate);
      }

      // Construir arrays de componentes y subcomponentes
      const componentIds = Array.isArray(tpl.componentIds) ? tpl.componentIds : [];
      const subcomponentIds = Array.isArray(tpl.subcomponentIds) ? tpl.subcomponentIds : [];
      const componentNames = Array.isArray(tpl.componentNames) ? tpl.componentNames : [];
      const subcomponentNames = Array.isArray(tpl.subcomponentNames) ? tpl.subcomponentNames : [];

      const components = componentIds.map((id: number, index: number) => ({
        id,
        name: componentNames[index] || `Componente ${id}`
      }));

      const subcomponents = subcomponentIds.map((id: number, index: number) => ({
        id,
        name: subcomponentNames[index] || `Subcomponente ${id}`
      }));

      return {
        id: tpl.id,
        title: tpl.title,
        description: tpl.description,
        priority: tpl.priority || 'MEDIUM',
        type: 'PREVENTIVE',
        status: maintenanceStatus,
        scheduledDate: isCompleted ? tpl.lastMaintenanceDate : nextMaintenanceDate,
        completedDate: isCompleted ? tpl.lastMaintenanceDate : null,
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
        sector: tpl.sector || (tpl.sectorId ? { id: tpl.sectorId, name: 'Sector' } : null),
        isPreventive: true,
        frequencyDays: tpl.frequencyDays,
        frequency: tpl.frequencyDays,
        frequencyUnit: 'DAYS',
        lastMaintenanceDate: tpl.lastMaintenanceDate?.toISOString() || null,
        nextMaintenanceDate: nextMaintenanceDate?.toISOString() || null,
        instructives: tpl.instructives || [],
        toolsRequired: tpl.toolsRequired || [],
        tags: [],
        componentIds,
        componentNames,
        subcomponentIds,
        subcomponentNames,
        components,
        subcomponents,
        executionWindow: tpl.executionWindow,
        createdAt: tpl.createdAt,
        updatedAt: tpl.updatedAt
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
