import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const taskId = parseInt(params.id);

    if (isNaN(taskId)) {
      return NextResponse.json(
        { error: 'ID de tarea inválido' },
        { status: 400 }
      );
    }

    console.log('🔍 [API] Obteniendo historial de ejecuciones para tarea:', taskId);

    // Verificar que la tarea existe
    const fixedTask = await prisma.fixedTask.findUnique({
      where: { id: taskId }
    });

    if (!fixedTask) {
      return NextResponse.json(
        { error: 'Tarea fija no encontrada' },
        { status: 404 }
      );
    }

    // Obtener historial de ejecuciones
    const executions = await prisma.fixedTaskExecution.findMany({
      where: {
        fixedTaskId: taskId
      },
      include: {
        executedBy: {
          select: {
            id: true,
            name: true
          }
        },
        executedByWorker: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: {
        executedAt: 'desc'
      }
    });

    // Transformar datos para el frontend
    const transformedExecutions = executions.map((execution) => ({
      id: execution.id.toString(),
      executedAt: execution.executedAt.toISOString(),
      executedBy: execution.executedBy?.name || execution.executedByWorker?.name || 'Usuario desconocido',
      duration: execution.duration || 0,
      status: execution.status,
      notes: execution.notes || '',
      attachments: execution.attachments ? JSON.parse(execution.attachments as string) : []
    }));

    // console.log('✅ [API] Historial obtenido:', transformedExecutions.length, 'ejecuciones') // Log reducido;

    return NextResponse.json({
      success: true,
      executions: transformedExecutions,
      count: transformedExecutions.length
    });

  } catch (error) {
    console.error('❌ [API] Error obteniendo historial de ejecuciones:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const taskId = parseInt(params.id);
    const body = await request.json();

    if (isNaN(taskId)) {
      return NextResponse.json(
        { error: 'ID de tarea inválido' },
        { status: 400 }
      );
    }

    const {
      executedById,
      executedByWorkerId,
      duration,
      notes,
      attachments,
      status = 'completed'
    } = body;

    console.log('📝 [API] Registrando nueva ejecución para tarea:', taskId);

    // Verificar que la tarea existe
    const fixedTask = await prisma.fixedTask.findUnique({
      where: { id: taskId }
    });

    if (!fixedTask) {
      return NextResponse.json(
        { error: 'Tarea fija no encontrada' },
        { status: 404 }
      );
    }

    // Crear nueva ejecución
    const newExecution = await prisma.fixedTaskExecution.create({
      data: {
        fixedTaskId: taskId,
        executedById: executedById || null,
        executedByWorkerId: executedByWorkerId || null,
        duration: duration || null,
        notes: notes || null,
        attachments: attachments ? JSON.stringify(attachments) : undefined,
        status: status,
        executedAt: new Date()
      },
      include: {
        executedBy: {
          select: {
            id: true,
            name: true
          }
        },
        executedByWorker: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    // Transformar para el frontend
    const transformedExecution = {
      id: newExecution.id.toString(),
      executedAt: newExecution.executedAt.toISOString(),
      executedBy: (newExecution as any).executedBy?.name || (newExecution as any).executedByWorker?.name || 'Usuario desconocido',
      duration: newExecution.duration || 0,
      status: newExecution.status,
      notes: newExecution.notes || '',
      attachments: newExecution.attachments ? JSON.parse(newExecution.attachments as string) : []
    };

    console.log('✅ [API] Ejecución registrada exitosamente:', newExecution.id);

    return NextResponse.json({
      success: true,
      execution: transformedExecution
    }, { status: 201 });

  } catch (error) {
    console.error('❌ [API] Error registrando ejecución:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
} 