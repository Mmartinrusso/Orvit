import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resetCompletedTask, shouldTaskReset } from '@/lib/task-scheduler';
import { requireAuth } from '@/lib/auth/shared-helpers';

export const dynamic = 'force-dynamic';

/**
 * Verifica que la request viene del scheduler interno.
 * Este endpoint NO es para usuarios — es llamado por cron jobs o el scheduler.
 */
function verifyInternalSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) return false;
  return authHeader === `Bearer ${secret}`;
}

// POST /api/fixed-tasks/auto-reset - Reiniciar tareas completadas que ya vencieron
export async function POST(request: NextRequest) {
  const { user, error: authError } = await requireAuth();
  if (authError) {
    // Fallback: also check internal secret for cron jobs
    if (!verifyInternalSecret(request)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
  }

  try {
    const completedTasks = await prisma.fixedTask.findMany({
      where: { isCompleted: true, isActive: true },
    });

    const resetTasks = [];
    const now = new Date();

    for (const task of completedTasks) {
      const shouldReset = now >= new Date(task.nextExecution);
      if (!shouldReset) continue;

      try {
        const resetData = resetCompletedTask(
          task.frequency as any,
          new Date(task.completedAt || new Date())
        );

        await prisma.fixedTask.update({
          where: { id: task.id },
          data: {
            isCompleted: false,
            completedAt: null,
            lastExecuted: task.completedAt,
            nextExecution: new Date(resetData.nextExecution),
            updatedAt: new Date(),
          },
        });

        resetTasks.push({
          id: task.id,
          title: task.title,
          frequency: task.frequency,
          nextExecution: resetData.nextExecution,
          previousCompletedAt: task.completedAt,
        });
      } catch (error) {
        console.error(`[auto-reset] Error reiniciando tarea ${task.title}:`, error);
      }
    }

    return NextResponse.json({
      success: true,
      message: `${resetTasks.length} tareas reiniciadas.`,
      tasksReset: resetTasks.length,
      resetTasks,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[auto-reset] Error en verificación automática:', error);
    return NextResponse.json({ error: 'Error en verificación automática' }, { status: 500 });
  }
}

// GET /api/fixed-tasks/auto-reset - Estado de tareas pendientes de reinicio
export async function GET(request: NextRequest) {
  const { user: authUser, error: authError } = await requireAuth();
  if (authError) {
    // Fallback: also check internal secret for cron jobs
    if (!verifyInternalSecret(request)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
  }

  try {
    const completedTasks = await prisma.fixedTask.findMany({
      where: { isCompleted: true, isActive: true },
      select: { id: true, title: true, frequency: true, completedAt: true, nextExecution: true },
    });

    const now = new Date();
    const tasksNeedingReset = completedTasks.filter((task) => now >= new Date(task.nextExecution));

    return NextResponse.json({
      success: true,
      totalCompletedTasks: completedTasks.length,
      tasksNeedingReset: tasksNeedingReset.length,
      tasks: tasksNeedingReset,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error('[auto-reset] Error obteniendo estado:', error);
    return NextResponse.json({ error: 'Error obteniendo estado' }, { status: 500 });
  }
}
