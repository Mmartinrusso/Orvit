import { NextRequest, NextResponse } from 'next/server';
import { prisma } from "@/lib/prisma";
import { resetCompletedTask, shouldTaskReset } from '@/lib/task-scheduler';
import { loggers } from '@/lib/logger';
import { toUserTime, formatDateTz, DEFAULT_TIMEZONE } from '@/lib/date-utils';

export const dynamic = 'force-dynamic';


// POST /api/cron/task-reset-scheduler
// Este endpoint debe ser llamado por un cron job externo todos los días a las 8:00 AM hora Argentina
export async function POST(request: NextRequest) {
  const startTime = new Date();
  
  // Convertir a hora Argentina
  const argentinaTime = toUserTime(startTime, DEFAULT_TIMEZONE)!;

  loggers.cron.info({ startTime: startTime.toISOString(), argentinaTime: formatDateTz(startTime, 'dd/MM/yyyy HH:mm:ss') }, 'Starting automatic reset check');

  try {
    // Validar que este endpoint se ejecute a las 8:00 AM Argentina (con tolerancia de 15 minutos)
    const currentHour = argentinaTime.getHours();
    const currentMinute = argentinaTime.getMinutes();
    
    if (currentHour !== 8 || currentMinute > 15) {
      loggers.cron.warn({ hour: currentHour, minute: currentMinute }, 'Running outside scheduled time');
    } else {
      loggers.cron.info({ hour: currentHour, minute: currentMinute }, 'Running at correct time');
    }

    // Obtener todas las tareas fijas completadas que están activas
    const completedTasks = await prisma.fixedTask.findMany({
      where: {
        isCompleted: true,
        isActive: true
      },
      include: {
        company: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    loggers.cron.info({ completedTaskCount: completedTasks.length }, 'Found completed tasks to verify');

    const resetResults = [];
    const errorResults = [];
    let totalReset = 0;

    // Verificar cada tarea completada
    for (const task of completedTasks) {
      try {
        const now = new Date();
        const nextExecution = new Date(task.nextExecution);
        
        // Verificar si es hora de reiniciar (nextExecution <= now)
        const shouldReset = now >= nextExecution;
        
        if (shouldReset) {
          loggers.cron.info({ taskId: task.id, title: task.title, frequency: task.frequency }, 'Resetting task');
          
          // Calcular nueva fecha de próxima ejecución
          const resetData = resetCompletedTask(
            task.frequency,
            new Date(task.completedAt || new Date()),
            now
          );

          // Actualizar la tarea en la base de datos
          const updatedTask = await prisma.fixedTask.update({
            where: { id: task.id },
            data: {
              isCompleted: false,
              completedAt: null,
              lastExecuted: task.completedAt,
              nextExecution: new Date(resetData.nextExecution),
              updatedAt: now
            }
          });

          const result = {
            taskId: task.id,
            title: task.title,
            frequency: task.frequency,
            companyName: task.company?.name || 'Sin empresa',
            previousCompletedAt: task.completedAt?.toISOString(),
            newNextExecution: resetData.nextExecution,
            resetAt: now.toISOString()
          };

          resetResults.push(result);
          totalReset++;

          loggers.cron.info({ taskId: task.id, title: task.title, nextExecution: resetData.nextExecution }, 'Task reset successfully');

          // Opcional: Crear notificación para los usuarios asignados
          try {
            // Buscar usuarios de la empresa para notificar
            const companyUsers = await prisma.user.findMany({
              where: {
                OR: [
                  { ownedCompanies: { some: { id: task.companyId } } },
                  { companies: { some: { companyId: task.companyId } } }
                ]
              },
              select: { id: true, name: true, email: true }
            });

            // Crear notificación de reinicio automático
            for (const user of companyUsers) {
              await prisma.$executeRaw`
                INSERT INTO "Notification" (type, title, message, "userId", "companyId", metadata, "createdAt")
                VALUES (
                  'TASK_AUTO_RESET',
                  'Tarea reiniciada automáticamente',
                  ${`La tarea fija "${task.title}" se ha reiniciado automáticamente según su frecuencia ${task.frequency}.`},
                  ${user.id},
                  ${task.companyId},
                  ${JSON.stringify({ 
                    taskId: task.id, 
                    frequency: task.frequency,
                    resetType: 'automatic',
                    nextExecution: resetData.nextExecution
                  })},
                  NOW()
                )
              `;
            }
          } catch (notificationError) {
            loggers.cron.warn({ taskId: task.id, err: notificationError }, 'Error creating notifications for task');
          }

        } else {
          // Tarea aún no lista para reiniciar
          const hoursUntilReset = Math.ceil((nextExecution.getTime() - now.getTime()) / (1000 * 60 * 60));
          // Solo mostrar log si es menos de 24 horas
          if (hoursUntilReset <= 24) {
            loggers.cron.debug({ taskId: task.id, title: task.title, hoursUntilReset }, 'Task reset upcoming');
          }
        }

      } catch (taskError) {
        loggers.cron.error({ taskId: task.id, title: task.title, err: taskError }, 'Error processing task');
        errorResults.push({
          taskId: task.id,
          title: task.title,
          error: taskError instanceof Error ? taskError.message : 'Error desconocido'
        });
      }
    }

    const endTime = new Date();
    const executionTime = endTime.getTime() - startTime.getTime();

    loggers.cron.info({ executionTimeMs: executionTime, tasksReset: totalReset, errors: errorResults.length }, 'Cron scheduler process completed');

    // Estadísticas adicionales
    const pendingTasks = await prisma.fixedTask.count({
      where: {
        isCompleted: false,
        isActive: true
      }
    });

    const totalActiveTasks = await prisma.fixedTask.count({
      where: { isActive: true }
    });

    return NextResponse.json({
      success: true,
      executedAt: startTime.toISOString(),
      argentinaTime: formatDateTz(startTime, 'dd/MM/yyyy HH:mm:ss'),
      executionTimeMs: executionTime,
      results: {
        tasksEvaluated: completedTasks.length,
        tasksReset: totalReset,
        tasksWithErrors: errorResults.length,
        currentPendingTasks: pendingTasks,
        totalActiveTasks: totalActiveTasks
      },
      resetTasks: resetResults,
      errors: errorResults,
      message: `Proceso automático completado a las ${formatDateTz(startTime, 'dd/MM/yyyy HH:mm:ss')}. ${totalReset} tareas reiniciadas de ${completedTasks.length} evaluadas.`
    });

  } catch (error) {
    loggers.cron.error({ err: error }, 'Critical error in cron scheduler');
    
    return NextResponse.json({
      success: false,
      error: 'Error crítico en el cron scheduler',
      details: error instanceof Error ? error.message : 'Error desconocido',
      executedAt: startTime.toISOString(),
      argentinaTime: formatDateTz(startTime, 'dd/MM/yyyy HH:mm:ss'),
      executionTimeMs: new Date().getTime() - startTime.getTime()
    }, { status: 500 });
  }
}

// GET /api/cron/task-reset-scheduler 
// Endpoint informativo para verificar el estado del scheduler
export async function GET(request: NextRequest) {
  try {
    const now = new Date();
    const argentinaTime = toUserTime(now, DEFAULT_TIMEZONE)!;
    
    // Obtener tareas que necesitan reiniciar
    const tasksNeedingReset = await prisma.fixedTask.findMany({
      where: {
        isCompleted: true,
        isActive: true,
        nextExecution: {
          lte: now
        }
      },
      include: {
        company: {
          select: { name: true }
        }
      }
    });

    // Obtener próximas tareas a reiniciar (en las próximas 24 horas)
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const upcomingResets = await prisma.fixedTask.findMany({
      where: {
        isCompleted: true,
        isActive: true,
        nextExecution: {
          gt: now,
          lte: tomorrow
        }
      },
      select: {
        id: true,
        title: true,
        frequency: true,
        nextExecution: true,
        company: {
          select: { name: true }
        }
      },
      orderBy: {
        nextExecution: 'asc'
      }
    });

    // Estadísticas generales
    const stats = {
      totalActiveTasks: await prisma.fixedTask.count({
        where: { isActive: true }
      }),
      completedTasks: await prisma.fixedTask.count({
        where: { isCompleted: true, isActive: true }
      }),
      pendingTasks: await prisma.fixedTask.count({
        where: { isCompleted: false, isActive: true }
      })
    };

    // Calcular próxima ejecución del cron (mañana a las 8:00 AM Argentina)
    const nextCronExecution = new Date(argentinaTime);
    nextCronExecution.setDate(nextCronExecution.getDate() + 1);
    nextCronExecution.setHours(8, 0, 0, 0);

    return NextResponse.json({
      success: true,
      currentTime: now.toISOString(),
      argentinaTime: formatDateTz(now, 'dd/MM/yyyy HH:mm:ss'),
      nextCronExecution: formatDateTz(nextCronExecution, 'dd/MM/yyyy HH:mm:ss'),
      nextCronExecutionUTC: nextCronExecution.toISOString(),
      statistics: stats,
      tasksNeedingReset: {
        count: tasksNeedingReset.length,
        tasks: tasksNeedingReset.map(task => ({
          id: task.id,
          title: task.title,
          frequency: task.frequency,
          nextExecution: task.nextExecution.toISOString(),
          companyName: task.company?.name || 'Sin empresa'
        }))
      },
      upcomingResets: {
        count: upcomingResets.length,
        tasks: upcomingResets.map(task => ({
          id: task.id,
          title: task.title,
          frequency: task.frequency,
          nextExecution: task.nextExecution.toISOString(),
          companyName: task.company?.name || 'Sin empresa',
          hoursUntilReset: Math.ceil((new Date(task.nextExecution).getTime() - now.getTime()) / (1000 * 60 * 60))
        }))
      }
    });

  } catch (error) {
    loggers.cron.error({ err: error }, 'Error getting scheduler status');
    return NextResponse.json({
      success: false,
      error: 'Error obteniendo estado del scheduler',
      details: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 });
  }
} 