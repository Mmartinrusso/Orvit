import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resetCompletedTask, calculateNextExecution, normalizeFrequency } from '@/lib/task-scheduler';
import { getUserFromToken } from '@/lib/tasks/auth-helper';

export const dynamic = 'force-dynamic';

// POST /api/fixed-tasks/[id]/complete
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const taskId = params.id;

  try {
    // Auth compartida — sin secrets hardcodeados
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const body = await request.json();
    const { executionData } = body;

    // Obtener la tarea
    const currentTask = await prisma.fixedTask.findUnique({
      where: { id: parseInt(taskId) },
    });

    if (!currentTask) {
      return NextResponse.json({ error: 'Tarea no encontrada' }, { status: 404 });
    }

    // Solo el usuario asignado puede completar
    if (String(currentTask.assignedToId) !== String(user.id)) {
      return NextResponse.json(
        { error: 'Solo el usuario asignado puede completar esta tarea fija' },
        { status: 403 }
      );
    }

    const completedAt = new Date();
    const nextExecution = calculateNextExecution(normalizeFrequency(currentTask.frequency), completedAt);
    const now = new Date();
    const shouldResetNow = now >= nextExecution;

    // Operación atómica: registrar ejecución + marcar completada
    await prisma.$transaction(async (tx) => {
      if (executionData) {
        await tx.fixedTaskExecution.create({
          data: {
            fixedTaskId: parseInt(taskId),
            executedById: executionData.userId ? parseInt(executionData.userId) : null,
            executedByWorkerId: null,
            duration: executionData.duration || null,
            notes: executionData.notes || '',
            attachments:
              executionData.attachments?.length > 0
                ? JSON.stringify(executionData.attachments)
                : undefined,
            status: 'completed',
            executedAt: completedAt,
          },
        });
      }

      await tx.fixedTask.update({
        where: { id: parseInt(taskId) },
        data: {
          isCompleted: true,
          completedAt,
          lastExecuted: completedAt,
          nextExecution,
          updatedAt: completedAt,
        },
      });
    });

    let resetResult = null;

    // Auto-reset: si ya corresponde reiniciar, hacerlo de inmediato
    if (shouldResetNow) {
      const resetData = resetCompletedTask(normalizeFrequency(currentTask.frequency), completedAt);

      await prisma.fixedTask.update({
        where: { id: parseInt(taskId) },
        data: {
          isCompleted: false,
          completedAt: null,
          lastExecuted: completedAt,
          nextExecution: new Date(resetData.nextExecution),
          updatedAt: now,
        },
      });

      resetResult = {
        taskReset: true,
        newNextExecution: resetData.nextExecution,
        resetAt: now.toISOString(),
      };
    }

    // Obtener estado final de la tarea
    const updatedTask = await prisma.fixedTask.findUnique({
      where: { id: parseInt(taskId) },
    });

    return NextResponse.json({
      success: true,
      task: updatedTask,
      resetResult,
      message: resetResult
        ? 'Tarea completada y reiniciada automáticamente'
        : 'Tarea completada. Se reiniciará en la fecha programada',
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error('[complete] Error completando tarea fija:', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
