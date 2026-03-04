import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { notifyTaskDueSoon } from '@/lib/discord/agenda-notifications';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * CRON: Notifica tareas que vencen en 15 minutos
 *
 * Se ejecuta cada minuto
 * Busca tareas con dueDate entre ahora y 15 minutos
 * Envía notificación por Discord con botones de acción
 */
export async function GET(request: NextRequest) {
  try {
    console.log('⏰ [CRON Due Soon] Verificando tareas próximas a vencer...');

    const now = new Date();
    const in15Minutes = new Date(now.getTime() + 15 * 60 * 1000);

    // Buscar tareas que:
    // - Tienen dueDate entre ahora y 15 minutos
    // - No están completadas
    // - No se ha enviado notificación de 15 min
    const tasksDueSoon = await prisma.agendaTask.findMany({
      where: {
        dueDate: {
          gt: now,
          lte: in15Minutes,
        },
        status: {
          in: ['PENDING', 'IN_PROGRESS'],
        },
        reminder15MinSentAt: null,
      },
      include: {
        createdBy: true,
        assignedToUser: true,
      },
      take: 50,
    });

    if (tasksDueSoon.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Sin tareas próximas a vencer',
        processed: 0,
      });
    }

    console.log(`📋 [CRON Due Soon] ${tasksDueSoon.length} tarea(s) próximas a vencer`);

    const results = {
      sent: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (const task of tasksDueSoon) {
      try {
        const taskData = {
          taskId: task.id,
          title: task.title,
          description: task.description,
          dueDate: task.dueDate,
          priority: task.priority,
          assignedToName: task.assignedToName,
          category: task.category,
        };

        // Calcular minutos hasta vencimiento
        const minutesUntilDue = Math.round(
          (task.dueDate!.getTime() - now.getTime()) / (60 * 1000)
        );

        // Determinar destinatarios: asignado (primario) y creador (si diferente)
        const assignedDiscordId = task.assignedToUser?.discordUserId;
        const creatorDiscordId = task.createdBy?.discordUserId;
        const hasAssigned = task.assignedToUserId && task.assignedToUserId !== task.createdById;

        let anySent = false;

        // 1. Notificar al asignado (si tiene Discord)
        if (assignedDiscordId) {
          const res = await notifyTaskDueSoon(assignedDiscordId, taskData, minutesUntilDue);
          if (res.success) anySent = true;
        }

        // 2. Notificar al creador (siempre, o si no hay asignado diferente)
        if (creatorDiscordId && (!hasAssigned || !assignedDiscordId)) {
          const res = await notifyTaskDueSoon(creatorDiscordId, taskData, minutesUntilDue);
          if (res.success) anySent = true;
        } else if (creatorDiscordId && hasAssigned) {
          // Si hay asignado diferente, también notificar al creador
          const res = await notifyTaskDueSoon(creatorDiscordId, taskData, minutesUntilDue);
          if (res.success) anySent = true;
        }

        if (!assignedDiscordId && !creatorDiscordId) {
          console.warn(`⚠️ [CRON Due Soon] Tarea ${task.id}: ni asignado ni creador tienen Discord ID`);
        }

        // Marcar como enviado para no reintentar
        await prisma.agendaTask.update({
          where: { id: task.id },
          data: { reminder15MinSentAt: now },
        });

        if (anySent) {
          results.sent++;
          console.log(`✅ [CRON Due Soon] Notificación enviada para tarea #${task.id}`);
        } else {
          results.failed++;
          results.errors.push(`Task ${task.id}: sin Discord ID disponible`);
        }
      } catch (error: any) {
        results.failed++;
        results.errors.push(`Task ${task.id}: ${error.message}`);
        console.error(`❌ [CRON Due Soon] Error procesando tarea ${task.id}:`, error);
      }
    }

    console.log(`📊 [CRON Due Soon] Completado: ${results.sent} enviados, ${results.failed} fallidos`);

    return NextResponse.json({
      success: true,
      message: 'Verificación de tareas completada',
      processed: tasksDueSoon.length,
      ...results,
    });
  } catch (error: any) {
    console.error('❌ [CRON Due Soon] Error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor', details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
