/**
 * API: /api/ideas/stats
 *
 * GET - Obtener estadísticas de ideas
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/ideas/stats
 * Obtener KPIs y estadísticas de ideas
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload || !payload.companyId) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const companyId = payload.companyId as number;

    // Get all stats in parallel
    const [
      total,
      byStatus,
      byCategory,
      byPriority,
      thisMonth,
      implemented,
    ] = await Promise.all([
      // Total ideas
      prisma.idea.count({ where: { companyId } }),

      // By status
      prisma.idea.groupBy({
        by: ['status'],
        where: { companyId },
        _count: true
      }),

      // By category
      prisma.idea.groupBy({
        by: ['category'],
        where: { companyId },
        _count: true
      }),

      // By priority
      prisma.idea.groupBy({
        by: ['priority'],
        where: { companyId },
        _count: true
      }),

      // Created this month
      prisma.idea.count({
        where: {
          companyId,
          createdAt: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
          }
        }
      }),

      // Implemented this year
      prisma.idea.count({
        where: {
          companyId,
          status: 'IMPLEMENTED',
          implementedAt: {
            gte: new Date(new Date().getFullYear(), 0, 1)
          }
        }
      }),
    ]);

    // Transform grouped data to maps
    const statusMap: Record<string, number> = {};
    byStatus.forEach(s => { statusMap[s.status] = s._count; });

    const categoryMap: Record<string, number> = {};
    byCategory.forEach(c => { categoryMap[c.category] = c._count; });

    const priorityMap: Record<string, number> = {};
    byPriority.forEach(p => { priorityMap[p.priority] = p._count; });

    // Calculate implementation rate
    const reviewedCount = (statusMap['APPROVED'] || 0) +
                          (statusMap['IN_PROGRESS'] || 0) +
                          (statusMap['IMPLEMENTED'] || 0) +
                          (statusMap['REJECTED'] || 0);

    const implementationRate = reviewedCount > 0
      ? Math.round(((statusMap['IMPLEMENTED'] || 0) / reviewedCount) * 100)
      : 0;

    return NextResponse.json({
      summary: {
        total,
        new: statusMap['NEW'] || 0,
        underReview: statusMap['UNDER_REVIEW'] || 0,
        approved: statusMap['APPROVED'] || 0,
        inProgress: statusMap['IN_PROGRESS'] || 0,
        implemented: statusMap['IMPLEMENTED'] || 0,
        rejected: statusMap['REJECTED'] || 0,
        thisMonth,
        implementedThisYear: implemented,
        implementationRate
      },
      byStatus: statusMap,
      byCategory: categoryMap,
      byPriority: priorityMap,
    });
  } catch (error) {
    console.error('Error en GET /api/ideas/stats:', error);
    return NextResponse.json(
      { error: 'Error al obtener estadísticas' },
      { status: 500 }
    );
  }
}
