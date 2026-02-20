import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromToken } from '@/lib/tasks/auth-helper';
import { cached } from '@/lib/cache/cache-manager';
import { startOfDay, endOfDay } from 'date-fns';

export const dynamic = 'force-dynamic';

// GET /api/agenda/stats - Obtener estadísticas de agenda
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const companyId = parseInt(searchParams.get('companyId') || '0');

    if (!companyId) {
      return NextResponse.json({ error: 'CompanyId requerido' }, { status: 400 });
    }

    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);

    // Base query — tareas creadas por o asignadas al usuario (consistente con GET)
    const baseWhere = {
      companyId,
      OR: [
        { createdById: user.id },
        { assignedToUserId: user.id },
      ],
    };

    // Obtener conteos con caché de 30 segundos
    const stats = await cached(
      `agenda-stats:${user.id}:${companyId}`,
      async () => {
        const [
          total,
          pending,
          inProgress,
          waiting,
          completed,
          cancelled,
          overdue,
          dueToday,
          completedToday,
          urgentPending,
          tasksByAssignee,
        ] = await Promise.all([
          prisma.agendaTask.count({ where: baseWhere }),
          prisma.agendaTask.count({ where: { ...baseWhere, status: 'PENDING' } }),
          prisma.agendaTask.count({ where: { ...baseWhere, status: 'IN_PROGRESS' } }),
          prisma.agendaTask.count({ where: { ...baseWhere, status: 'WAITING' } }),
          prisma.agendaTask.count({ where: { ...baseWhere, status: 'COMPLETED' } }),
          prisma.agendaTask.count({ where: { ...baseWhere, status: 'CANCELLED' } }),
          prisma.agendaTask.count({
            where: {
              ...baseWhere,
              status: { notIn: ['COMPLETED', 'CANCELLED'] },
              dueDate: { lt: todayStart },
            },
          }),
          prisma.agendaTask.count({
            where: {
              ...baseWhere,
              status: { notIn: ['COMPLETED', 'CANCELLED'] },
              dueDate: { gte: todayStart, lte: todayEnd },
            },
          }),
          prisma.agendaTask.count({
            where: {
              ...baseWhere,
              status: 'COMPLETED',
              completedAt: { gte: todayStart, lte: todayEnd },
            },
          }),
          prisma.agendaTask.count({
            where: {
              ...baseWhere,
              status: { notIn: ['COMPLETED', 'CANCELLED'] },
              priority: 'URGENT',
            },
          }),
          prisma.agendaTask.groupBy({
            by: ['assignedToName', 'assignedToUserId', 'assignedToContactId'],
            where: {
              ...baseWhere,
              status: { notIn: ['COMPLETED', 'CANCELLED'] },
              assignedToName: { not: null },
            },
            _count: true,
            orderBy: { _count: { id: 'desc' } },
            take: 5,
          }),
        ]);

        const topAssignees = tasksByAssignee.map((item) => ({
          name: item.assignedToName || 'Sin asignar',
          count: item._count,
          type: item.assignedToUserId ? 'user' : item.assignedToContactId ? 'contact' : ('unknown' as const),
        }));

        return { total, pending, inProgress, waiting, completed, cancelled, overdue, dueToday, completedToday, urgentPending, topAssignees };
      },
      30 // TTL: 30 segundos
    );

    return NextResponse.json(stats);
  } catch (error) {
    console.error('[API] Error fetching agenda stats:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
