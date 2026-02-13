import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createAndSendInstantNotification } from '@/lib/instant-notifications';
import { sendDailySummary, TaskReminderData } from '@/lib/discord/agenda-notifications';
import { connectBot, isBotReady } from '@/lib/discord/bot';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Tipo para agrupar tareas por usuario de Discord
interface UserDiscordTasks {
  discordUserId: string;
  overdue: TaskReminderData[];
  dueToday: TaskReminderData[];
  dueTomorrow: TaskReminderData[];
}

// POST /api/tasks/check-overdue
export async function POST(request: NextRequest) {
  try {
    console.log('📅 Iniciando verificación de tareas próximas a vencer...');

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const taskInclude = {
      assignedTo: { select: { id: true, name: true, email: true, discordUserId: true } },
      createdBy: { select: { id: true, name: true, email: true, discordUserId: true } }
    };

    const [tasksDueTomorrow, tasksDueToday, tasksOverdue] = await Promise.all([
      prisma.task.findMany({
        where: {
          dueDate: { gte: tomorrow, lt: new Date(tomorrow.getTime() + 24 * 60 * 60 * 1000) },
          status: { notIn: ['DONE', 'CANCELLED'] },
          assignedToId: { not: null }
        },
        include: taskInclude
      }),
      prisma.task.findMany({
        where: {
          dueDate: { gte: today, lt: tomorrow },
          status: { notIn: ['DONE', 'CANCELLED'] },
          assignedToId: { not: null }
        },
        include: taskInclude
      }),
      prisma.task.findMany({
        where: {
          dueDate: { lt: today },
          status: { notIn: ['DONE', 'CANCELLED'] },
          assignedToId: { not: null }
        },
        include: taskInclude
      })
    ]);

    console.log(`📋 Encontradas: ${tasksDueTomorrow.length} mañana, ${tasksDueToday.length} hoy, ${tasksOverdue.length} vencidas`);

    // Asegurar que el bot de Discord está conectado
    if (!isBotReady()) {
      const discordToken = process.env.DISCORD_BOT_TOKEN;
      if (discordToken) {
        await connectBot(discordToken);
      }
    }

    const notificationsSent: any[] = [];
    // Mapa para agrupar tareas por discordUserId para el resumen
    const discordUserTasks = new Map<string, UserDiscordTasks>();

    // Helper para acumular tareas en el mapa por usuario
    function addToDiscordSummary(
      discordUserId: string,
      category: 'overdue' | 'dueToday' | 'dueTomorrow',
      taskData: TaskReminderData
    ) {
      if (!discordUserTasks.has(discordUserId)) {
        discordUserTasks.set(discordUserId, {
          discordUserId,
          overdue: [],
          dueToday: [],
          dueTomorrow: [],
        });
      }
      discordUserTasks.get(discordUserId)![category].push(taskData);
    }

    // --- Procesar tareas que vencen MAÑANA ---
    for (const task of tasksDueTomorrow) {
      if (!task.assignedTo || !task.dueDate) continue;

      try {
        const existingNotification = await prisma.notification.findFirst({
          where: {
            userId: task.assignedTo.id,
            type: 'task_due_soon',
            metadata: { path: ['taskId'], equals: task.id },
            createdAt: { gte: yesterday }
          }
        });

        if (existingNotification) continue;

        const dueDate = new Date(task.dueDate);
        const formattedDate = dueDate.toLocaleDateString('es-ES', {
          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });

        // Notificación in-app (SSE + BD) - individual por tarea
        await createAndSendInstantNotification(
          'TASK_DUE_SOON',
          task.assignedTo.id,
          task.companyId,
          task.id,
          null,
          '⏰ Tarea vence mañana',
          `La tarea "${task.title}" vence mañana (${formattedDate}).`,
          'high',
          {
            taskTitle: task.title,
            taskDescription: task.description,
            dueDate: task.dueDate,
            createdBy: task.createdBy?.name || 'Sistema',
            priority: task.priority,
            notificationType: 'due_tomorrow'
          }
        );

        // Acumular para resumen Discord
        if (task.assignedTo.discordUserId) {
          addToDiscordSummary(task.assignedTo.discordUserId, 'dueTomorrow', {
            taskId: task.id,
            title: task.title,
            description: task.description,
            dueDate: task.dueDate,
            priority: task.priority,
            assignedToName: task.assignedTo.name,
          });
        }

        notificationsSent.push({
          taskId: task.id,
          taskTitle: task.title,
          assignedToId: task.assignedTo.id,
          assignedToName: task.assignedTo.name,
          dueDate: task.dueDate,
          type: 'due_tomorrow'
        });

      } catch (error) {
        console.error(`Error procesando tarea ${task.id} (mañana):`, error);
      }
    }

    // --- Procesar tareas que vencen HOY ---
    for (const task of tasksDueToday) {
      if (!task.assignedTo || !task.dueDate) continue;

      try {
        const existingNotification = await prisma.notification.findFirst({
          where: {
            userId: task.assignedTo.id,
            type: 'task_due_soon',
            metadata: { path: ['taskId'], equals: task.id },
            createdAt: { gte: today }
          }
        });

        if (existingNotification) continue;

        const dueDate = new Date(task.dueDate);
        const formattedTime = dueDate.toLocaleTimeString('es-ES', {
          hour: '2-digit', minute: '2-digit'
        });

        // Notificación in-app (SSE + BD) - individual por tarea
        await createAndSendInstantNotification(
          'TASK_DUE_TODAY',
          task.assignedTo.id,
          task.companyId,
          task.id,
          null,
          '🚨 Tarea vence HOY',
          `La tarea "${task.title}" vence HOY a las ${formattedTime}.`,
          'urgent',
          {
            taskTitle: task.title,
            taskDescription: task.description,
            dueDate: task.dueDate,
            createdBy: task.createdBy?.name || 'Sistema',
            priority: task.priority,
            notificationType: 'due_today'
          }
        );

        // Acumular para resumen Discord
        if (task.assignedTo.discordUserId) {
          addToDiscordSummary(task.assignedTo.discordUserId, 'dueToday', {
            taskId: task.id,
            title: task.title,
            description: task.description,
            dueDate: task.dueDate,
            priority: task.priority,
            assignedToName: task.assignedTo.name,
          });
        }

        notificationsSent.push({
          taskId: task.id,
          taskTitle: task.title,
          assignedToId: task.assignedTo.id,
          assignedToName: task.assignedTo.name,
          dueDate: task.dueDate,
          type: 'due_today'
        });

      } catch (error) {
        console.error(`Error procesando tarea ${task.id} (hoy):`, error);
      }
    }

    // --- Procesar tareas YA VENCIDAS ---
    for (const task of tasksOverdue) {
      if (!task.assignedTo || !task.dueDate) continue;

      try {
        // Solo notificar 1 vez al día por tarea vencida
        const existingNotification = await prisma.notification.findFirst({
          where: {
            userId: task.assignedTo.id,
            type: 'task_overdue',
            metadata: { path: ['taskId'], equals: task.id },
            createdAt: { gte: today }
          }
        });

        if (existingNotification) continue;

        const dueDate = new Date(task.dueDate);
        const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (24 * 60 * 60 * 1000));
        const formattedDate = dueDate.toLocaleDateString('es-ES', {
          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });

        // Notificación in-app (SSE + BD) - individual por tarea
        await createAndSendInstantNotification(
          'TASK_OVERDUE',
          task.assignedTo.id,
          task.companyId,
          task.id,
          null,
          '⚠️ Tarea vencida',
          `La tarea "${task.title}" venció hace ${daysOverdue} día${daysOverdue !== 1 ? 's' : ''} (${formattedDate}).`,
          'urgent',
          {
            taskTitle: task.title,
            taskDescription: task.description,
            dueDate: task.dueDate,
            daysOverdue,
            createdBy: task.createdBy?.name || 'Sistema',
            priority: task.priority,
            notificationType: 'overdue'
          }
        );

        // Acumular para resumen Discord
        if (task.assignedTo.discordUserId) {
          addToDiscordSummary(task.assignedTo.discordUserId, 'overdue', {
            taskId: task.id,
            title: task.title,
            description: task.description,
            dueDate: task.dueDate,
            priority: task.priority,
            assignedToName: task.assignedTo.name,
          });
        }

        notificationsSent.push({
          taskId: task.id,
          taskTitle: task.title,
          assignedToId: task.assignedTo.id,
          assignedToName: task.assignedTo.name,
          dueDate: task.dueDate,
          daysOverdue,
          type: 'overdue'
        });

      } catch (error) {
        console.error(`Error procesando tarea vencida ${task.id}:`, error);
      }
    }

    // --- Enviar UN resumen Discord por usuario ---
    let discordSummariesSent = 0;
    if (isBotReady() && discordUserTasks.size > 0) {
      for (const [discordUserId, userTasks] of discordUserTasks) {
        try {
          const totalTasks = userTasks.overdue.length + userTasks.dueToday.length + userTasks.dueTomorrow.length;
          // Pending = todas las del usuario
          const allPending = [...userTasks.overdue, ...userTasks.dueToday, ...userTasks.dueTomorrow];

          await sendDailySummary(discordUserId, {
            pending: allPending,
            overdue: userTasks.overdue,
            dueToday: userTasks.dueToday,
            dueTomorrow: userTasks.dueTomorrow,
          });

          discordSummariesSent++;
          console.log(`💬 Resumen Discord enviado a ${discordUserId}: ${totalTasks} tarea(s)`);
        } catch (discordError) {
          console.error(`⚠️ Error enviando resumen Discord a ${discordUserId}:`, discordError);
        }
      }
    }

    console.log(`✅ Verificación completada. ${notificationsSent.length} notificaciones in-app, ${discordSummariesSent} resúmenes Discord.`);

    return NextResponse.json({
      success: true,
      message: `Verificación completada. ${notificationsSent.length} notificaciones, ${discordSummariesSent} resúmenes Discord.`,
      tasksDueTomorrow: tasksDueTomorrow.length,
      tasksDueToday: tasksDueToday.length,
      tasksOverdue: tasksOverdue.length,
      notificationsSent: notificationsSent.length,
      discordSummariesSent,
      notifications: notificationsSent,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error en verificación de tareas próximas a vencer:', error);
    return NextResponse.json(
      { error: 'Error en verificación de tareas', details: error },
      { status: 500 }
    );
  }
}

// GET /api/tasks/check-overdue - Para testing manual
export async function GET(request: NextRequest) {
  return POST(request);
}
