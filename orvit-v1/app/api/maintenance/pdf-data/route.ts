import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

interface PDFDataResult {
  preventiveMaintenances: any[];
  correctiveMaintenances: any[];
  machines: any[];
  unidadesMoviles: any[];
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const sectorId = searchParams.get('sectorId');
    const machineIds = searchParams.get('machineIds'); // Comma-separated
    const unidadMovilIds = searchParams.get('unidadMovilIds'); // Comma-separated
    const maintenanceTypes = searchParams.get('maintenanceTypes'); // Comma-separated
    const componentIds = searchParams.get('componentIds'); // Comma-separated
    const subcomponentIds = searchParams.get('subcomponentIds'); // Comma-separated

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId es requerido' },
        { status: 400 }
      );
    }

    const machineIdArray = machineIds ? machineIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id)) : [];
    const unidadMovilIdArray = unidadMovilIds ? unidadMovilIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id)) : [];
    const typeArray = maintenanceTypes ? maintenanceTypes.split(',').filter(type => type.trim()) : [];
    const componentIdArray = componentIds ? componentIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id)) : [];
    const subcomponentIdArray = subcomponentIds ? subcomponentIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id)) : [];

    const result: PDFDataResult = {
      preventiveMaintenances: [],
      correctiveMaintenances: [],
      machines: [],
      unidadesMoviles: []
    };

    // Obtener información de las máquinas seleccionadas o TODAS si no hay filtro
    const machineWhere: any = {
      companyId: parseInt(companyId)
    };
    
    // Si hay IDs específicos, filtrar por ellos
    if (machineIdArray.length > 0) {
      machineWhere.id = { in: machineIdArray };
    }
    
    // Si hay sectorId, agregarlo al filtro
    if (sectorId) {
      machineWhere.sectorId = parseInt(sectorId);
    }
    
    result.machines = await prisma.machine.findMany({
      where: machineWhere,
      select: {
        id: true,
        name: true,
        nickname: true,
        type: true,
        brand: true,
        model: true,
        status: true,
        sector: {
          select: {
            id: true,
            name: true,
            area: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    // Obtener información de las unidades móviles seleccionadas o TODAS si no hay filtro
    const unidadMovilWhere: any = {
      companyId: parseInt(companyId)
    };
    
    // Si hay IDs específicos, filtrar por ellos
    if (unidadMovilIdArray.length > 0) {
      unidadMovilWhere.id = { in: unidadMovilIdArray };
    }
    
    // Si hay sectorId, agregarlo al filtro
    if (sectorId) {
      unidadMovilWhere.sectorId = parseInt(sectorId);
    }
    
    result.unidadesMoviles = await prisma.unidadMovil.findMany({
      where: unidadMovilWhere,
      select: {
        id: true,
        nombre: true,
        tipo: true,
        marca: true,
        modelo: true,
        patente: true,
        estado: true,
        sector: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: { nombre: 'asc' }
    });

    // ✅ MIGRADO: Queries directas a preventiveTemplate/preventiveInstance en lugar de JSON-in-Document
    if (typeArray.includes('PREVENTIVE')) {

      // Construir filtros para preventiveTemplate
      const templateWhere: any = {
        companyId: parseInt(companyId),
        isActive: true,
      };

      if (sectorId) templateWhere.sectorId = parseInt(sectorId);

      // Filtros de activos (máquinas / unidades móviles)
      if (machineIdArray.length > 0 && unidadMovilIdArray.length > 0) {
        templateWhere.OR = [
          { machineId: { in: machineIdArray } },
          { unidadMovilId: { in: unidadMovilIdArray } },
        ];
      } else if (machineIdArray.length > 0) {
        templateWhere.machineId = { in: machineIdArray };
      } else if (unidadMovilIdArray.length > 0) {
        templateWhere.unidadMovilId = { in: unidadMovilIdArray };
      }

      // Filtros de componentes / subcomponentes (usando hasSome para arrays JSON)
      if (componentIdArray.length > 0) {
        templateWhere.componentIds = { hasSome: componentIdArray };
      }
      if (subcomponentIdArray.length > 0) {
        templateWhere.subcomponentIds = { hasSome: subcomponentIdArray };
      }

      const preventiveTemplates = await prisma.preventiveTemplate.findMany({
        where: templateWhere,
        include: {
          instances: {
            orderBy: { scheduledDate: 'asc' },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      result.preventiveMaintenances = preventiveTemplates.map((tpl) => {
        // Map instances to plain data objects (same shape as before)
        const instancesData = tpl.instances.map((inst) => ({
          id: inst.id,
          templateId: inst.templateId,
          scheduledDate: inst.scheduledDate?.toISOString() || null,
          status: inst.status,
          actualStartDate: inst.actualStartDate?.toISOString() || null,
          actualEndDate: inst.actualEndDate?.toISOString() || null,
          actualHours: inst.actualHours,
          completedById: inst.completedById,
          completionNotes: inst.completionNotes,
          toolsUsed: inst.toolsUsed,
          photoUrls: inst.photoUrls,
        }));

        return {
          id: tpl.id,
          title: tpl.title,
          description: tpl.description,
          priority: tpl.priority,
          notes: tpl.notes,
          machineId: tpl.machineId,
          machineName: tpl.machineName,
          unidadMovilId: tpl.unidadMovilId,
          isMobileUnit: tpl.isMobileUnit,
          componentIds: tpl.componentIds || [],
          componentNames: tpl.componentNames || [],
          subcomponentIds: tpl.subcomponentIds || [],
          subcomponentNames: tpl.subcomponentNames || [],
          frequencyDays: tpl.frequencyDays,
          nextMaintenanceDate: tpl.nextMaintenanceDate?.toISOString() || null,
          lastMaintenanceDate: tpl.lastMaintenanceDate?.toISOString() || null,
          weekdaysOnly: tpl.weekdaysOnly,
          estimatedHours: tpl.estimatedHours,
          timeUnit: tpl.timeUnit,
          timeValue: tpl.timeValue,
          executionWindow: tpl.executionWindow,
          toolsRequired: tpl.toolsRequired || [],
          assignedToId: tpl.assignedToId,
          assignedToName: tpl.assignedToName,
          companyId: tpl.companyId,
          sectorId: tpl.sectorId,
          isActive: tpl.isActive,
          instructives: tpl.instructives || [],
          alertDaysBefore: tpl.alertDaysBefore || [],
          maintenanceCount: tpl.maintenanceCount,
          averageDuration: tpl.averageDuration,
          lastExecutionDuration: tpl.lastExecutionDuration,
          executionHistory: tpl.executionHistory || [],
          createdAt: tpl.createdAt?.toISOString() || null,
          instances: instancesData,
          // Resolve machine and unidadMovil from already-fetched result arrays
          machine: tpl.machineId ? result.machines.find((m: any) => m.id === tpl.machineId) : null,
          unidadMovil: tpl.unidadMovilId ? result.unidadesMoviles.find((u: any) => u.id === tpl.unidadMovilId) : null,
          // Frequency fields for MaintenanceScreenView compatibility
          frequency: tpl.frequencyDays,
          frequencyUnit: 'DAYS',
          // Component/subcomponent names are already stored in the template columns
          componentName: (tpl.componentNames as string[])?.[0] || undefined,
          subcomponentName: (tpl.subcomponentNames as string[])?.[0] || undefined,
        };
      });
    }

    // Obtener mantenimientos correctivos (Work Orders) si está seleccionado
    if (typeArray.includes('CORRECTIVE') || typeArray.includes('PREDICTIVE') || typeArray.includes('EMERGENCY')) {

      const workOrderWhere: any = {
        companyId: parseInt(companyId)
      };

      // Para work orders, filtrar por máquinas y unidades móviles
      if (machineIdArray.length > 0 || unidadMovilIdArray.length > 0) {
        workOrderWhere.OR = [];

        if (machineIdArray.length > 0) {
          workOrderWhere.OR.push({ machineId: { in: machineIdArray } });
        }

        if (unidadMovilIdArray.length > 0) {
          workOrderWhere.OR.push({ unidadMovilId: { in: unidadMovilIdArray } });
        }
      }

      // Filtrar por componentes si se especificaron
      // Nota: WorkOrder solo tiene componentId, no subcomponentId
      if (componentIdArray.length > 0) {
        workOrderWhere.componentId = { in: componentIdArray };
      }

      // Filtrar por tipos específicos
      const workOrderTypes = typeArray.filter(type =>
        ['CORRECTIVE', 'PREDICTIVE', 'EMERGENCY'].includes(type)
      );

      if (workOrderTypes.length > 0) {
        workOrderWhere.type = { in: workOrderTypes };
      }

      const workOrders = await prisma.workOrder.findMany({
        where: workOrderWhere,
        include: {
          machine: {
            select: {
              id: true,
              name: true,
              nickname: true,
              type: true,
              brand: true,
              model: true,
              status: true,
              sector: {
                select: {
                  id: true,
                  name: true,
                  area: {
                    select: {
                      id: true,
                      name: true
                    }
                  }
                }
              }
            }
          },
          component: {
            select: {
              id: true,
              name: true
            }
          },
          assignedTo: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      // Obtener unidades móviles para los work orders que las tienen
      const workOrdersWithUnidadMovil = workOrders.filter((wo: any) => wo.unidadMovilId);
      const unidadMovilIds = workOrdersWithUnidadMovil.map((wo: any) => wo.unidadMovilId).filter(Boolean);
      
      let unidadesMovilesForWorkOrders: any[] = [];
      if (unidadMovilIds.length > 0) {
        unidadesMovilesForWorkOrders = await prisma.unidadMovil.findMany({
          where: {
            id: { in: unidadMovilIds }
          },
          select: {
            id: true,
            nombre: true,
            tipo: true,
            marca: true,
            modelo: true,
            patente: true,
            estado: true,
            sector: {
              select: {
                id: true,
                name: true
              }
            }
          }
        });
      }

      result.correctiveMaintenances = workOrders.map(wo => ({
        id: wo.id,
        title: wo.title,
        description: wo.description,
        type: wo.type,
        priority: wo.priority,
        status: wo.status,
        scheduledDate: wo.scheduledDate,
        completedDate: wo.completedDate,
        createdAt: wo.createdAt,
        updatedAt: wo.updatedAt,
        machine: wo.machine,
        unidadMovil: (wo as any).unidadMovilId ? unidadesMovilesForWorkOrders.find(u => u.id === (wo as any).unidadMovilId) : null,
        assignedTo: wo.assignedTo,
        createdBy: wo.createdBy,
        estimatedDuration: wo.estimatedHours,
        actualDuration: wo.actualHours,
        cost: wo.cost,
        notes: wo.notes,
        // Agregar nombre del componente (WorkOrder no tiene subcomponent)
        componentId: (wo as any).componentId,
        componentName: (wo as any).component?.name
      }));
    }

    // Ordenar mantenimientos por periodicidad y máquina/unidad móvil
    const sortMaintenances = (maintenances: any[]) => {
      return maintenances.sort((a, b) => {
        // Primero por máquina o unidad móvil
        const assetA = a.machine?.name || a.unidadMovil?.nombre || '';
        const assetB = b.machine?.name || b.unidadMovil?.nombre || '';
        
        if (assetA !== assetB) {
          return assetA.localeCompare(assetB);
        }
        
        // Luego por periodicidad (frecuencia)
        const freqA = a.frequency || a.scheduledDate || a.createdAt;
        const freqB = b.frequency || b.scheduledDate || b.createdAt;
        
        if (freqA && freqB) {
          return new Date(freqA).getTime() - new Date(freqB).getTime();
        }
        
        return 0;
      });
    };

    result.preventiveMaintenances = sortMaintenances(result.preventiveMaintenances);
    result.correctiveMaintenances = sortMaintenances(result.correctiveMaintenances);

    return NextResponse.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('❌ Error en GET /api/maintenance/pdf-data:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
