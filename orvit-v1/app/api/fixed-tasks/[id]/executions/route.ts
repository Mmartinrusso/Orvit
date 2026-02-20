import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromToken, hasAccessToCompany } from '@/lib/tasks/auth-helper';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Autenticación requerida
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const taskId = parseInt(params.id);
    if (isNaN(taskId)) {
      return NextResponse.json({ error: 'ID de tarea inválido' }, { status: 400 });
    }

    // Paginación
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0'));

    // Verificar que la tarea existe y pertenece a una empresa del usuario
    const fixedTask = await prisma.fixedTask.findUnique({
      where: { id: taskId },
      select: { id: true, companyId: true },
    });

    if (!fixedTask) {
      return NextResponse.json({ error: 'Tarea fija no encontrada' }, { status: 404 });
    }

    if (!hasAccessToCompany(user, fixedTask.companyId)) {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
    }

    const [executions, total] = await Promise.all([
      prisma.fixedTaskExecution.findMany({
        where: { fixedTaskId: taskId },
        include: {
          executedBy: { select: { id: true, name: true } },
          executedByWorker: { select: { id: true, name: true } },
        },
        orderBy: { executedAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.fixedTaskExecution.count({ where: { fixedTaskId: taskId } }),
    ]);

    const transformedExecutions = executions.map((execution) => ({
      id: execution.id.toString(),
      executedAt: execution.executedAt.toISOString(),
      executedBy: execution.executedBy?.name || execution.executedByWorker?.name || 'Usuario desconocido',
      duration: execution.duration || 0,
      status: execution.status,
      notes: execution.notes || '',
      attachments: execution.attachments ? JSON.parse(execution.attachments as string) : [],
    }));

    return NextResponse.json({
      success: true,
      executions: transformedExecutions,
      count: total,
      pagination: { limit, offset, total, hasMore: offset + limit < total },
    });
  } catch (error) {
    console.error('[API] Error obteniendo historial de ejecuciones:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Autenticación requerida
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const taskId = parseInt(params.id);
    if (isNaN(taskId)) {
      return NextResponse.json({ error: 'ID de tarea inválido' }, { status: 400 });
    }

    const body = await request.json();
    const { executedById, executedByWorkerId, duration, notes, attachments, status = 'completed' } = body;

    // Verificar que la tarea existe y pertenece a la empresa del usuario
    const fixedTask = await prisma.fixedTask.findUnique({
      where: { id: taskId },
      select: { id: true, companyId: true },
    });

    if (!fixedTask) {
      return NextResponse.json({ error: 'Tarea fija no encontrada' }, { status: 404 });
    }

    if (!hasAccessToCompany(user, fixedTask.companyId)) {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
    }

    const newExecution = await prisma.fixedTaskExecution.create({
      data: {
        fixedTaskId: taskId,
        executedById: executedById || null,
        executedByWorkerId: executedByWorkerId || null,
        duration: duration || null,
        notes: notes || null,
        attachments: attachments ? JSON.stringify(attachments) : undefined,
        status,
        executedAt: new Date(),
      },
      include: {
        executedBy: { select: { id: true, name: true } },
        executedByWorker: { select: { id: true, name: true } },
      },
    });

    const transformedExecution = {
      id: newExecution.id.toString(),
      executedAt: newExecution.executedAt.toISOString(),
      executedBy: (newExecution as any).executedBy?.name || (newExecution as any).executedByWorker?.name || 'Usuario desconocido',
      duration: newExecution.duration || 0,
      status: newExecution.status,
      notes: newExecution.notes || '',
      attachments: newExecution.attachments ? JSON.parse(newExecution.attachments as string) : [],
    };

    return NextResponse.json({ success: true, execution: transformedExecution }, { status: 201 });
  } catch (error) {
    console.error('[API] Error registrando ejecución:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
