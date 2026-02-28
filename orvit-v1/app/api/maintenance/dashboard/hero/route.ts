/**
 * API: /api/maintenance/dashboard/hero
 *
 * GET - Datos para la sección hero del dashboard de mantenimiento
 *       Respuesta varía según el rol: operator, supervisor, manager
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const payload = await verifyToken(token);
    if (!payload || !payload.userId || !payload.companyId) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const role = searchParams.get('role') || 'operator';
    const companyId = payload.companyId as number;
    const userId = parseInt(searchParams.get('userId') || String(payload.userId));
    const sectorId = searchParams.get('sectorId')
      ? parseInt(searchParams.get('sectorId')!)
      : undefined;

    switch (role) {
      case 'operator':
        return NextResponse.json(await getOperatorHero(companyId, userId, sectorId));
      case 'supervisor':
        return NextResponse.json(await getSupervisorHero(companyId, sectorId));
      case 'manager':
        return NextResponse.json(await getManagerHero(companyId, sectorId));
      default:
        return NextResponse.json(await getOperatorHero(companyId, userId, sectorId));
    }
  } catch (error: any) {
    console.error('Error en GET /api/maintenance/dashboard/hero:', error.message);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

async function getOperatorHero(companyId: number, userId: number, sectorId?: number) {
  const baseWhere: any = { companyId, assignedToId: userId };

  const [myPending, myInProgress, myControls, myUpcoming] = await Promise.all([
    // OTs pendientes/programadas asignadas a mí
    prisma.workOrder.count({
      where: {
        ...baseWhere,
        status: { in: ['PENDING', 'SCHEDULED'] },
      },
    }),
    // OTs en progreso asignadas a mí
    prisma.workOrder.count({
      where: {
        ...baseWhere,
        status: 'IN_PROGRESS',
      },
    }),
    // Controles de seguimiento pendientes (via soluciones que yo apliqué)
    prisma.solutionControlInstance.count({
      where: {
        companyId,
        status: { in: ['PENDING', 'NOTIFIED', 'OVERDUE'] },
        solutionApplied: { performedById: userId },
      },
    }).catch(() => 0), // Si la tabla no existe aún, retornar 0
    // Próximos preventivos (7 días)
    getUpcomingPreventiveCount(companyId, userId, sectorId),
  ]);

  return {
    role: 'operator',
    myPendingCount: myPending,
    myInProgressCount: myInProgress,
    myControlsPending: myControls,
    myUpcomingPreventive: myUpcoming,
  };
}

async function getSupervisorHero(companyId: number, sectorId?: number) {
  const sectorWhere: any = { companyId };
  if (sectorId) sectorWhere.sectorId = sectorId;

  const now = new Date();

  const [activeOTs, overdueOTs, machinesStopped, pendingControls, openFailures] = await Promise.all([
    // OTs activas en el sector
    prisma.workOrder.count({
      where: {
        ...sectorWhere,
        status: { in: ['PENDING', 'SCHEDULED', 'IN_PROGRESS', 'WAITING'] },
      },
    }),
    // OTs vencidas (scheduledDate pasada y no completada)
    prisma.workOrder.count({
      where: {
        ...sectorWhere,
        scheduledDate: { lt: now },
        status: { notIn: ['COMPLETED', 'CANCELLED'] },
      },
    }),
    // Máquinas paradas (downtime logs abiertos)
    getStoppedMachinesCount(companyId, sectorId),
    // Controles pendientes en el sector
    getSectorControlsCount(companyId, sectorId),
    // Fallas abiertas
    getOpenFailuresCount(companyId, sectorId),
  ]);

  return {
    role: 'supervisor',
    totalActiveOTs: activeOTs,
    overdueOTs,
    machinesStopped,
    pendingControls,
    openFailures,
  };
}

async function getManagerHero(companyId: number, sectorId?: number) {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const sectorWhere: any = { companyId };
  if (sectorId) sectorWhere.sectorId = sectorId;

  const [completedWOs, totalWOs, slaData, downtimeData, correctiveCount, preventiveData] = await Promise.all([
    // OTs completadas últimos 30 días con actualHours
    prisma.workOrder.findMany({
      where: {
        ...sectorWhere,
        status: 'COMPLETED',
        completedDate: { gte: thirtyDaysAgo },
      },
      select: { actualHours: true },
    }),
    // Total OTs últimos 30 días
    prisma.workOrder.count({
      where: {
        ...sectorWhere,
        createdAt: { gte: thirtyDaysAgo },
      },
    }),
    // SLA data
    prisma.workOrder.groupBy({
      by: ['slaStatus'],
      where: {
        ...sectorWhere,
        createdAt: { gte: thirtyDaysAgo },
        slaStatus: { not: null },
      },
      _count: true,
    }),
    // Downtime total últimos 30 días
    prisma.downtimeLog.aggregate({
      where: {
        companyId,
        startedAt: { gte: thirtyDaysAgo },
        endedAt: { not: null },
        ...(sectorId ? { machine: { sectorId } } : {}),
      },
      _sum: { totalMinutes: true },
    }),
    // Count correctivas últimos 30 días
    prisma.workOrder.count({
      where: {
        ...sectorWhere,
        type: 'CORRECTIVE',
        createdAt: { gte: thirtyDaysAgo },
      },
    }),
    // Preventive compliance
    getPreventiveComplianceRate(companyId),
  ]);

  // MTTR: promedio de actualHours de OTs completadas
  const withHours = completedWOs.filter(w => w.actualHours != null);
  const mttr = withHours.length > 0
    ? Math.round((withHours.reduce((s, w) => s + (Number(w.actualHours) || 0), 0) / withHours.length) * 10) / 10
    : 0;

  // MTBF: horas del período / count correctivas
  const periodHours = (now.getTime() - thirtyDaysAgo.getTime()) / (1000 * 60 * 60);
  const mtbf = correctiveCount > 0
    ? Math.round((periodHours / correctiveCount) * 10) / 10
    : null;

  // Disponibilidad
  const totalDowntimeMinutes = downtimeData._sum.totalMinutes || 0;
  const totalPeriodMinutes = 30 * 24 * 60; // 30 días en minutos
  const availability = Math.round((1 - totalDowntimeMinutes / totalPeriodMinutes) * 1000) / 10;

  // Tasa de completitud
  const completedCount = completedWOs.length;
  const completionRate = totalWOs > 0
    ? Math.round((completedCount / totalWOs) * 1000) / 10
    : 0;

  // SLA compliance
  const slaTotal = slaData.reduce((s, g) => s + g._count, 0);
  const slaBreached = slaData.find(g => g.slaStatus === 'BREACHED')?._count || 0;
  const slaCompliance = slaTotal > 0
    ? Math.round(((slaTotal - slaBreached) / slaTotal) * 1000) / 10
    : 100;

  return {
    role: 'manager',
    mttr,
    mtbf,
    availability,
    completionRate,
    slaCompliance,
    preventiveCompliance: preventiveData,
  };
}

// ── Helpers ──

async function getUpcomingPreventiveCount(companyId: number, userId: number, sectorId?: number): Promise<number> {
  try {
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    return await prisma.workOrder.count({
      where: {
        companyId,
        type: 'PREVENTIVE',
        assignedToId: userId,
        status: { in: ['PENDING', 'SCHEDULED'] },
        scheduledDate: { lte: sevenDaysFromNow },
        ...(sectorId ? { sectorId } : {}),
      },
    });
  } catch {
    return 0;
  }
}

async function getStoppedMachinesCount(companyId: number, sectorId?: number): Promise<number> {
  try {
    const openDowntimes = await prisma.downtimeLog.findMany({
      where: {
        companyId,
        endedAt: null,
        ...(sectorId ? { machine: { sectorId } } : {}),
      },
      select: { machineId: true },
      distinct: ['machineId'],
    });
    return openDowntimes.length;
  } catch {
    return 0;
  }
}

async function getSectorControlsCount(companyId: number, sectorId?: number): Promise<number> {
  try {
    const where: any = {
      companyId,
      status: { in: ['PENDING', 'NOTIFIED', 'OVERDUE'] },
    };
    if (sectorId) {
      where.solutionApplied = {
        failureOccurrence: { machine: { sectorId } },
      };
    }
    return await prisma.solutionControlInstance.count({ where });
  } catch {
    return 0;
  }
}

async function getOpenFailuresCount(companyId: number, sectorId?: number): Promise<number> {
  try {
    return await prisma.failureOccurrence.count({
      where: {
        companyId,
        status: { not: 'RESOLVED' },
        ...(sectorId ? { machine: { sectorId } } : {}),
      },
    });
  } catch {
    return 0;
  }
}

async function getPreventiveComplianceRate(companyId: number): Promise<number> {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [scheduled, completed] = await Promise.all([
      prisma.workOrder.count({
        where: {
          companyId,
          type: 'PREVENTIVE',
          scheduledDate: { gte: thirtyDaysAgo },
        },
      }),
      prisma.workOrder.count({
        where: {
          companyId,
          type: 'PREVENTIVE',
          status: 'COMPLETED',
          scheduledDate: { gte: thirtyDaysAgo },
        },
      }),
    ]);

    return scheduled > 0 ? Math.round((completed / scheduled) * 1000) / 10 : 100;
  } catch {
    return 100;
  }
}
