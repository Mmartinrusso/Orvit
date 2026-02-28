import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromToken } from '@/lib/tasks/auth-helper';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// DELETE /api/agenda/comments/[id] — Eliminar un comentario (solo el autor)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = await params;
    const commentId = parseInt(id);
    if (isNaN(commentId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const comment = await prisma.agendaTaskComment.findUnique({
      where: { id: commentId },
      select: { authorId: true },
    });

    if (!comment) {
      return NextResponse.json({ error: 'Comentario no encontrado' }, { status: 404 });
    }

    if (comment.authorId !== user.id) {
      return NextResponse.json({ error: 'Solo el autor puede eliminar su comentario' }, { status: 403 });
    }

    await prisma.agendaTaskComment.delete({ where: { id: commentId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Error deleting task comment:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
