import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logApiPerformance, logApiError } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * ✨ ENDPOINT AGREGADOR: Detalle completo de una máquina
 * Consolida todos los datos necesarios para el modal de detalle
 * 
 * ANTES: 5-8 requests (machine, components, failures, workOrders, documents, etc.)
 * DESPUÉS: 1 request
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const machineId = searchParams.get('machineId');
  
  const perf = logApiPerformance('machines/detail', { machineId });

  try {
    // Validación robusta
    if (!machineId) {
      perf.end({ error: 'machineId missing' });
      return NextResponse.json(
        { error: 'machineId es requerido' },
        { status: 400 }
      );
    }

    const machineIdNum = parseInt(machineId, 10);
    
    if (isNaN(machineIdNum)) {
      perf.end({ error: 'invalid machineId' });
      return NextResponse.json(
        { error: 'machineId debe ser un número válido' },
        { status: 400 }
      );
    }

    // Obtener companyId de la máquina primero para queries adicionales
    const machineBasic = await getMachineBasic(machineIdNum).catch(err => {
      console.error('[MACHINE_BASIC_ERROR]', err);
      return null;
    });

    if (!machineBasic) {
      perf.end({ error: 'machine not found' });
      return NextResponse.json(
        { error: 'Máquina no encontrada' },
        { status: 404 }
      );
    }

    const companyId = machineBasic.companyId;

    // ✨ OPTIMIZACIÓN: Ejecutar todas las queries en paralelo con manejo de errores individual
    const [components, failures, workOrders, documents, maintenanceHistory, tools, spareParts] = await Promise.all([
      getComponents(machineIdNum).catch(err => {
        console.error('[COMPONENTS_ERROR]', err);
        return [];
      }),
      getFailures(machineIdNum).catch(err => {
        console.error('[FAILURES_ERROR]', err);
        return [];
      }),
      getWorkOrders(machineIdNum).catch(err => {
        console.error('[WORK_ORDERS_ERROR]', err);
        return [];
      }),
      getDocuments(machineIdNum).catch(err => {
        console.error('[DOCUMENTS_ERROR]', err);
        return [];
      }),
      getMaintenanceHistory(machineIdNum).catch(err => {
        console.error('[MAINTENANCE_HISTORY_ERROR]', err);
        return [];
      }),
      getTools(companyId).catch(err => {
        console.error('[TOOLS_ERROR]', err);
        return [];
      }),
      getSpareParts(companyId).catch(err => {
        console.error('[SPARE_PARTS_ERROR]', err);
        return [];
      })
    ]);

    const machine = machineBasic;

    // Calcular stats de forma segura
    const openFailures = failures.filter(f => 
      f.status && !['RESOLVED', 'CLOSED', 'COMPLETADA'].includes(f.status.toUpperCase())
    ).length;
    
    const pendingWorkOrders = workOrders.filter(wo => 
      wo.status === 'PENDING' || wo.status === 'IN_PROGRESS'
    ).length;

    return NextResponse.json({
      machine,
      components,
      failures,
      workOrders,
      documents,
      maintenanceHistory,
      tools,
      spareParts,
      stats: {
        totalComponents: components.length,
        openFailures,
        pendingWorkOrders,
        completedMaintenances: maintenanceHistory.length,
        totalWorkOrders: workOrders.length,
        totalDocuments: documents.length,
        totalTools: tools.length,
        totalSpareParts: spareParts.length
      },
      metadata: {
        machineId: machineIdNum,
        companyId,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('[MACHINES_DETAIL_ERROR]', error);
    return NextResponse.json(
      { 
        error: 'Error interno del servidor',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

async function getMachineBasic(machineId: number) {
  return prisma.machine.findUnique({
    where: { id: machineId },
    include: {
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
      },
      company: {
        select: {
          id: true,
          name: true
        }
      }
    }
  });
}

async function getComponents(machineId: number) {
  // ✨ OPTIMIZADO: Obtener todos los componentes con conteo de hijos en una query
  // y construir la jerarquía completa recursiva en memoria
  const allComponents = await prisma.component.findMany({
    where: { machineId },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      code: true,
      itemNumber: true, // Posición en el plano de despiece
      quantity: true, // Cantidad en el ensamble
      type: true,
      description: true,
      parentId: true,
      technicalInfo: true,
      logo: true,
      system: true,
      model3dUrl: true, // URL del modelo 3D
      createdAt: true,
      _count: {
        select: { children: true }
      },
      // Incluir herramientas/repuestos del componente con su modelo 3D
      tools: {
        select: {
          id: true,
          quantityNeeded: true,
          tool: {
            select: {
              id: true,
              name: true,
              brand: true,
              model: true,
              code: true,
              model3dUrl: true, // URL del modelo 3D del tool
            }
          }
        }
      }
    }
  });

  // Construir jerarquía COMPLETA en memoria (O(n) en vez de queries adicionales)
  const componentsMap = new Map<number, any>();
  const rootComponents: any[] = [];

  // Primera pasada: crear mapa con todos los datos y array vacío de children
  allComponents.forEach(c => {
    componentsMap.set(c.id, {
      id: c.id,
      name: c.name,
      code: c.code,
      itemNumber: c.itemNumber, // Posición en el plano de despiece
      quantity: c.quantity, // Cantidad en el ensamble
      type: c.type,
      description: c.description,
      parentId: c.parentId,
      technicalInfo: c.technicalInfo,
      logo: c.logo,
      system: c.system,
      model3dUrl: c.model3dUrl, // URL del modelo 3D
      createdAt: c.createdAt,
      _count: c._count,
      children: [],
      // Transformar tools para incluir los datos del tool directamente
      tools: c.tools.map(ct => ({
        id: ct.tool.id,
        name: ct.tool.name,
        brand: ct.tool.brand,
        model: ct.tool.model,
        partNumber: ct.tool.code,
        model3dUrl: ct.tool.model3dUrl,
        quantityNeeded: ct.quantityNeeded,
      }))
    });
  });

  // Segunda pasada: construir árbol con children completos (recursivo)
  allComponents.forEach(c => {
    const component = componentsMap.get(c.id);
    if (c.parentId === null) {
      rootComponents.push(component);
    } else {
      const parent = componentsMap.get(c.parentId);
      if (parent) {
        // Agregar el componente COMPLETO como hijo (no solo datos básicos)
        parent.children.push(component);
      }
    }
  });

  return rootComponents;
}

async function getFailures(machineId: number) {
  // El modelo Failure usa machine_id (snake_case)
  return prisma.failure.findMany({
    where: { machine_id: machineId },
    take: 20,
    orderBy: { created_at: 'desc' },
    select: {
      id: true,
      title: true,
      description: true,
      failure_type: true,
      priority: true,
      status: true,
      reported_date: true,
      estimated_hours: true,
      affected_components: true,
      created_at: true
    }
  });
}

async function getWorkOrders(machineId: number) {
  return prisma.workOrder.findMany({
    where: { machineId },
    take: 30,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      title: true,
      description: true,
      type: true,
      status: true,
      priority: true,
      scheduledDate: true,
      completedDate: true,
      startedDate: true,
      estimatedHours: true,
      actualHours: true,
      createdAt: true,
      assignedTo: {
        select: {
          id: true,
          name: true
        }
      },
      assignedWorker: {
        select: {
          id: true,
          name: true
        }
      },
      component: {
        select: {
          id: true,
          name: true
        }
      }
    }
  });
}

async function getDocuments(machineId: number) {
  return prisma.document.findMany({
    where: { machineId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      fileName: true,
      type: true,
      url: true,
      fileSize: true,
      createdAt: true,
      uploadedBy: {
        select: {
          id: true,
          name: true
        }
      }
    }
  });
}

async function getMaintenanceHistory(machineId: number) {
  // Usar el modelo maintenance_history correcto
  return prisma.maintenance_history.findMany({
    where: { machineId },
    take: 50,
    orderBy: { executedAt: 'desc' },
    select: {
      id: true,
      workOrderId: true,
      executedAt: true,
      duration: true,
      cost: true,
      notes: true,
      rootCause: true,
      correctiveActions: true,
      preventiveActions: true,
      spareParts: true,
      nextMaintenanceDate: true,
      completionRate: true,
      qualityScore: true,
      createdAt: true,
      User: {
        select: {
          id: true,
          name: true
        }
      },
      Component: {
        select: {
          id: true,
          name: true
        }
      },
      work_orders: {
        select: {
          id: true,
          title: true,
          type: true,
          status: true
        }
      }
    }
  });
}


async function getTools(companyId: number) {
  return prisma.tool.findMany({
    where: {
      companyId,
      itemType: 'TOOL'
    },
    take: 100, // Límite para performance
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      description: true,
      code: true,
      category: true,
      brand: true,
      model: true,
      stockQuantity: true,
      minStockLevel: true,
      status: true,
      location: true
    }
  });
}

async function getSpareParts(companyId: number) {
  return prisma.tool.findMany({
    where: {
      companyId,
      itemType: 'SUPPLY'
    },
    take: 100, // Límite para performance
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      description: true,
      code: true,
      category: true,
      brand: true,
      model: true,
      stockQuantity: true,
      minStockLevel: true,
      status: true,
      location: true
    }
  });
}
