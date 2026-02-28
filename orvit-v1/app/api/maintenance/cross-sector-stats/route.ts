/**
 * API: /api/maintenance/cross-sector-stats
 *
 * GET - Métricas comparativas entre sectores
 *       Usado por el widget CrossSectorComparison del gerente
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
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Get all sectors for the company
    const sectors = await prisma.sector.findMany({
      where: { companyId },
      select: { id: true, name: true },
    });

    if (sectors.length === 0) {
      return NextResponse.json({ sectors: [] });
    }

    // Get OT stats grouped by sector
    const [activeByS, overdueByS, completedByS, totalByS] = await Promise.all([
      prisma.workOrder.groupBy({
        by: ['sectorId'],
        where: {
          companyId,
          sectorId: { in: sectors.map(s => s.id) },
          status: { in: ['PENDING', 'SCHEDULED', 'IN_PROGRESS', 'WAITING'] },
        },
        _count: true,
      }),
      prisma.workOrder.groupBy({
        by: ['sectorId'],
        where: {
          companyId,
          sectorId: { in: sectors.map(s => s.id) },
          scheduledDate: { lt: new Date() },
          status: { notIn: ['COMPLETED', 'CANCELLED'] },
        },
        _count: true,
      }),
      prisma.workOrder.groupBy({
        by: ['sectorId'],
        where: {
          companyId,
          sectorId: { in: sectors.map(s => s.id) },
          status: 'COMPLETED',
          createdAt: { gte: thirtyDaysAgo },
        },
        _count: true,
      }),
      prisma.workOrder.groupBy({
        by: ['sectorId'],
        where: {
          companyId,
          sectorId: { in: sectors.map(s => s.id) },
          createdAt: { gte: thirtyDaysAgo },
        },
        _count: true,
      }),
    ]);

    // Build lookup maps
    const activeMap = new Map(activeByS.map(g => [g.sectorId, g._count]));
    const overdueMap = new Map(overdueByS.map(g => [g.sectorId, g._count]));
    const completedMap = new Map(completedByS.map(g => [g.sectorId, g._count]));
    const totalMap = new Map(totalByS.map(g => [g.sectorId, g._count]));

    const result = sectors.map(s => {
      const total = totalMap.get(s.id) || 0;
      const completed = completedMap.get(s.id) || 0;
      return {
        sectorId: s.id,
        sectorName: s.name,
        activeOTs: activeMap.get(s.id) || 0,
        overdueOTs: overdueMap.get(s.id) || 0,
        completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
      };
    }).filter(s => s.activeOTs > 0 || s.overdueOTs > 0 || s.completionRate > 0);

    return NextResponse.json({ sectors: result });
  } catch (error: any) {
    console.error('Error en GET /api/maintenance/cross-sector-stats:', error.message);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
