import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendTaskReminder } from '@/lib/discord/agenda-notifications';
import { connectBot, isBotReady } from '@/lib/discord/bot';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * CRON: Verifica y envía recordatorios de agenda
 *
 * Se ejecuta cada minuto (o según configuración de Vercel)
 * Busca recordatorios pendientes donde remindAt <= ahora
 * Envía notificación por Discord y marca como enviado
 */
export async function GET(request: NextRequest) {
  try {
    console.log('⏰ [CRON Agenda] Iniciando verificación de recordatorios...');

    const now = new Date();

    // Buscar recordatorios pendientes cuya hora ya pasó
    const pendingReminders = await prisma.agendaReminder.findMany({
      where: {
        isSent: false,
        remindAt: {
          lte: now,
        },
      },
      include: {
        task: {
          include: {
            createdBy: true,
          },
        },
        user: true,
      },
      take: 50, // Procesar máximo 50 por ejecución para evitar timeouts
    });

    if (pendingReminders.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Sin recordatorios pendientes',
        processed: 0,
      });
    }

    console.log(`📋 [CRON Agenda] ${pendingReminders.length} recordatorio(s) a procesar`);

    // Asegurar que el bot está conectado
    if (!isBotReady()) {
      const discordToken = process.env.DISCORD_BOT_TOKEN;
      if (discordToken) {
        await connectBot(discordToken);
      }
    }

    const results = {
      sent: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (const reminder of pendingReminders) {
      try {
        // Obtener discordUserId del usuario
        const discordUserId = reminder.user?.discordUserId;

        if (!discordUserId) {
          console.warn(`⚠️ [CRON Agenda] Usuario ${reminder.userId} sin Discord ID`);
          // Marcar como enviado igualmente para no reintentar
          await prisma.agendaReminder.update({
            where: { id: reminder.id },
            data: { isSent: true },
          });
          results.failed++;
          results.errors.push(`Reminder ${reminder.id}: Usuario sin Discord ID`);
          continue;
        }

        // Verificar si DISCORD está en los canales de notificación
        const notifyVia = reminder.notifyVia as string[];
        if (!notifyVia.includes('DISCORD')) {
          // No es para Discord, marcar como enviado
          await prisma.agendaReminder.update({
            where: { id: reminder.id },
            data: { isSent: true },
          });
          continue;
        }

        // Preparar datos de la tarea
        const task = reminder.task;
        if (!task) {
          // Recordatorio huérfano
          await prisma.agendaReminder.update({
            where: { id: reminder.id },
            data: { isSent: true },
          });
          continue;
        }

        // Enviar notificación
        const sendResult = await sendTaskReminder(discordUserId, {
          reminderId: reminder.id,
          reminderTitle: reminder.title,
          task: {
            taskId: task.id,
            title: task.title,
            description: task.description,
            dueDate: task.dueDate,
            priority: task.priority,
            assignedToName: task.assignedToName,
            category: task.category,
          },
        });

        if (sendResult.success) {
          // Marcar como enviado
          await prisma.agendaReminder.update({
            where: { id: reminder.id },
            data: { isSent: true },
          });
          results.sent++;
          console.log(`✅ [CRON Agenda] Recordatorio ${reminder.id} enviado`);
        } else {
          results.failed++;
          results.errors.push(`Reminder ${reminder.id}: ${sendResult.error}`);
          console.error(`❌ [CRON Agenda] Error enviando recordatorio ${reminder.id}:`, sendResult.error);
        }
      } catch (error: any) {
        results.failed++;
        results.errors.push(`Reminder ${reminder.id}: ${error.message}`);
        console.error(`❌ [CRON Agenda] Error procesando recordatorio ${reminder.id}:`, error);
      }
    }

    console.log(`📊 [CRON Agenda] Completado: ${results.sent} enviados, ${results.failed} fallidos`);

    return NextResponse.json({
      success: true,
      message: 'Verificación de recordatorios completada',
      processed: pendingReminders.length,
      ...results,
    });
  } catch (error: any) {
    console.error('❌ [CRON Agenda] Error ejecutando verificación:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor', details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
