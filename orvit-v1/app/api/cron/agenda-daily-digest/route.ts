import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  notifyTaskOverdue,
  notifyTaskDueDate,
  sendDailySummary,
  type TaskReminderData,
} from '@/lib/discord/agenda-notifications';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * CRON: Resumen diario de agenda
 *
 * Se ejecuta 1x/día a las 8AM
 * 1. Tareas vencidas (dueDate < now, PENDING/IN_PROGRESS) → notifyTaskOverdue
 * 2. Tareas que vencen hoy → notifyTaskDueDate(_, _, 'today')
 * 3. Tareas que vencen mañana → notifyTaskDueDate(_, _, 'tomorrow')
 * 4. Agrupa por usuario → sendDailySummary con listas
 */
export async function GET(request: NextRequest) {
  try {
    console.log('📬 [CRON Agenda Digest] Iniciando resumen diario de agenda...');

    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);
    const startOfTomorrow = new Date(startOfToday);
    startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);
    const endOfTomorrow = new Date(startOfTomorrow);
    endOfTomorrow.setHours(23, 59, 59, 999);

    const activeStatuses = ['PENDING', 'IN_PROGRESS'] as const;

    // 1. Tareas vencidas (dueDate < startOfToday)
    const overdueTasks = await prisma.agendaTask.findMany({
      where: {
        dueDate: { lt: startOfToday },
        status: { in: [...activeStatuses] },
        isArchived: false,
      },
      include: {
        createdBy: true,
        assignedToUser: true,
      },
      take: 100,
    });

    // 2. Tareas que vencen hoy
    const dueTodayTasks = await prisma.agendaTask.findMany({
      where: {
        dueDate: { gte: startOfToday, lte: endOfToday },
        status: { in: [...activeStatuses] },
        isArchived: false,
      },
      include: {
        createdBy: true,
        assignedToUser: true,
      },
      take: 100,
    });

    // 3. Tareas que vencen mañana
    const dueTomorrowTasks = await prisma.agendaTask.findMany({
      where: {
        dueDate: { gte: startOfTomorrow, lte: endOfTomorrow },
        status: { in: [...activeStatuses] },
        isArchived: false,
      },
      include: {
        createdBy: true,
        assignedToUser: true,
      },
      take: 100,
    });

    console.log(
      `📊 [CRON Agenda Digest] Vencidas: ${overdueTasks.length}, Hoy: ${dueTodayTasks.length}, Mañana: ${dueTomorrowTasks.length}`
    );

    if (overdueTasks.length === 0 && dueTodayTasks.length === 0 && dueTomorrowTasks.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Sin tareas para notificar',
        overdue: 0,
        dueToday: 0,
        dueTomorrow: 0,
      });
    }

    const results = { sent: 0, failed: 0, errors: [] as string[] };

    // Helper: get discord user ID (prefer assigned, fallback to creator)
    function getDiscordUserIds(task: {
      assignedToUser?: { discordUserId: string | null } | null;
      createdBy?: { discordUserId: string | null } | null;
      assignedToUserId?: number | null;
      createdById: number;
    }): string[] {
      const ids = new Set<string>();
      if (task.assignedToUser?.discordUserId) ids.add(task.assignedToUser.discordUserId);
      if (task.createdBy?.discordUserId) ids.add(task.createdBy.discordUserId);
      return Array.from(ids);
    }

    function toTaskData(task: {
      id: number;
      title: string;
      description: string | null;
      dueDate: Date | null;
      priority: string;
      assignedToName: string | null;
      category: string | null;
    }): TaskReminderData {
      return {
        taskId: task.id,
        title: task.title,
        description: task.description,
        dueDate: task.dueDate,
        priority: task.priority,
        assignedToName: task.assignedToName,
        category: task.category,
      };
    }

    // 1. Notificar tareas vencidas
    for (const task of overdueTasks) {
      const daysOverdue = Math.floor(
        (startOfToday.getTime() - (task.dueDate?.getTime() || 0)) / (1000 * 60 * 60 * 24)
      );
      const discordIds = getDiscordUserIds(task);
      for (const discordId of discordIds) {
        try {
          const res = await notifyTaskOverdue(discordId, toTaskData(task), daysOverdue);
          if (res.success) results.sent++;
          else results.failed++;
        } catch (err: any) {
          results.failed++;
          results.errors.push(`Overdue task ${task.id}: ${err.message}`);
        }
      }
    }

    // 2. Notificar tareas que vencen hoy
    for (const task of dueTodayTasks) {
      const discordIds = getDiscordUserIds(task);
      for (const discordId of discordIds) {
        try {
          const res = await notifyTaskDueDate(discordId, toTaskData(task), 'today');
          if (res.success) results.sent++;
          else results.failed++;
        } catch (err: any) {
          results.failed++;
          results.errors.push(`Due today task ${task.id}: ${err.message}`);
        }
      }
    }

    // 3. Notificar tareas que vencen mañana
    for (const task of dueTomorrowTasks) {
      const discordIds = getDiscordUserIds(task);
      for (const discordId of discordIds) {
        try {
          const res = await notifyTaskDueDate(discordId, toTaskData(task), 'tomorrow');
          if (res.success) results.sent++;
          else results.failed++;
        } catch (err: any) {
          results.failed++;
          results.errors.push(`Due tomorrow task ${task.id}: ${err.message}`);
        }
      }
    }

    // 4. Agrupar por usuario y enviar resumen diario
    const userTaskMap = new Map<
      string,
      { overdue: TaskReminderData[]; dueToday: TaskReminderData[]; dueTomorrow: TaskReminderData[]; pending: TaskReminderData[] }
    >();

    function addToUserMap(discordId: string, bucket: 'overdue' | 'dueToday' | 'dueTomorrow', task: TaskReminderData) {
      if (!userTaskMap.has(discordId)) {
        userTaskMap.set(discordId, { overdue: [], dueToday: [], dueTomorrow: [], pending: [] });
      }
      userTaskMap.get(discordId)![bucket].push(task);
    }

    for (const task of overdueTasks) {
      const discordIds = getDiscordUserIds(task);
      for (const id of discordIds) addToUserMap(id, 'overdue', toTaskData(task));
    }
    for (const task of dueTodayTasks) {
      const discordIds = getDiscordUserIds(task);
      for (const id of discordIds) addToUserMap(id, 'dueToday', toTaskData(task));
    }
    for (const task of dueTomorrowTasks) {
      const discordIds = getDiscordUserIds(task);
      for (const id of discordIds) addToUserMap(id, 'dueTomorrow', toTaskData(task));
    }

    for (const [discordId, tasks] of userTaskMap) {
      try {
        const res = await sendDailySummary(discordId, {
          pending: [], // No separate pending list needed — overdue covers it
          overdue: tasks.overdue,
          dueToday: tasks.dueToday,
          dueTomorrow: tasks.dueTomorrow,
        });
        if (res.success) results.sent++;
        else results.failed++;
      } catch (err: any) {
        results.failed++;
        results.errors.push(`Daily summary for ${discordId}: ${err.message}`);
      }
    }

    console.log(
      `📊 [CRON Agenda Digest] Completado: ${results.sent} enviados, ${results.failed} fallidos`
    );

    return NextResponse.json({
      success: true,
      message: 'Resumen diario de agenda completado',
      overdue: overdueTasks.length,
      dueToday: dueTodayTasks.length,
      dueTomorrow: dueTomorrowTasks.length,
      ...results,
    });
  } catch (error: any) {
    console.error('❌ [CRON Agenda Digest] Error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor', details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
