import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resetCompletedTask } from '@/lib/task-scheduler';
import { getUserFromToken } from '@/lib/tasks/auth-helper';

export const dynamic = 'force-dynamic';

// POST /api/fixed-tasks/check-resets
// Verifica y reinicia tareas cuando el usuario entra a la pestaña "Fijas"
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { companyId } = body;

    if (!companyId) {
      return NextResponse.json({ error: 'Company ID requerido' }, { status: 400 });
    }

    const now = new Date();

    const tasksNeedingReset = await prisma.fixedTask.findMany({
      where: {
        companyId: parseInt(companyId),
        isCompleted: true,
        isActive: true,
        nextExecution: { lte: now },
      },
    });

    if (tasksNeedingReset.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No hay tareas que necesiten reiniciarse',
        tasksReset: 0,
        resetTasks: [],
      });
    }

    const resetResults = [];
    const errorResults = [];

    for (const task of tasksNeedingReset) {
      try {
        const resetData = resetCompletedTask(
          task.frequency,
          new Date(task.completedAt || new Date()),
          now
        );

        await prisma.fixedTask.update({
          where: { id: task.id },
          data: {
            isCompleted: false,
            completedAt: null,
            lastExecuted: task.completedAt,
            nextExecution: new Date(resetData.nextExecution),
            updatedAt: now,
          },
        });

        resetResults.push({
          taskId: task.id,
          title: task.title,
          frequency: task.frequency,
          previousCompletedAt: task.completedAt?.toISOString(),
          newNextExecution: resetData.nextExecution,
          resetAt: now.toISOString(),
        });
      } catch (taskError) {
        console.error(`[check-resets] Error procesando tarea ${task.id}:`, taskError);
        errorResults.push({
          taskId: task.id,
          title: task.title,
          error: taskError instanceof Error ? taskError.message : 'Error desconocido',
        });
      }
    }

    const message =
      resetResults.length > 0
        ? `${resetResults.length} tarea${resetResults.length > 1 ? 's' : ''} reiniciada${resetResults.length > 1 ? 's' : ''}`
        : 'No se reiniciaron tareas';

    return NextResponse.json({
      success: true,
      message,
      tasksReset: resetResults.length,
      tasksWithErrors: errorResults.length,
      resetTasks: resetResults,
      errors: errorResults,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error('[check-resets] Error en verificación:', error);
    return NextResponse.json(
      { success: false, error: 'Error en verificación de reinicios' },
      { status: 500 }
    );
  }
}

// GET /api/fixed-tasks/check-resets - Información sobre tareas que necesitan reiniciar
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');

    if (!companyId) {
      return NextResponse.json({ error: 'Company ID requerido' }, { status: 400 });
    }

    const now = new Date();

    const tasksNeedingReset = await prisma.fixedTask.findMany({
      where: {
        companyId: parseInt(companyId),
        isCompleted: true,
        isActive: true,
        nextExecution: { lte: now },
      },
      select: { id: true, title: true, frequency: true, completedAt: true, nextExecution: true },
      orderBy: { nextExecution: 'asc' },
    });

    return NextResponse.json({
      success: true,
      tasksNeedingReset: tasksNeedingReset.length,
      tasks: tasksNeedingReset.map((task) => ({
        id: task.id,
        title: task.title,
        frequency: task.frequency,
        completedAt: task.completedAt?.toISOString(),
        nextExecution: task.nextExecution.toISOString(),
        hoursOverdue: Math.ceil(
          (now.getTime() - new Date(task.nextExecution).getTime()) / (1000 * 60 * 60)
        ),
      })),
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error('[check-resets] Error obteniendo tareas:', error);
    return NextResponse.json({ success: false, error: 'Error obteniendo información' }, { status: 500 });
  }
}
