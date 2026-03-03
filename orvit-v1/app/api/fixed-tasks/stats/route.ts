import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromToken } from '@/lib/tasks/auth-helper';
import { hasPermission } from '@/lib/permissions';
import { cached } from '@/lib/cache/cache-manager';

export const dynamic = 'force-dynamic';

// GET /api/fixed-tasks/stats — Estadísticas de tareas fijas
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const companyId = parseInt(searchParams.get('companyId') || '0');
    if (!companyId) {
      return NextResponse.json({ error: 'CompanyId requerido' }, { status: 400 });
    }

    const stats = await cached(
      `fixed-tasks-stats:${companyId}`,
      async () => {
        const baseWhere = { companyId };

        const [
          total,
          active,
          inactive,
          completed,
          pending,
          overdue,
          byFrequency,
          byDepartment,
          recentExecutions,
        ] = await Promise.all([
          (prisma as any).fixedTask.count({ where: baseWhere }),
          (prisma as any).fixedTask.count({ where: { ...baseWhere, isActive: true } }),
          (prisma as any).fixedTask.count({ where: { ...baseWhere, isActive: false } }),
          (prisma as any).fixedTask.count({ where: { ...baseWhere, isCompleted: true } }),
          (prisma as any).fixedTask.count({ where: { ...baseWhere, isCompleted: false, isActive: true } }),
          (prisma as any).fixedTask.count({
            where: {
              ...baseWhere,
              isCompleted: false,
              isActive: true,
              nextExecution: { lt: new Date() },
            },
          }),
          (prisma as any).fixedTask.groupBy({
            by: ['frequency'],
            where: { ...baseWhere, isActive: true },
            _count: true,
          }),
          (prisma as any).fixedTask.groupBy({
            by: ['department'],
            where: { ...baseWhere, isActive: true },
            _count: true,
            orderBy: { _count: { id: 'desc' } },
            take: 10,
          }),
          (prisma as any).fixedTaskExecution.count({
            where: {
              fixedTask: { companyId },
              executedAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
            },
          }),
        ]);

        const frequencyMap: Record<string, number> = {};
        for (const item of byFrequency) {
          frequencyMap[item.frequency] = item._count;
        }

        const departments = byDepartment.map((item: any) => ({
          name: item.department || 'Sin departamento',
          count: item._count,
        }));

        const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

        return {
          total,
          active,
          inactive,
          completed,
          pending,
          overdue,
          completionRate,
          executionsLast30Days: recentExecutions,
          byFrequency: frequencyMap,
          byDepartment: departments,
        };
      },
      30
    );

    return NextResponse.json(stats);
  } catch (error) {
    console.error('[API] Error fetching fixed-tasks stats:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
