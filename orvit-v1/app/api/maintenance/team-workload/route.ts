/**
 * API: /api/maintenance/team-workload
 *
 * GET - Distribución de carga de trabajo por técnico en un sector
 *       Usado por el widget TeamWorkload del supervisor
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
    if (!payload || !payload.companyId) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const companyId = payload.companyId as number;
    const { searchParams } = new URL(request.url);
    const sectorId = searchParams.get('sectorId') ? parseInt(searchParams.get('sectorId')!) : undefined;

    const baseWhere: any = {
      companyId,
      assignedToId: { not: null },
    };
    if (sectorId) baseWhere.sectorId = sectorId;

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    // Get all active + recently completed OTs grouped by assignee
    const [pendingByUser, inProgressByUser, completedByUser, users] = await Promise.all([
      prisma.workOrder.groupBy({
        by: ['assignedToId'],
        where: { ...baseWhere, status: { in: ['PENDING', 'SCHEDULED'] } },
        _count: true,
      }),
      prisma.workOrder.groupBy({
        by: ['assignedToId'],
        where: { ...baseWhere, status: 'IN_PROGRESS' },
        _count: true,
      }),
      prisma.workOrder.groupBy({
        by: ['assignedToId'],
        where: {
          ...baseWhere,
          status: 'COMPLETED',
          completedDate: { gte: weekAgo },
        },
        _count: true,
      }),
      // Get user names for all assigned users in sector
      prisma.user.findMany({
        where: {
          companies: { some: { companyId } },
          workOrders: { some: baseWhere },
        },
        select: { id: true, name: true },
      }),
    ]);

    // Build lookup maps
    const pendingMap = new Map(pendingByUser.map(g => [g.assignedToId, g._count]));
    const inProgressMap = new Map(inProgressByUser.map(g => [g.assignedToId, g._count]));
    const completedMap = new Map(completedByUser.map(g => [g.assignedToId, g._count]));

    const workload = users.map(u => ({
      userId: u.id,
      userName: u.name,
      pending: pendingMap.get(u.id) || 0,
      inProgress: inProgressMap.get(u.id) || 0,
      completedThisWeek: completedMap.get(u.id) || 0,
      total: (pendingMap.get(u.id) || 0) + (inProgressMap.get(u.id) || 0),
    }))
    .filter(w => w.total > 0 || w.completedThisWeek > 0)
    .sort((a, b) => b.total - a.total);

    return NextResponse.json({ workload });
  } catch (error: any) {
    console.error('Error en GET /api/maintenance/team-workload:', error.message);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
