import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/shared-helpers';

export const dynamic = 'force-dynamic';

/**
 * ✨ ENDPOINT AGREGADOR: Dashboard de órdenes de trabajo
 * Consolida múltiples requests en uno solo
 * 
 * ANTES: 4-6 requests (pending, completed, stats, etc.)
 * DESPUÉS: 1 request
 */
export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const sectorId = searchParams.get('sectorId');
    const pageSize = Math.min(parseInt(searchParams.get('pageSize') || '50', 10), 100);

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId es requerido' },
        { status: 400 }
      );
    }

    const companyIdNum = parseInt(companyId);
    const sectorIdNum = sectorId ? parseInt(sectorId) : null;

    // ✨ OPTIMIZACIÓN: Ejecutar todas las queries en paralelo
    const [pending, inProgress, completedRecent, overdue, stats] = await Promise.all([
      // 1. Pendientes (incluye INCOMING, PENDING, SCHEDULED)
      getWorkOrdersByStatus(companyIdNum, sectorIdNum, ['INCOMING', 'PENDING', 'SCHEDULED'], pageSize),

      // 2. En progreso (incluye IN_PROGRESS y WAITING)
      getWorkOrdersByStatus(companyIdNum, sectorIdNum, ['IN_PROGRESS', 'WAITING'], pageSize),
      
      // 3. Completados recientes (últimos 7 días)
      getRecentCompleted(companyIdNum, sectorIdNum, pageSize),
      
      // 4. Vencidos
      getOverdue(companyIdNum, sectorIdNum),
      
      // 5. Estadísticas
      getStats(companyIdNum, sectorIdNum)
    ]);

    return NextResponse.json({
      pending,
      inProgress,
      completedRecent,
      overdue,
      stats,
      metadata: {
        companyId: companyIdNum,
        sectorId: sectorIdNum,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('[WORK_ORDERS_DASHBOARD_ERROR]', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

async function getWorkOrdersByStatus(
  companyId: number, 
  sectorId: number | null, 
  statuses: string[], 
  limit: number
) {
  const where: any = {
    companyId,
    status: { in: statuses }
  };

  if (sectorId) {
    where.OR = [
      { sectorId },
      { machine: { sectorId } }
    ];
  }

  return prisma.workOrder.findMany({
    where,
    take: limit,
    orderBy: [
      { priority: 'desc' },
      { scheduledDate: 'asc' }
    ],
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      priority: true,
      type: true,
      scheduledDate: true,
      startedDate: true,
      completedDate: true,
      createdAt: true,
      estimatedHours: true,
      actualHours: true,
      // Campos de cierre
      diagnosisNotes: true,
      workPerformedNotes: true,
      resultNotes: true,
      closingMode: true,
      assignedToId: true,
      machineId: true,
      machine: {
        select: {
          id: true,
          name: true,
          nickname: true
        }
      },
      unidadMovil: {
        select: {
          id: true,
          nombre: true,
          patente: true
        }
      },
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
      }
    }
  });
}

async function getRecentCompleted(companyId: number, sectorId: number | null, limit: number) {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const where: any = {
    companyId,
    status: 'COMPLETED',
    completedDate: { gte: sevenDaysAgo }
  };

  if (sectorId) {
    where.OR = [
      { sectorId },
      { machine: { sectorId } }
    ];
  }

  return prisma.workOrder.findMany({
    where,
    take: limit,
    orderBy: { completedDate: 'desc' },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      priority: true,
      type: true,
      scheduledDate: true,
      startedDate: true,
      completedDate: true,
      createdAt: true,
      estimatedHours: true,
      actualHours: true,
      // Campos de cierre
      diagnosisNotes: true,
      workPerformedNotes: true,
      resultNotes: true,
      closingMode: true,
      assignedToId: true,
      machineId: true,
      machine: {
        select: {
          id: true,
          name: true,
          nickname: true
        }
      },
      unidadMovil: {
        select: {
          id: true,
          nombre: true,
          patente: true
        }
      },
      assignedTo: {
        select: {
          id: true,
          name: true
        }
      }
    }
  });
}

async function getOverdue(companyId: number, sectorId: number | null) {
  const where: any = {
    companyId,
    status: { in: ['INCOMING', 'PENDING', 'SCHEDULED', 'IN_PROGRESS', 'WAITING'] },
    scheduledDate: { lt: new Date() }
  };

  if (sectorId) {
    where.OR = [
      { sectorId },
      { machine: { sectorId } }
    ];
  }

  return prisma.workOrder.findMany({
    where,
    orderBy: { scheduledDate: 'asc' },
    include: {
      machine: {
        select: {
          id: true,
          name: true
        }
      },
      unidadMovil: {
        select: {
          id: true,
          nombre: true
        }
      }
    }
  });
}

async function getStats(companyId: number, sectorId: number | null) {
  const baseWhere: any = { companyId };
  
  if (sectorId) {
    baseWhere.OR = [
      { sectorId },
      { machine: { sectorId } }
    ];
  }

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [total, pending, inProgress, completed, overdue, byType, byPriority] = await Promise.all([
    prisma.workOrder.count({ where: baseWhere }),
    // Pendientes incluye INCOMING, PENDING y SCHEDULED
    prisma.workOrder.count({ where: { ...baseWhere, status: { in: ['INCOMING', 'PENDING', 'SCHEDULED'] } } }),
    // En progreso incluye IN_PROGRESS y WAITING
    prisma.workOrder.count({ where: { ...baseWhere, status: { in: ['IN_PROGRESS', 'WAITING'] } } }),
    prisma.workOrder.count({
      where: {
        ...baseWhere,
        status: 'COMPLETED',
        completedDate: { gte: startOfMonth }
      }
    }),
    prisma.workOrder.count({
      where: {
        ...baseWhere,
        status: { in: ['INCOMING', 'PENDING', 'SCHEDULED', 'IN_PROGRESS', 'WAITING'] },
        scheduledDate: { lt: now }
      }
    }),
    prisma.workOrder.groupBy({
      by: ['type'],
      where: baseWhere,
      _count: true
    }),
    prisma.workOrder.groupBy({
      by: ['priority'],
      where: { ...baseWhere, status: { in: ['INCOMING', 'PENDING', 'SCHEDULED', 'IN_PROGRESS', 'WAITING'] } },
      _count: true
    })
  ]);

  const typeMap: Record<string, number> = {};
  byType.forEach(t => { typeMap[t.type] = t._count; });

  const priorityMap: Record<string, number> = {};
  byPriority.forEach(p => { priorityMap[p.priority] = p._count; });

  return {
    total,
    pending,
    inProgress,
    completedThisMonth: completed,
    overdue,
    byType: typeMap,
    byPriority: priorityMap
  };
}
