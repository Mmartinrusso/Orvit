import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';


export async function GET(request: NextRequest) {
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

    // Company boundary check
    const tokenCompanyId = payload.companyId as number | undefined;
    if (tokenCompanyId && parseInt(companyId) !== tokenCompanyId) {
      return NextResponse.json({ error: 'No autorizado para esta empresa' }, { status: 403 });
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

    // ✅ OPTIMIZADO: Filtro de búsqueda en la query DB (evita cargar todo en memoria)
    if (searchTerm && searchTerm.trim()) {
      const term = searchTerm.trim();
      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            { title: { contains: term, mode: 'insensitive' } },
            { description: { contains: term, mode: 'insensitive' } },
            { machine: { name: { contains: term, mode: 'insensitive' } } },
            { unidadMovil: { nombre: { contains: term, mode: 'insensitive' } } }
          ]
        }
      ];
    }

    // ✅ OPTIMIZADO: Select solo campos necesarios para KPIs (no include completo)
    const allMaintenances = await prisma.workOrder.findMany({
      where,
      select: {
        id: true,
        status: true,
        type: true,
        scheduledDate: true,
        completedDate: true,
        estimatedHours: true,
        actualHours: true,
        cost: true,
        machineId: true,
      }
    });

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

    // MTTR = promedio de horas reales de trabajos completados
    const avgMTTR = completedWithTimes.length > 0 ? avgCompletionTime : 0;

    // MTBF = horas del período / cantidad de fallas correctivas
    const periodHours = (dateRange.lte.getTime() - dateRange.gte.getTime()) / (1000 * 60 * 60);
    const correctiveFailureCount = allMaintenances.filter(m => m.type === 'CORRECTIVE').length;
    const avgMTBF = correctiveFailureCount > 0
      ? Math.round((periodHours / correctiveFailureCount) * 10) / 10
      : null;

    // Calcular tasa de completitud
    const completionRate = totalMaintenances > 0 
      ? (completedOnTime.length / totalMaintenances) * 100
      : 0;

    // Eficiencia de costos: ratio estimado vs real (en horas como proxy)
    const completedWithBothHours = completedMaintenances.filter(m => m.estimatedHours && m.actualHours);
    const costEfficiency = completedWithBothHours.length > 0
      ? Math.round(
          (completedWithBothHours.reduce((sum, m) => sum + (m.estimatedHours || 0), 0) /
           completedWithBothHours.reduce((sum, m) => sum + (m.actualHours || 0), 0)) * 100
        )
      : null;

    // qualityScore se calcula desde maintenance_history (en el Promise.all abajo)

    // Calcular uptime/downtime (simplificado)
    const totalHours = 24 * 30; // Aproximado para el mes
    const maintenanceHours = completedMaintenances.reduce((sum, m) => sum + (m.actualHours || 0), 0);
    const uptime = ((totalHours - maintenanceHours) / totalHours) * 100;
    const downtime = (maintenanceHours / totalHours) * 100;

    // Preventivo vs Correctivo
    const preventiveCount = allMaintenances.filter(m => m.type === 'PREVENTIVE').length;
    const correctiveCount = allMaintenances.filter(m => m.type === 'CORRECTIVE').length;

    // ✅ OPTIMIZACIÓN: Ejecutar queries de tendencias + calidad en paralelo
    const [monthlyCompletion, costTrend, failureFrequency, preventiveCompliance, qualityHistories] = await Promise.all([
      getMonthlyCompletionTrend(parseInt(companyId), sectorId, machineId),
      getCostTrend(parseInt(companyId), sectorId, machineId),
      getFailureFrequency(parseInt(companyId), sectorId, machineId),
      getPreventiveCompliance(parseInt(companyId)),
      // Calidad promedio desde historial real
      prisma.maintenance_history.findMany({
        where: {
          work_orders: { companyId: parseInt(companyId), createdAt: dateRange },
          qualityScore: { not: null }
        },
        select: { qualityScore: true }
      })
    ]);

    const qualityScore = qualityHistories.length > 0
      ? Math.round(qualityHistories.reduce((sum, h) => sum + (h.qualityScore || 0), 0) / qualityHistories.length * 10) / 10
      : null;

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
    // Obtener instancias de preventivo de esta empresa usando filtro en JSON
    // Evita cargar instancias de otras empresas (multi-tenant)
    const instances = await prisma.document.findMany({
      where: {
        entityType: 'PREVENTIVE_MAINTENANCE_INSTANCE',
        url: { contains: `"companyId":${companyId}` }
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
