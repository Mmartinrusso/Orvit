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

    console.log('🚀 PDF-DATA endpoint called with params:', {
      companyId,
      sectorId,
      machineIds,
      unidadMovilIds,
      maintenanceTypes,
      componentIds,
      subcomponentIds
    });

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

    console.log('🔍 Arrays procesados:', {
      machineIdArray,
      unidadMovilIdArray,
      typeArray,
      componentIdArray,
      subcomponentIdArray
    });


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

    // Obtener mantenimientos preventivos si está seleccionado
    if (typeArray.includes('PREVENTIVE')) {
      
      const preventiveWhere: any = {
        entityType: 'PREVENTIVE_MAINTENANCE_TEMPLATE'
      };

      // Filtrar por companyId y sectorId usando el campo url que contiene JSON
      if (companyId) {
        const companyIdFilter = `"companyId":${parseInt(companyId)}`;
        const sectorIdFilter = sectorId ? `"sectorId":${parseInt(sectorId)}` : '';
        const urlFilter = sectorIdFilter ? `${companyIdFilter},${sectorIdFilter}` : companyIdFilter;
        preventiveWhere.url = { contains: urlFilter };
      }

      const preventiveTemplates = await prisma.document.findMany({
        where: preventiveWhere,
        orderBy: {
          createdAt: 'desc'
        }
      });

      console.log('🔍 Templates preventivos encontrados:', {
        total: preventiveTemplates.length,
        companyId: parseInt(companyId),
        where: preventiveWhere
      });


      // Filtrar por companyId, machineIds, unidadMovilIds, componentIds y subcomponentIds
      console.log('🔍 Filtros aplicados:', {
        machineIdArray,
        unidadMovilIdArray,
        componentIdArray,
        subcomponentIdArray,
        totalTemplates: preventiveTemplates.length
      });

      const filteredPreventiveTemplates = preventiveTemplates.filter(template => {
        try {
          const data = JSON.parse(template.url);
          const matchesCompany = data.companyId === Number(companyId);

          // Para máquinas: verificar si hay machineId y está en la lista
          const matchesMachine = data.machineId && machineIdArray.length > 0 && machineIdArray.includes(data.machineId);

          // Para unidades móviles: verificar si hay unidadMovilId y está en la lista
          const matchesUnidadMovil = data.unidadMovilId && unidadMovilIdArray.length > 0 && unidadMovilIdArray.includes(data.unidadMovilId);

          // Para componentes: verificar si hay componentId o componentIds
          let matchesComponent = false;
          if (componentIdArray.length > 0) {
            // Puede tener un solo componentId o un array componentIds
            if (data.componentId && componentIdArray.includes(data.componentId)) {
              matchesComponent = true;
            }
            if (data.componentIds && Array.isArray(data.componentIds)) {
              matchesComponent = data.componentIds.some((id: number) => componentIdArray.includes(id));
            }
          }

          // Para subcomponentes: verificar si hay subcomponentId o subcomponentIds
          let matchesSubcomponent = false;
          if (subcomponentIdArray.length > 0) {
            if (data.subcomponentId && subcomponentIdArray.includes(data.subcomponentId)) {
              matchesSubcomponent = true;
            }
            if (data.subcomponentIds && Array.isArray(data.subcomponentIds)) {
              matchesSubcomponent = data.subcomponentIds.some((id: number) => subcomponentIdArray.includes(id));
            }
          }

          // Si no se especificaron filtros de máquinas/unidades, incluir todo
          const noAssetFilters = (machineIdArray.length === 0 && unidadMovilIdArray.length === 0);
          const noComponentFilters = (componentIdArray.length === 0 && subcomponentIdArray.length === 0);

          // Si se especificaron filtros, verificar que el mantenimiento coincida con alguno
          // Si no se especificaron filtros, incluir todos los mantenimientos de la empresa
          let shouldInclude = false;
          if (noAssetFilters && noComponentFilters) {
            // Sin filtros: incluir todo de la empresa
            shouldInclude = matchesCompany;
          } else if (!noAssetFilters && noComponentFilters) {
            // Solo filtros de activos: coincide con máquina o unidad móvil
            shouldInclude = matchesCompany && (matchesMachine || matchesUnidadMovil);
          } else if (noAssetFilters && !noComponentFilters) {
            // Solo filtros de componentes: coincide con componente o subcomponente
            shouldInclude = matchesCompany && (matchesComponent || matchesSubcomponent);
          } else {
            // Ambos tipos de filtros: coincide con activo Y con componente/subcomponente
            const matchesAsset = matchesMachine || matchesUnidadMovil;
            const matchesComponentOrSubcomponent = matchesComponent || matchesSubcomponent || (componentIdArray.length === 0 && subcomponentIdArray.length === 0);
            shouldInclude = matchesCompany && matchesAsset && matchesComponentOrSubcomponent;
          }

          return shouldInclude;
        } catch (error) {
          console.error('❌ Error parsing template:', template.id, error);
          return false;
        }
      });


      // Recolectar todos los IDs de componentes y subcomponentes únicos
      const allComponentIds = new Set<number>();
      const allSubcomponentIds = new Set<number>();

      filteredPreventiveTemplates.forEach(template => {
        try {
          const data = JSON.parse(template.url);
          if (data.componentId) allComponentIds.add(data.componentId);
          if (data.componentIds && Array.isArray(data.componentIds)) {
            data.componentIds.forEach((id: number) => allComponentIds.add(id));
          }
          if (data.subcomponentId) allSubcomponentIds.add(data.subcomponentId);
          if (data.subcomponentIds && Array.isArray(data.subcomponentIds)) {
            data.subcomponentIds.forEach((id: number) => allSubcomponentIds.add(id));
          }
        } catch {}
      });

      // Obtener nombres de componentes
      const componentMap = new Map<number, string>();
      if (allComponentIds.size > 0) {
        const components = await prisma.component.findMany({
          where: { id: { in: Array.from(allComponentIds) } },
          select: { id: true, name: true }
        });
        components.forEach(c => componentMap.set(c.id, c.name));
      }

      // Obtener nombres de subcomponentes (también son componentes con parentId)
      if (allSubcomponentIds.size > 0) {
        const subcomponents = await prisma.component.findMany({
          where: { id: { in: Array.from(allSubcomponentIds) } },
          select: { id: true, name: true }
        });
        subcomponents.forEach(c => componentMap.set(c.id, c.name));
      }

      // Obtener instancias programadas para cada template
      const preventiveWithInstances = await Promise.all(
        filteredPreventiveTemplates.map(async (template) => {
          const instances = await prisma.document.findMany({
            where: {
              entityType: 'PREVENTIVE_MAINTENANCE_INSTANCE',
              entityId: {
                startsWith: `template-${template.id}`
              }
            },
            orderBy: {
              createdAt: 'asc'
            }
          });

          const templateData = JSON.parse(template.url);
          const instancesData = instances.map(instance => {
            try {
              return JSON.parse(instance.url);
            } catch {
              return null;
            }
          }).filter(Boolean);

          // Resolver nombres de componentes
          let componentName: string | undefined;
          let componentNames: string[] = [];
          let subcomponentName: string | undefined;
          let subcomponentNames: string[] = [];

          if (templateData.componentId) {
            componentName = componentMap.get(templateData.componentId);
          }
          if (templateData.componentIds && Array.isArray(templateData.componentIds)) {
            componentNames = templateData.componentIds
              .map((id: number) => componentMap.get(id))
              .filter(Boolean) as string[];
          }
          if (templateData.subcomponentId) {
            subcomponentName = componentMap.get(templateData.subcomponentId);
          }
          if (templateData.subcomponentIds && Array.isArray(templateData.subcomponentIds)) {
            subcomponentNames = templateData.subcomponentIds
              .map((id: number) => componentMap.get(id))
              .filter(Boolean) as string[];
          }

          return {
            id: template.id,
            ...templateData,
            instances: instancesData,
            machine: templateData.machineId ? result.machines.find(m => m.id === templateData.machineId) : null,
            unidadMovil: templateData.unidadMovilId ? result.unidadesMoviles.find(u => u.id === templateData.unidadMovilId) : null,
            // Agregar campos de frecuencia para que MaintenanceScreenView los pueda usar
            frequency: templateData.frequencyDays,
            frequencyUnit: 'DAYS',
            // Agregar nombres de componentes y subcomponentes
            componentName,
            componentNames: componentNames.length > 0 ? componentNames : undefined,
            subcomponentName,
            subcomponentNames: subcomponentNames.length > 0 ? subcomponentNames : undefined
          };
        })
      );

      result.preventiveMaintenances = preventiveWithInstances;
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

    console.log('✅ PDF data prepared:', {
      machines: result.machines.length,
      preventive: result.preventiveMaintenances.length,
      corrective: result.correctiveMaintenances.length,
      filters: {
        machineIds: machineIdArray,
        unidadMovilIds: unidadMovilIdArray,
        types: typeArray
      }
    });

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
