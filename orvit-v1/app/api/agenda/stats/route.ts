import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromToken } from '@/lib/tasks/auth-helper';
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

    // Base query - solo tareas creadas por el usuario
    const baseWhere = {
      companyId,
      createdById: user.id,
    };

    // Obtener conteos en paralelo
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
      // Total
      prisma.agendaTask.count({ where: baseWhere }),

      // Pendiente
      prisma.agendaTask.count({ where: { ...baseWhere, status: 'PENDING' } }),

      // En progreso
      prisma.agendaTask.count({ where: { ...baseWhere, status: 'IN_PROGRESS' } }),

      // Esperando
      prisma.agendaTask.count({ where: { ...baseWhere, status: 'WAITING' } }),

      // Completada
      prisma.agendaTask.count({ where: { ...baseWhere, status: 'COMPLETED' } }),

      // Cancelada
      prisma.agendaTask.count({ where: { ...baseWhere, status: 'CANCELLED' } }),

      // Vencidas (no completadas ni canceladas, con fecha pasada)
      prisma.agendaTask.count({
        where: {
          ...baseWhere,
          status: { notIn: ['COMPLETED', 'CANCELLED'] },
          dueDate: { lt: todayStart },
        },
      }),

      // Vencen hoy
      prisma.agendaTask.count({
        where: {
          ...baseWhere,
          status: { notIn: ['COMPLETED', 'CANCELLED'] },
          dueDate: { gte: todayStart, lte: todayEnd },
        },
      }),

      // Completadas hoy
      prisma.agendaTask.count({
        where: {
          ...baseWhere,
          status: 'COMPLETED',
          completedAt: { gte: todayStart, lte: todayEnd },
        },
      }),

      // Urgentes pendientes
      prisma.agendaTask.count({
        where: {
          ...baseWhere,
          status: { notIn: ['COMPLETED', 'CANCELLED'] },
          priority: 'URGENT',
        },
      }),

      // Top asignados
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

    // Transformar top asignados
    const topAssignees = tasksByAssignee.map((item) => ({
      name: item.assignedToName || 'Sin asignar',
      count: item._count,
      type: item.assignedToUserId ? 'user' : item.assignedToContactId ? 'contact' : ('unknown' as const),
    }));

    return NextResponse.json({
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
      topAssignees,
    });
  } catch (error) {
    console.error('[API] Error fetching agenda stats:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
