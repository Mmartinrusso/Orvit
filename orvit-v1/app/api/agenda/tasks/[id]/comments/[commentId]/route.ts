import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromToken } from '@/lib/tasks/auth-helper';
import { CreateAgendaTaskCommentSchema } from '@/lib/validations/agenda-tasks';
import { validateRequest } from '@/lib/validations/helpers';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string; commentId: string }>;
}

// PUT /api/agenda/tasks/[id]/comments/[commentId] — Editar comentario
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id, commentId: commentIdStr } = await params;
    const taskId = parseInt(id);
    const commentId = parseInt(commentIdStr);
    if (isNaN(taskId) || isNaN(commentId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const comment = await prisma.agendaTaskComment.findUnique({
      where: { id: commentId },
      select: { id: true, taskId: true, authorId: true },
    });

    if (!comment || comment.taskId !== taskId) {
      return NextResponse.json({ error: 'Comentario no encontrado' }, { status: 404 });
    }

    // Solo el autor puede editar su propio comentario
    if (comment.authorId !== user.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const body = await request.json();
    const validation = validateRequest(CreateAgendaTaskCommentSchema, body);
    if (!validation.success) return validation.response;

    const updated = await prisma.agendaTaskComment.update({
      where: { id: commentId },
      data: { content: validation.data.content },
      include: {
        author: {
          select: { id: true, name: true, avatar: true },
        },
      },
    });

    return NextResponse.json({
      id: updated.id,
      content: updated.content,
      taskId: updated.taskId,
      authorId: updated.authorId,
      author: updated.author,
      companyId: updated.companyId,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error('[API] Error updating comment:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// DELETE /api/agenda/tasks/[id]/comments/[commentId]
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id, commentId: commentIdStr } = await params;
    const taskId = parseInt(id);
    const commentId = parseInt(commentIdStr);
    if (isNaN(taskId) || isNaN(commentId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const comment = await prisma.agendaTaskComment.findUnique({
      where: { id: commentId },
      select: { id: true, taskId: true, authorId: true },
    });

    if (!comment || comment.taskId !== taskId) {
      return NextResponse.json({ error: 'Comentario no encontrado' }, { status: 404 });
    }

    // Solo el autor puede eliminar su propio comentario
    if (comment.authorId !== user.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    await prisma.agendaTaskComment.delete({ where: { id: commentId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Error deleting comment:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
