import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { JWT_SECRET } from '@/lib/auth'; // ✅ Importar el mismo secret
import { requirePermission } from '@/lib/auth/shared-helpers';

export const dynamic = 'force-dynamic';


const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

export async function GET(request: NextRequest) {
  try {
    // Verificar permiso reports.view
    const { user: authUser, error: authError } = await requirePermission('reports.view');
    if (authError) return authError;

    // Verificar autenticación usando JWT
    const cookieStore = cookies();
    const token = cookieStore.get('token');

    if (!token) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    let userId: number;
    try {
      const { payload } = await jwtVerify(token.value, JWT_SECRET_KEY);
      userId = payload.userId as number;
    } catch (jwtError) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const period = searchParams.get('period') || 'month';

    if (!companyId) {
      return NextResponse.json({ error: 'Company ID es requerido' }, { status: 400 });
    }

    // Calcular fechas según el período
    const now = new Date();
    let startDate: Date;
    
    switch (period) {
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'quarter':
        startDate = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default: // month
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    // Estadísticas de órdenes de trabajo
    const [
      totalWorkOrders,
      previousPeriodWorkOrders,
      workOrdersByStatus,
      avgCompletionTime,
      previousAvgTime,
      equipmentAvailability,
      activeTechnicians,
      previousTechnicians
    ] = await Promise.all([
      // Total órdenes de trabajo en el período actual
      prisma.workOrder.count({
        where: {
          companyId: parseInt(companyId),
          createdAt: { gte: startDate }
        }
      }),
      
      // Total órdenes de trabajo en período anterior (para comparación)
      prisma.workOrder.count({
        where: {
          companyId: parseInt(companyId),
          createdAt: {
            gte: new Date(startDate.getTime() - (now.getTime() - startDate.getTime())),
            lt: startDate
          }
        }
      }),

      // Órdenes por estado
      prisma.workOrder.groupBy({
        by: ['status'],
        where: {
          companyId: parseInt(companyId),
          createdAt: { gte: startDate }
        },
        _count: { id: true }
      }),

      // Tiempo promedio de completación (en días)
      prisma.workOrder.aggregate({
        where: {
          companyId: parseInt(companyId),
          status: 'COMPLETED',
          completedDate: { gte: startDate },
          startedDate: { not: null }
        },
        _avg: {
          actualHours: true
        }
      }),

      // Tiempo promedio período anterior
      prisma.workOrder.aggregate({
        where: {
          companyId: parseInt(companyId),
          status: 'COMPLETED',
          completedDate: {
            gte: new Date(startDate.getTime() - (now.getTime() - startDate.getTime())),
            lt: startDate
          },
          startedDate: { not: null }
        },
        _avg: {
          actualHours: true
        }
      }),

      // Disponibilidad de equipos (máquinas activas vs total)
      prisma.machine.count({
        where: {
          companyId: parseInt(companyId),
          status: 'ACTIVE'
        }
      }),

      // Técnicos activos (usuarios y trabajadores únicos que trabajaron en OTs)
      prisma.workOrder.findMany({
        where: {
          companyId: parseInt(companyId),
          createdAt: { gte: startDate },
          OR: [
            { assignedToId: { not: null } },
            { assignedWorkerId: { not: null } }
          ]
        },
        select: {
          assignedToId: true,
          assignedWorkerId: true
        }
      }),

      // Técnicos activos período anterior
      prisma.workOrder.findMany({
        where: {
          companyId: parseInt(companyId),
          createdAt: {
            gte: new Date(startDate.getTime() - (now.getTime() - startDate.getTime())),
            lt: startDate
          },
          OR: [
            { assignedToId: { not: null } },
            { assignedWorkerId: { not: null } }
          ]
        },
        select: {
          assignedToId: true,
          assignedWorkerId: true
        }
      })
    ]);

    // Calcular disponibilidad total de equipos
    const totalMachines = await prisma.machine.count({
      where: { companyId: parseInt(companyId) }
    });
    const availabilityPercentage = totalMachines > 0 ? Math.round((equipmentAvailability / totalMachines) * 100) : 0;

    // Calcular técnicos únicos
    const uniqueTechnicians = new Set([
      ...activeTechnicians.map(w => w.assignedToId).filter(Boolean),
      ...activeTechnicians.map(w => w.assignedWorkerId).filter(Boolean)
    ]).size;

    const uniquePreviousTechnicians = new Set([
      ...previousTechnicians.map(w => w.assignedToId).filter(Boolean),
      ...previousTechnicians.map(w => w.assignedWorkerId).filter(Boolean)
    ]).size;

    // Calcular porcentajes de cambio
    const workOrdersChange = previousPeriodWorkOrders > 0 
      ? Math.round(((totalWorkOrders - previousPeriodWorkOrders) / previousPeriodWorkOrders) * 100)
      : totalWorkOrders > 0 ? 100 : 0;

    const avgTimeHours = avgCompletionTime._avg.actualHours || 0;
    const previousAvgTimeHours = previousAvgTime._avg.actualHours || 0;
    const timeChange = previousAvgTimeHours > 0 
      ? Math.round(((avgTimeHours - previousAvgTimeHours) / previousAvgTimeHours) * 100)
      : 0;

    const techniciansChange = uniquePreviousTechnicians > 0
      ? uniqueTechnicians - uniquePreviousTechnicians
      : uniqueTechnicians;

    // Procesar datos de estado de órdenes
    const statusData = workOrdersByStatus.reduce((acc, curr) => {
      acc[curr.status.toLowerCase()] = curr._count.id;
      return acc;
    }, {} as Record<string, number>);

    const completed = statusData.completed || 0;
    const inProgress = statusData.in_progress || 0;
    const pending = statusData.pending || 0;
    const total = completed + inProgress + pending;

    const completedPercentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    const inProgressPercentage = total > 0 ? Math.round((inProgress / total) * 100) : 0;
    const pendingPercentage = total > 0 ? Math.round((pending / total) * 100) : 0;

    return NextResponse.json({
      success: true,
      stats: {
        workOrders: {
          total: totalWorkOrders,
          change: workOrdersChange,
          changeLabel: workOrdersChange >= 0 ? '+' : '',
          unit: 'vs mes anterior'
        },
        avgTime: {
          value: avgTimeHours > 0 ? Math.round((avgTimeHours / 24) * 10) / 10 : 0, // Convertir a días
          change: timeChange,
          changeLabel: timeChange <= 0 ? '' : '+',
          unit: 'días',
          comparison: 'vs mes anterior'
        },
        availability: {
          percentage: availabilityPercentage,
          change: 2, // Placeholder - podríamos calcular esto comparando con período anterior
          changeLabel: '+',
          unit: 'vs mes anterior'
        },
        technicians: {
          active: uniqueTechnicians,
          change: techniciansChange,
          changeLabel: techniciansChange >= 0 ? '+' : '',
          unit: techniciansChange === 1 ? 'nuevo este mes' : techniciansChange > 1 ? 'nuevos este mes' : 'vs mes anterior'
        },
        workOrdersDistribution: {
          completed: completedPercentage,
          inProgress: inProgressPercentage,
          pending: pendingPercentage,
          details: `Completadas: ${completedPercentage}% | En Progreso: ${inProgressPercentage}% | Pendientes: ${pendingPercentage}%`
        }
      }
    });

  } catch (error) {
    console.error('Error fetching maintenance stats:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' }, 
      { status: 500 }
    );
  }
} 