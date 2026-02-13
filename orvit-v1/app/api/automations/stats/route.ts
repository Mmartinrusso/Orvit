/**
 * API: /api/automations/stats
 *
 * GET - Obtener estadísticas de automatizaciones
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/automations/stats
 * Obtener estadísticas del sistema de automatizaciones
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
      totalRules,
      activeRules,
      rulesByTrigger,
      executionsToday,
      executionsThisWeek,
      executionsByStatus,
      recentExecutions,
      topRules
    ] = await Promise.all([
      // Total rules
      prisma.automationRule.count({ where: { companyId } }),

      // Active rules
      prisma.automationRule.count({ where: { companyId, isActive: true } }),

      // Rules by trigger type
      prisma.automationRule.groupBy({
        by: ['triggerType'],
        where: { companyId },
        _count: true
      }),

      // Executions today
      prisma.automationExecution.count({
        where: {
          companyId,
          startedAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0))
          }
        }
      }),

      // Executions this week
      prisma.automationExecution.count({
        where: {
          companyId,
          startedAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          }
        }
      }),

      // Executions by status (this week)
      prisma.automationExecution.groupBy({
        by: ['status'],
        where: {
          companyId,
          startedAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          }
        },
        _count: true
      }),

      // Recent executions
      prisma.automationExecution.findMany({
        where: { companyId },
        orderBy: { startedAt: 'desc' },
        take: 10,
        include: {
          rule: {
            select: {
              id: true,
              name: true,
              triggerType: true
            }
          }
        }
      }),

      // Top rules by execution count
      prisma.automationRule.findMany({
        where: { companyId, isActive: true },
        orderBy: { executionCount: 'desc' },
        take: 5,
        select: {
          id: true,
          name: true,
          triggerType: true,
          executionCount: true,
          lastExecutedAt: true
        }
      })
    ]);

    // Calculate success rate
    const statusMap: Record<string, number> = {};
    executionsByStatus.forEach(s => {
      statusMap[s.status] = s._count;
    });

    const totalWeekExecutions = Object.values(statusMap).reduce((a, b) => a + b, 0);
    const successfulExecutions = (statusMap['COMPLETED'] || 0) + (statusMap['SIMULATED'] || 0);
    const successRate = totalWeekExecutions > 0
      ? Math.round((successfulExecutions / totalWeekExecutions) * 100)
      : 0;

    // Build trigger types map
    const triggerTypesMap: Record<string, number> = {};
    rulesByTrigger.forEach(t => {
      triggerTypesMap[t.triggerType] = t._count;
    });

    return NextResponse.json({
      summary: {
        totalRules,
        activeRules,
        inactiveRules: totalRules - activeRules,
        executionsToday,
        executionsThisWeek,
        successRate
      },
      rulesByTrigger: triggerTypesMap,
      executionsByStatus: statusMap,
      recentExecutions: recentExecutions.map(e => ({
        id: e.id,
        rule: e.rule,
        status: e.status,
        triggerType: e.triggerType,
        startedAt: e.startedAt,
        completedAt: e.completedAt,
        durationMs: e.durationMs,
        errorMessage: e.errorMessage
      })),
      topRules
    });
  } catch (error) {
    console.error('Error en GET /api/automations/stats:', error);
    return NextResponse.json(
      { error: 'Error al obtener estadísticas' },
      { status: 500 }
    );
  }
}
