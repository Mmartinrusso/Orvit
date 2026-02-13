import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';


export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const sectorId = searchParams.get('sectorId');
    const machineId = searchParams.get('machineId');
    const priority = searchParams.get('priority');
    const type = searchParams.get('type');
    const machineIds = searchParams.get('machineIds');
    const unidadMovilIds = searchParams.get('unidadMovilIds');
    const searchTerm = searchParams.get('searchTerm');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId es requerido' },
        { status: 400 }
      );
    }

    const dateRange = startDate && endDate ? {
      gte: new Date(startDate),
      lte: new Date(endDate)
    } : {
      gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1), // Primer día del mes actual
      lte: new Date() // Hoy
    };

    const where: any = {
      companyId: parseInt(companyId),
      createdAt: dateRange
    };

    if (sectorId) {
      where.sectorId = parseInt(sectorId);
    }

    if (machineId) {
      where.machineId = parseInt(machineId);
    } else if (machineIds || unidadMovilIds) {
      // Crear condiciones OR para máquinas y unidades móviles
      const orConditions = [];
      
      if (machineIds) {
        const machineIdArray = machineIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
        if (machineIdArray.length > 0) {
          orConditions.push({ machineId: { in: machineIdArray } });
        }
      }
      
      if (unidadMovilIds) {
        const unidadMovilIdArray = unidadMovilIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
        if (unidadMovilIdArray.length > 0) {
          orConditions.push({ unidadMovilId: { in: unidadMovilIdArray } });
        }
      }
      
      if (orConditions.length > 0) {
        where.OR = orConditions;
      }
    }

    // Agregar filtros adicionales
    if (priority && priority !== 'all') {
      where.priority = priority;
    }

    if (type && type !== 'all') {
      where.type = type;
    }

    // Temporalmente usamos solo workOrders existentes sin el campo history
    let allMaintenances = await prisma.workOrder.findMany({
      where,
      include: {
        // history: true, // Comentado hasta que se aplique la migración
        machine: true,
        unidadMovil: {
          select: {
            id: true,
            nombre: true,
            tipo: true
          }
        }
      }
    });

    // Aplicar filtro de búsqueda si se especificó
    if (searchTerm && searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase().trim();
      allMaintenances = allMaintenances.filter(maintenance => {
        return (
          maintenance.title?.toLowerCase().includes(searchLower) ||
          maintenance.description?.toLowerCase().includes(searchLower) ||
          maintenance.machine?.name?.toLowerCase().includes(searchLower) ||
          maintenance.unidadMovil?.nombre?.toLowerCase().includes(searchLower)
        );
      });
    }

    // Calcular KPIs
    const totalMaintenances = allMaintenances.length;
    const completedMaintenances = allMaintenances.filter(m => m.status === 'COMPLETED');
    const completedOnTime = completedMaintenances.filter(m => {
      if (!m.scheduledDate || !m.completedDate) return false;
      return m.completedDate <= m.scheduledDate;
    });

    const overdueMaintenance = allMaintenances.filter(m => {
      if (m.status === 'COMPLETED') return false;
      if (!m.scheduledDate) return false;
      return new Date() > m.scheduledDate;
    });

    // Calcular tiempos promedio
    const completedWithTimes = completedMaintenances.filter(m => m.actualHours);
    const avgCompletionTime = completedWithTimes.length > 0 
      ? completedWithTimes.reduce((sum, m) => sum + (m.actualHours || 0), 0) / completedWithTimes.length
      : 0;

    // Temporalmente calculamos MTTR/MTBF de forma simplificada
    // const historyWithMTTR = allMaintenances
    //   .flatMap(m => m.history)
    //   .filter(h => h.mttr !== null);
    
    const avgMTTR = completedWithTimes.length > 0 ? avgCompletionTime : 0;

    // const historyWithMTBF = allMaintenances
    //   .flatMap(m => m.history)
    //   .filter(h => h.mtbf !== null);
    
    const avgMTBF = 0; // Temporalmente 0 hasta tener el historial

    // Calcular tasa de completitud
    const completionRate = totalMaintenances > 0 
      ? (completedOnTime.length / totalMaintenances) * 100
      : 0;

    // Calcular eficiencia de costos (simplificado)
    const plannedCosts = allMaintenances.reduce((sum, m) => sum + (m.cost || 0), 0);
    // const actualCosts = allMaintenances
    //   .flatMap(m => m.history)
    //   .reduce((sum, h) => sum + (h.cost || 0), 0);
    
    const costEfficiency = 85; // Valor temporal

    // Calcular puntuación de calidad promedio (temporal)
    // const historyWithQuality = allMaintenances
    //   .flatMap(m => m.history)
    //   .filter(h => h.qualityScore !== null);
    
    const qualityScore = 7.5; // Valor temporal

    // Calcular uptime/downtime (simplificado)
    const totalHours = 24 * 30; // Aproximado para el mes
    const maintenanceHours = completedMaintenances.reduce((sum, m) => sum + (m.actualHours || 0), 0);
    const uptime = ((totalHours - maintenanceHours) / totalHours) * 100;
    const downtime = (maintenanceHours / totalHours) * 100;

    // Preventivo vs Correctivo
    const preventiveCount = allMaintenances.filter(m => m.type === 'PREVENTIVE').length;
    const correctiveCount = allMaintenances.filter(m => m.type === 'CORRECTIVE').length;

    // ✅ OPTIMIZACIÓN: Ejecutar queries de tendencias en paralelo
    const [monthlyCompletion, costTrend, failureFrequency, preventiveCompliance] = await Promise.all([
      getMonthlyCompletionTrend(parseInt(companyId), sectorId, machineId),
      getCostTrend(parseInt(companyId), sectorId, machineId),
      getFailureFrequency(parseInt(companyId), sectorId, machineId),
      getPreventiveCompliance(parseInt(companyId))
    ]);

    const kpis = {
      totalMaintenances,
      completedOnTime: completedOnTime.length,
      overdueMaintenance: overdueMaintenance.length,
      avgCompletionTime,
      avgMTTR,
      avgMTBF,
      completionRate,
      costEfficiency,
      qualityScore,
      uptime,
      downtime,
      preventiveVsCorrective: {
        preventive: preventiveCount,
        corrective: correctiveCount
      },
      trends: {
        monthlyCompletion,
        costTrend,
        failureFrequency
      },
      preventiveCompliance
    };

    return NextResponse.json(kpis);
  } catch (error) {
    console.error('Error calculating maintenance KPIs:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

async function getMonthlyCompletionTrend(companyId: number, sectorId?: string | null, machineId?: string | null) {
  // ✅ OPTIMIZADO: Datos reales de la base de datos
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  sixMonthsAgo.setDate(1);
  sixMonthsAgo.setHours(0, 0, 0, 0);

  const where: any = {
    companyId,
    status: 'COMPLETED',
    completedDate: { gte: sixMonthsAgo }
  };

  if (sectorId) where.sectorId = parseInt(sectorId);
  if (machineId) where.machineId = parseInt(machineId);

  const completedOrders = await prisma.workOrder.findMany({
    where,
    select: { completedDate: true }
  });

  // Agrupar por mes
  const monthlyMap = new Map<string, number>();

  // Inicializar últimos 6 meses con 0
  for (let i = 5; i >= 0; i--) {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    const monthKey = date.toISOString().slice(0, 7);
    monthlyMap.set(monthKey, 0);
  }

  // Contar completados por mes
  for (const order of completedOrders) {
    if (order.completedDate) {
      const monthKey = order.completedDate.toISOString().slice(0, 7);
      if (monthlyMap.has(monthKey)) {
        monthlyMap.set(monthKey, (monthlyMap.get(monthKey) || 0) + 1);
      }
    }
  }

  return Array.from(monthlyMap.entries())
    .map(([month, completed]) => ({ month, completed }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

async function getCostTrend(companyId: number, sectorId?: string | null, machineId?: string | null) {
  // ✅ OPTIMIZADO: Datos reales de la base de datos
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  sixMonthsAgo.setDate(1);
  sixMonthsAgo.setHours(0, 0, 0, 0);

  const where: any = {
    companyId,
    completedDate: { gte: sixMonthsAgo }
  };

  if (sectorId) where.sectorId = parseInt(sectorId);
  if (machineId) where.machineId = parseInt(machineId);

  const ordersWithCost = await prisma.workOrder.findMany({
    where,
    select: { completedDate: true, cost: true, createdAt: true }
  });

  // Agrupar por mes
  const monthlyMap = new Map<string, number>();

  // Inicializar últimos 6 meses con 0
  for (let i = 5; i >= 0; i--) {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    const monthKey = date.toISOString().slice(0, 7);
    monthlyMap.set(monthKey, 0);
  }

  // Sumar costos por mes
  for (const order of ordersWithCost) {
    const dateRef = order.completedDate || order.createdAt;
    const monthKey = dateRef.toISOString().slice(0, 7);
    if (monthlyMap.has(monthKey) && order.cost) {
      monthlyMap.set(monthKey, (monthlyMap.get(monthKey) || 0) + Number(order.cost));
    }
  }

  return Array.from(monthlyMap.entries())
    .map(([month, cost]) => ({ month, cost }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

async function getFailureFrequency(companyId: number, sectorId?: string | null, machineId?: string | null) {
  // ✅ OPTIMIZADO: Datos reales de la base de datos
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

  const where: any = {
    companyId,
    type: 'CORRECTIVE',
    createdAt: { gte: threeMonthsAgo }
  };

  if (sectorId) where.sectorId = parseInt(sectorId);
  if (machineId) where.machineId = parseInt(machineId);

  const correctiveOrders = await prisma.workOrder.findMany({
    where,
    select: {
      machineId: true,
      machine: { select: { id: true, name: true } }
    }
  });

  // Agrupar por máquina
  const machineFailures = new Map<number, { name: string; count: number }>();

  for (const order of correctiveOrders) {
    if (order.machineId && order.machine) {
      const existing = machineFailures.get(order.machineId);
      if (existing) {
        existing.count++;
      } else {
        machineFailures.set(order.machineId, { name: order.machine.name, count: 1 });
      }
    }
  }

  return Array.from(machineFailures.entries())
    .map(([machineId, data]) => ({
      machineId,
      machineName: data.name,
      failureCount: data.count
    }))
    .sort((a, b) => b.failureCount - a.failureCount)
    .slice(0, 10); // Top 10 máquinas con más fallas
}

/**
 * Calcular métricas de cumplimiento de mantenimiento preventivo
 * Basado en instancias de PREVENTIVE_MAINTENANCE_INSTANCE
 */
async function getPreventiveCompliance(companyId: number) {
  try {
    // Obtener todas las instancias de preventivo
    const instances = await prisma.document.findMany({
      where: {
        entityType: 'PREVENTIVE_MAINTENANCE_INSTANCE'
      }
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Últimos 30 días para métricas
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    let totalScheduled = 0;
    let completedOnTime = 0;
    let completedLate = 0;
    let overdue = 0;
    let pending = 0;

    for (const inst of instances) {
      try {
        const data = JSON.parse(inst.url);

        // Filtrar por companyId
        if (data.companyId !== companyId) continue;

        const scheduledDate = new Date(data.scheduledDate);
        scheduledDate.setHours(0, 0, 0, 0);

        // Solo contar instancias de los últimos 30 días o futuras próximas
        const isRecentOrUpcoming = scheduledDate >= thirtyDaysAgo &&
          scheduledDate <= new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000); // próximos 7 días

        if (!isRecentOrUpcoming) continue;

        totalScheduled++;

        if (data.status === 'COMPLETED') {
          const completedDate = data.actualEndDate ? new Date(data.actualEndDate) : null;
          if (completedDate && completedDate <= scheduledDate) {
            completedOnTime++;
          } else {
            completedLate++;
          }
        } else if (data.status === 'OVERDUE' || (data.status === 'PENDING' && scheduledDate < today)) {
          overdue++;
        } else if (data.status === 'PENDING') {
          pending++;
        }
      } catch {
        // Ignorar instancias con JSON inválido
      }
    }

    const completed = completedOnTime + completedLate;
    const complianceRate = totalScheduled > 0
      ? Math.round((completedOnTime / totalScheduled) * 100)
      : 100;

    const executionRate = totalScheduled > 0
      ? Math.round((completed / totalScheduled) * 100)
      : 100;

    return {
      totalScheduled,
      completed,
      completedOnTime,
      completedLate,
      overdue,
      pending,
      complianceRate,      // % ejecutados a tiempo
      executionRate,       // % ejecutados (con o sin retraso)
      backlog: overdue     // Preventivos vencidos pendientes
    };

  } catch (error) {
    console.error('Error calculating preventive compliance:', error);
    return {
      totalScheduled: 0,
      completed: 0,
      completedOnTime: 0,
      completedLate: 0,
      overdue: 0,
      pending: 0,
      complianceRate: 100,
      executionRate: 100,
      backlog: 0
    };
  }
}
