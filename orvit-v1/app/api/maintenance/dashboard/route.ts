import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { startPerf, endParse, startDb, endDb, startCompute, endCompute, startJson, endJson, withPerfHeaders, shouldDisableCache } from '@/lib/perf';

export const dynamic = 'force-dynamic';

/**
 * ✨ ENDPOINT OPTIMIZADO: Dashboard unificado de mantenimiento
 * Reemplaza múltiples requests individuales con una sola llamada
 * Usa Promise.all para ejecutar queries en paralelo
 *
 * ANTES: ~8-10 requests (pending, completed, kpis, machines, mobile units, etc.)
 * DESPUÉS: 1 request
 */
export async function GET(request: NextRequest) {
  const perfCtx = startPerf();
  const { searchParams } = new URL(request.url);

  try {
    // Autenticación
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const payload = await verifyToken(token);
    if (!payload || !payload.userId) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const companyId = searchParams.get('companyId');
    const sectorId = searchParams.get('sectorId');
    const pageSize = Math.min(parseInt(searchParams.get('pageSize') || '50', 10), 100);

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId es requerido' },
        { status: 400 }
      );
    }

    // Company boundary check
    const tokenCompanyId = payload.companyId as number | undefined;
    if (tokenCompanyId && parseInt(companyId) !== tokenCompanyId) {
      return NextResponse.json({ error: 'No autorizado para esta empresa' }, { status: 403 });
    }

    endParse(perfCtx);
    startDb(perfCtx);

    const companyIdNum = parseInt(companyId);
    const sectorIdNum = sectorId ? parseInt(sectorId) : null;

    // ✨ OPTIMIZACIÓN: Ejecutar todas las queries en paralelo con Promise.all
    const [
      pendingMaintenances,
      completedTodayMaintenances,
      machines,
      mobileUnits,
      kpisData,
      checklists,
      recentHistory
    ] = await Promise.all([
      // 1. Mantenimientos pendientes (limitados)
      getPendingMaintenances(companyIdNum, sectorIdNum, pageSize),
      
      // 2. Completados hoy (limitados)
      getCompletedTodayMaintenances(companyIdNum, sectorIdNum, pageSize),
      
      // 3. Máquinas del sector/empresa
      getMachines(companyIdNum, sectorIdNum),
      
      // 4. Unidades móviles
      getMobileUnits(companyIdNum, sectorIdNum),
      
      // 5. KPIs (calcular en paralelo)
      calculateKPIs(companyIdNum, sectorIdNum),
      
      // 6. Checklists activos
      getChecklists(companyIdNum, sectorIdNum),
      
      // 7. Historial reciente
      getRecentHistory(companyIdNum, sectorIdNum, 20)
    ]);

    endDb(perfCtx);
    startCompute(perfCtx);
    // No hay compute pesado aquí, solo preparación de datos
    endCompute(perfCtx);
    startJson(perfCtx);

    const responseData = {
      pending: pendingMaintenances,
      completedToday: completedTodayMaintenances,
      machines: machines,
      mobileUnits: mobileUnits,
      kpis: kpisData,
      checklists: checklists,
      recentHistory: recentHistory,
      metadata: {
        companyId: companyIdNum,
        sectorId: sectorIdNum,
        timestamp: new Date().toISOString(),
        pageSize
      }
    };

    const response = NextResponse.json(responseData, {
      headers: {
        // ✨ FIX: Agregar cache HTTP (2 minutos - datos cambian moderadamente)
        'Cache-Control': shouldDisableCache(searchParams) 
          ? 'no-store' 
          : 'private, max-age=120, s-maxage=120',
      }
    });

    const metrics = endJson(perfCtx, responseData);
    return withPerfHeaders(response, metrics, searchParams);

  } catch (error) {
    console.error('❌ Error en dashboard de mantenimiento:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// ============================================================================
// FUNCIONES HELPER
// ============================================================================

/**
 * Obtener mantenimientos pendientes
 * ✅ CORREGIDO: Usa el mismo filtrado que /api/maintenance/pending
 */
async function getPendingMaintenances(
  companyId: number,
  sectorId: number | null,
  limit: number
) {
  const where: any = {
    companyId: companyId,
    status: {
      in: ['PENDING', 'IN_PROGRESS']
    }
  };

  // Si hay sectorId, usar el mismo filtrado que el endpoint viejo
  if (sectorId) {
    where.OR = [
      // Caso 1: WorkOrder con sectorId directo
      { sectorId: sectorId },
      // Caso 2: WorkOrder con machine.sectorId
      {
        machine: {
          sectorId: sectorId
        }
      },
      // Caso 3: Unidades móviles sin sectorId (incluir todas las unidades móviles cuando se filtra por sector)
      {
        AND: [
          { unidadMovilId: { not: null } },
          { sectorId: null }
        ]
      }
    ];
  }

  const workOrders = await prisma.workOrder.findMany({
    where,
    take: limit,
    orderBy: [
      { priority: 'desc' },
      { scheduledDate: 'asc' }
    ],
    include: {
      machine: {
        select: {
          id: true,
          name: true,
          nickname: true,
          type: true
        }
      },
      unidadMovil: {
        select: {
          id: true,
          nombre: true,
          tipo: true,
          patente: true
        }
      }
    }
  });

  return workOrders;
}

/**
 * Obtener mantenimientos completados hoy
 * ✅ CORREGIDO: Usa el mismo filtrado que /api/maintenance/completed + /api/maintenance/pending
 */
async function getCompletedTodayMaintenances(
  companyId: number,
  sectorId: number | null,
  limit: number
) {
  // Calcular inicio y fin del día de hoy usando zona horaria configurable (TZ en .env)
  const now = new Date();
  const tz = process.env.APP_TIMEZONE || 'America/Argentina/Buenos_Aires';
  const todayStr = now.toLocaleDateString('en-CA', { timeZone: tz }); // YYYY-MM-DD
  const today = new Date(`${todayStr}T00:00:00`);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const where: any = {
    companyId: companyId,
    status: 'COMPLETED',
    completedDate: {
      gte: today,
      lt: tomorrow
    }
  };

  // Si hay sectorId, usar el mismo filtrado que los endpoints viejos
  if (sectorId) {
    where.OR = [
      // Caso 1: WorkOrder con sectorId directo
      { sectorId: sectorId },
      // Caso 2: WorkOrder con machine.sectorId
      {
        machine: {
          sectorId: sectorId
        }
      },
      // Caso 3: Unidades móviles sin sectorId
      {
        AND: [
          { unidadMovilId: { not: null } },
          { sectorId: null }
        ]
      }
    ];
  }

  const workOrders = await prisma.workOrder.findMany({
    where,
    take: limit,
    orderBy: {
      completedDate: 'desc'
    },
    include: {
      machine: {
        select: {
          id: true,
          name: true,
          nickname: true,
          type: true
        }
      },
      unidadMovil: {
        select: {
          id: true,
          nombre: true,
          tipo: true,
          patente: true
        }
      }
    }
  });

  return workOrders;
}

/**
 * Obtener máquinas
 */
async function getMachines(companyId: number, sectorId: number | null) {
  const where: any = {
    companyId: companyId
  };

  if (sectorId) {
    where.sectorId = sectorId;
  }

  const machines = await prisma.machine.findMany({
    where,
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      nickname: true,
      type: true,
      brand: true,
      model: true,
      serialNumber: true,
      status: true,
      sectorId: true,
      companyId: true
    }
  });

  return machines;
}

/**
 * Obtener unidades móviles
 */
async function getMobileUnits(companyId: number, sectorId: number | null) {
  const where: any = {
    companyId: companyId,
    estado: 'ACTIVO'
  };

  if (sectorId) {
    where.sectorId = sectorId;
  }

  const mobileUnits = await prisma.unidadMovil.findMany({
    where,
    orderBy: { nombre: 'asc' },
    select: {
      id: true,
      nombre: true,
      tipo: true,
      marca: true,
      modelo: true,
      patente: true,
      kilometraje: true,
      estado: true,
      sectorId: true,
      companyId: true
    }
  });

  return mobileUnits;
}

/**
 * Calcular KPIs del dashboard
 * ✅ CORREGIDO: Usa el mismo filtrado que los endpoints viejos
 */
async function calculateKPIs(companyId: number, sectorId: number | null) {
  // Calcular rango de fechas (mes actual)
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const baseWhere: any = {
    companyId: companyId,
    createdAt: {
      gte: startOfMonth,
      lte: endOfMonth
    }
  };

  // Si hay sectorId, usar el mismo filtrado que los endpoints viejos
  if (sectorId) {
    baseWhere.OR = [
      // Caso 1: WorkOrder con sectorId directo
      { sectorId: sectorId },
      // Caso 2: WorkOrder con machine.sectorId
      {
        machine: {
          sectorId: sectorId
        }
      },
      // Caso 3: Unidades móviles sin sectorId
      {
        AND: [
          { unidadMovilId: { not: null } },
          { sectorId: null }
        ]
      }
    ];
  }

  // Ejecutar queries de KPIs en paralelo
  const [
    totalCount,
    completedCount,
    pendingCount,
    overdueCount,
    completedOnTimeCount,
    completedWithTimes
  ] = await Promise.all([
    // Total de mantenimientos del mes
    prisma.workOrder.count({ where: baseWhere }),

    // Completados
    prisma.workOrder.count({
      where: { ...baseWhere, status: 'COMPLETED' }
    }),

    // Pendientes
    prisma.workOrder.count({
      where: {
        ...baseWhere,
        status: { in: ['PENDING', 'IN_PROGRESS'] }
      }
    }),

    // Vencidos (pendientes con fecha pasada)
    prisma.workOrder.count({
      where: {
        ...baseWhere,
        status: { in: ['PENDING', 'IN_PROGRESS'] },
        scheduledDate: { lt: new Date() }
      }
    }),

    // Completados a tiempo
    prisma.workOrder.count({
      where: {
        ...baseWhere,
        status: 'COMPLETED',
        completedDate: { not: null },
        scheduledDate: { not: null }
      }
    }),

    // Mantenimientos con tiempos registrados (para calcular promedio)
    prisma.workOrder.findMany({
      where: {
        ...baseWhere,
        status: 'COMPLETED',
        actualHours: { not: null }
      },
      select: {
        actualHours: true
      }
    })
  ]);

  // Calcular promedios
  const avgCompletionTime = completedWithTimes.length > 0
    ? completedWithTimes.reduce((sum, m) => sum + (m.actualHours || 0), 0) / completedWithTimes.length
    : 0;

  const completionRate = totalCount > 0
    ? (completedCount / totalCount) * 100
    : 0;

  const onTimeRate = completedCount > 0
    ? (completedOnTimeCount / completedCount) * 100
    : 0;

  return {
    total: totalCount,
    completed: completedCount,
    pending: pendingCount,
    overdue: overdueCount,
    completionRate: Math.round(completionRate * 10) / 10,
    onTimeRate: Math.round(onTimeRate * 10) / 10,
    avgCompletionTime: Math.round(avgCompletionTime * 10) / 10,
    period: {
      start: startOfMonth.toISOString(),
      end: endOfMonth.toISOString()
    }
  };
}


/**
 * Obtener checklists activos
 */
async function getChecklists(companyId: number, sectorId: number | null) {
  const where: any = {
    companyId: companyId,
    isActive: true
  };

  if (sectorId) {
    where.sectorId = sectorId;
  }

  try {
    const checklists = await prisma.maintenanceChecklist.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        title: true,
        description: true,
        frequency: true,
        isActive: true,
        isTemplate: true,
        category: true,
        estimatedTotalTime: true,
        machineId: true,
        sectorId: true,
        companyId: true,
        createdAt: true,
        updatedAt: true,
        machine: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });
    return checklists;
  } catch (error) {
    console.error('[CHECKLISTS_ERROR]', error);
    return [];
  }
}

/**
 * Obtener historial reciente de mantenimiento
 */
async function getRecentHistory(companyId: number, sectorId: number | null, limit: number) {
  const where: any = {};

  // Filtrar por máquinas de la empresa/sector
  if (sectorId) {
    where.Machine = {
      companyId: companyId,
      sectorId: sectorId
    };
  } else {
    where.Machine = {
      companyId: companyId
    };
  }

  try {
    const history = await prisma.maintenance_history.findMany({
      where,
      take: limit,
      orderBy: { executedAt: 'desc' },
      select: {
        id: true,
        workOrderId: true,
        machineId: true,
        executedAt: true,
        duration: true,
        notes: true,
        completionRate: true,
        createdAt: true,
        Machine: {
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
        },
        User: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });
    return history;
  } catch (error) {
    console.error('[HISTORY_ERROR]', error);
    return [];
  }
}
