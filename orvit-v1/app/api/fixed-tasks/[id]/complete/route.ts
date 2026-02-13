import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resetCompletedTask, calculateNextExecution, normalizeFrequency } from '@/lib/task-scheduler';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { JWT_SECRET } from '@/lib/auth'; // ✅ Importar el mismo secret

// Helper para obtener el usuario actual
async function getCurrentUser() {
  try {
    const token = cookies().get('token')?.value;
    if (!token) return null;
    const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET || 'tu-clave-secreta-super-segura'));
    const user = await prisma.user.findUnique({ where: { id: payload.userId as number } });
    return user;
  } catch (error) { return null; }
}

// POST /api/fixed-tasks/[id]/complete
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const taskId = params.id;
  
  try {
    const body = await request.json();
    const { executionData } = body;

    console.log('🎯 Completando tarea y verificando reinicio automático:', taskId);

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    // Obtener la tarea actual
    const currentTask = await prisma.fixedTask.findUnique({
      where: { id: parseInt(taskId) }
    });

    console.log('📋 [COMPLETE] Tarea encontrada:', {
      id: currentTask?.id,
      title: currentTask?.title,
      frequency: currentTask?.frequency,
      assignedToId: currentTask?.assignedToId,
      isCompleted: currentTask?.isCompleted
    });

    if (!currentTask) {
      console.log('❌ [COMPLETE] Tarea no encontrada para ID:', taskId);
      return NextResponse.json(
        { error: 'Tarea no encontrada' },
        { status: 404 }
      );
    }

    console.log('👤 [COMPLETE] Verificando permisos - Usuario:', user.id, 'Asignado a:', currentTask.assignedToId);

    if (String(currentTask.assignedToId) !== String(user.id)) {
      console.log('🚫 [COMPLETE] Usuario no autorizado para completar esta tarea');
      return NextResponse.json({ error: 'Solo el usuario asignado puede completar esta tarea fija' }, { status: 403 });
    }

    const completedAt = new Date();
    console.log('🔄 [COMPLETE] Normalizando frecuencia:', currentTask.frequency, '→', normalizeFrequency(currentTask.frequency));
    const nextExecution = calculateNextExecution(normalizeFrequency(currentTask.frequency), completedAt);
    console.log('📅 [COMPLETE] Próxima ejecución calculada:', nextExecution.toISOString());

    // Registrar la ejecución en el historial si se proporcionan datos
    if (executionData) {
      console.log('📝 [COMPLETE] Registrando ejecución con datos:', {
        userId: executionData.userId,
        duration: executionData.duration,
        notes: executionData.notes,
        attachments: executionData.attachments?.length || 0
      });
      
      await prisma.fixedTaskExecution.create({
        data: {
          fixedTaskId: parseInt(taskId),
          executedById: executionData.userId ? parseInt(executionData.userId) : null,
          executedByWorkerId: null,
          duration: executionData.duration || null,
          notes: executionData.notes || '',
          attachments: executionData.attachments && executionData.attachments.length > 0 ? JSON.stringify(executionData.attachments) : undefined,
          status: 'completed',
          executedAt: completedAt
        }
      });
      
      console.log('✅ [COMPLETE] Ejecución registrada exitosamente');
    } else {
      console.log('⚠️ [COMPLETE] No se proporcionaron datos de ejecución');
    }

    // Actualizar la tarea como completada
    console.log('💾 [COMPLETE] Actualizando tarea como completada...');
    const updatedTask = await prisma.fixedTask.update({
      where: { id: parseInt(taskId) },
      data: {
        isCompleted: true,
        completedAt: completedAt,
        lastExecuted: completedAt,
        nextExecution: nextExecution,
        updatedAt: new Date()
      }
    });

    console.log('✅ [COMPLETE] Tarea completada exitosamente. Próximo reinicio:', nextExecution.toISOString());

    // VERIFICACIÓN INMEDIATA: ¿Debe reiniciarse ahora?
    const now = new Date();
    const shouldResetNow = now >= nextExecution;
    
    console.log('🔍 [COMPLETE] Verificando reinicio automático:', {
      now: now.toISOString(),
      nextExecution: nextExecution.toISOString(),
      shouldResetNow: shouldResetNow
    });
    
    let resetResult = null;
    
    if (shouldResetNow) {
      console.log('🔄 [COMPLETE] Reiniciando tarea inmediatamente...');
      
      // Calcular datos del reinicio
      const resetData = resetCompletedTask(
        normalizeFrequency(currentTask.frequency),
        completedAt
      );

      console.log('📊 [COMPLETE] Datos de reinicio calculados:', resetData);

      // Reiniciar la tarea inmediatamente
      const resetTask = await prisma.fixedTask.update({
        where: { id: parseInt(taskId) },
        data: {
          isCompleted: false,
          completedAt: null,
          lastExecuted: completedAt,
          nextExecution: new Date(resetData.nextExecution),
          updatedAt: new Date()
        }
      });

      resetResult = {
        taskReset: true,
        newNextExecution: resetData.nextExecution,
        resetAt: now.toISOString()
      };

      console.log('✅ [COMPLETE] Tarea reiniciada inmediatamente:', resetTask.title);
    } else {
      console.log('⏳ [COMPLETE] La tarea se reiniciará en la fecha programada');
    }

    // Notificar a otros clientes sobre el cambio (webhook-like)
    console.log('📡 [COMPLETE] Enviando notificación de actualización...');
    await broadcastTaskUpdate(taskId, {
      type: 'task_completed',
      task: updatedTask,
      resetResult: resetResult,
      timestamp: now.toISOString()
    });

    const response = {
      success: true,
      task: updatedTask,
      resetResult: resetResult,
      message: resetResult ? 
        'Tarea completada y reiniciada automáticamente' : 
        'Tarea completada. Se reiniciará en la fecha programada',
      timestamp: now.toISOString()
    };

    console.log('🎉 [COMPLETE] Operación completada exitosamente:', {
      taskId: taskId,
      taskTitle: currentTask.title,
      wasReset: !!resetResult,
      message: response.message
    });

    return NextResponse.json(response);

  } catch (error) {
    console.error('❌ [COMPLETE] Error completando tarea:', {
      taskId: taskId,
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined
    });
    return NextResponse.json(
      { error: 'Error interno del servidor', details: error instanceof Error ? error.message : 'Error desconocido' },
      { status: 500 }
    );
  }
}

// Función para notificar cambios a otros clientes (simula webhook)
async function broadcastTaskUpdate(taskId: string, updateData: any) {
  try {
    // Aquí podrías implementar WebSockets, SSE, o notificaciones push
    // Por ahora, registramos el evento para que otros endpoints puedan consultarlo
    
    console.log('📡 Broadcasting task update:', {
      taskId,
      updateType: updateData.type,
      timestamp: updateData.timestamp
    });

    // Opcional: Registrar el evento para tracking (sin usar DB por ahora)
    console.log('📊 Task event registered:', {
      eventId: `task-event-${Date.now()}-${taskId}`,
      eventType: 'TASK_EVENT',
      taskId: parseInt(taskId),
      eventName: `Task ${updateData.type}`,
      eventData: updateData,
      timestamp: new Date()
    });

  } catch (error) {
    console.error('Error broadcasting update:', error);
  }
} 