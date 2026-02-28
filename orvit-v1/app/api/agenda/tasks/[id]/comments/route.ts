import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromToken } from '@/lib/tasks/auth-helper';
import { CreateAgendaTaskCommentSchema } from '@/lib/validations/agenda-tasks';
import { validateRequest } from '@/lib/validations/helpers';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/agenda/tasks/[id]/comments — Listar comentarios de una tarea
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = await params;
    const taskId = parseInt(id);
    if (isNaN(taskId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    // Verificar que la tarea existe y que el usuario tiene acceso a ella
    const task = await prisma.agendaTask.findUnique({
      where: { id: taskId },
      select: {
        companyId: true,
        createdById: true,
        assignedToUserId: true,
        isCompanyVisible: true,
      },
    });

    if (!task) {
      return NextResponse.json({ error: 'Tarea no encontrada' }, { status: 404 });
    }

    const userCompanyIds = [
      ...(user.ownedCompanies ?? []).map((c: any) => c.id),
      ...(user.companies ?? []).map((c: any) => c.companyId),
    ];
    const canAccess =
      task.createdById === user.id ||
      task.assignedToUserId === user.id ||
      task.isCompanyVisible ||
      userCompanyIds.includes(task.companyId);

    if (!canAccess) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const comments = await prisma.agendaTaskComment.findMany({
      where: { taskId },
      include: {
        author: {
          select: { id: true, name: true, avatar: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json(
      comments.map((c) => ({
        id: c.id,
        content: c.content,
        taskId: c.taskId,
        authorId: c.authorId,
        author: c.author,
        companyId: c.companyId,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
      }))
    );
  } catch (error) {
    console.error('[API] Error fetching task comments:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// POST /api/agenda/tasks/[id]/comments — Crear un comentario
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = await params;
    const taskId = parseInt(id);
    if (isNaN(taskId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    // Verificar acceso a la tarea
    const task = await prisma.agendaTask.findUnique({
      where: { id: taskId },
      select: {
        companyId: true,
        createdById: true,
        assignedToUserId: true,
        isCompanyVisible: true,
      },
    });

    if (!task) {
      return NextResponse.json({ error: 'Tarea no encontrada' }, { status: 404 });
    }

    const userCompanyIds = [
      ...(user.ownedCompanies ?? []).map((c: any) => c.id),
      ...(user.companies ?? []).map((c: any) => c.companyId),
    ];
    const canAccess =
      task.createdById === user.id ||
      task.assignedToUserId === user.id ||
      task.isCompanyVisible ||
      userCompanyIds.includes(task.companyId);

    if (!canAccess) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const body = await request.json();
    const validation = validateRequest(CreateAgendaTaskCommentSchema, body);
    if (!validation.success) return validation.response;

    const comment = await prisma.agendaTaskComment.create({
      data: {
        content: validation.data.content,
        taskId,
        authorId: user.id,
        companyId: task.companyId,
      },
      include: {
        author: {
          select: { id: true, name: true, avatar: true },
        },
      },
    });

    return NextResponse.json(
      {
        id: comment.id,
        content: comment.content,
        taskId: comment.taskId,
        authorId: comment.authorId,
        author: comment.author,
        companyId: comment.companyId,
        createdAt: comment.createdAt.toISOString(),
        updatedAt: comment.updatedAt.toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[API] Error creating task comment:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
