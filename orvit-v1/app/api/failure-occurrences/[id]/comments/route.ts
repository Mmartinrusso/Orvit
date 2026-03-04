/**
 * API: /api/failure-occurrences/[id]/comments
 *
 * GET - Lista de comentarios de una falla (usando FailureOccurrenceComment)
 * POST - Crear nuevo comentario
 * PATCH - Editar comentario existente
 * DELETE - Eliminar comentario
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { z } from 'zod';
import { triggerCompanyEvent } from '@/lib/chat/pusher';

export const dynamic = 'force-dynamic';

/**
 * Schema para crear/editar comentario
 */
const createCommentSchema = z.object({
  content: z.string().min(1, 'El comentario no puede estar vacío').max(2000),
  type: z.enum(['comment', 'update', 'issue']).optional().default('comment'),
  mentions: z.array(z.number().int().positive()).optional(),
});

const updateCommentSchema = z.object({
  commentId: z.number().int().positive(),
  content: z.string().min(1, 'El comentario no puede estar vacío').max(2000),
});

const deleteCommentSchema = z.object({
  commentId: z.number().int().positive(),
});

/**
 * GET /api/failure-occurrences/[id]/comments
 * Lista de comentarios de una falla
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload || !payload.companyId) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const companyId = payload.companyId as number;
    const occurrenceId = parseInt(params.id);

    if (isNaN(occurrenceId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    // Verify the failure belongs to this company
    const occurrence = await prisma.failureOccurrence.findFirst({
      where: { id: occurrenceId, companyId },
      select: { id: true },
    });

    if (!occurrence) {
      return NextResponse.json(
        { error: 'Falla no encontrada' },
        { status: 404 }
      );
    }

    // Get comments directly from FailureOccurrenceComment
    const comments = await prisma.failureOccurrenceComment.findMany({
      where: { failureOccurrenceId: occurrenceId },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const transformedComments = comments.map((comment) => ({
      id: comment.id,
      content: comment.content,
      type: comment.type,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      author: comment.author
        ? {
            id: comment.author.id,
            name: comment.author.name,
            email: comment.author.email,
          }
        : null,
    }));

    return NextResponse.json({
      data: transformedComments,
      count: transformedComments.length,
    });
  } catch (error: any) {
    console.error('❌ Error en GET /api/failure-occurrences/[id]/comments:', error);
    if (error?.code === 'P2010' || error?.code === 'P2022' || error?.message?.includes('column') || error?.message?.includes('does not exist') || error?.message?.includes('relation')) {
      console.warn('⚠️ Tabla failure_occurrence_comments no existe. Ejecutar: npx prisma db push');
      return NextResponse.json({
        data: [],
        count: 0,
        _warning: 'Schema desactualizado - ejecutar: npx prisma db push'
      });
    }
    return NextResponse.json(
      { error: 'Error al obtener comentarios', detail: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/failure-occurrences/[id]/comments
 * Crear nuevo comentario
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload || !payload.companyId || !payload.userId) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const companyId = payload.companyId as number;
    const userId = payload.userId as number;
    const occurrenceId = parseInt(params.id);

    if (isNaN(occurrenceId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const body = await request.json();
    const validationResult = createCommentSchema.safeParse(body);

    if (!validationResult.success) {
      const errors = validationResult.error.errors
        .map((e) => `${e.path.join('.')}: ${e.message}`)
        .join(', ');
      return NextResponse.json(
        { error: `Validación falló: ${errors}` },
        { status: 400 }
      );
    }

    const data = validationResult.data;

    // Verify the failure belongs to this company
    const occurrence = await prisma.failureOccurrence.findFirst({
      where: { id: occurrenceId, companyId },
      select: { id: true, title: true },
    });

    if (!occurrence) {
      return NextResponse.json(
        { error: 'Falla no encontrada' },
        { status: 404 }
      );
    }

    // Create comment directly on FailureOccurrenceComment
    const comment = await prisma.failureOccurrenceComment.create({
      data: {
        failureOccurrenceId: occurrenceId,
        content: data.content,
        type: data.type,
        authorId: userId,
        mentionedUserIds: data.mentions && data.mentions.length > 0 ? data.mentions : undefined,
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Create notifications for mentioned users
    if (data.mentions && data.mentions.length > 0) {
      const authorName = comment.author?.name || 'Alguien';
      const mentionNotifications = data.mentions
        .filter((mentionedUserId: number) => mentionedUserId !== userId)
        .map((mentionedUserId: number) =>
          prisma.notification.create({
            data: {
              userId: mentionedUserId,
              type: 'MENTION',
              title: `${authorName} te mencionó en una falla`,
              message: `"${data.content.substring(0, 100)}${data.content.length > 100 ? '...' : ''}" — Falla: ${occurrence.title}`,
              data: JSON.stringify({
                failureOccurrenceId: occurrenceId,
                commentId: comment.id,
                mentionedBy: userId,
              }),
              isRead: false,
              companyId,
            }
          }).catch((err: any) => {
            console.warn(`⚠️ Error creando notificación de mención para usuario ${mentionedUserId}:`, err.message);
          })
        );

      Promise.all(mentionNotifications).catch(() => {});
    }

    // Pusher realtime trigger
    triggerCompanyEvent(companyId, "failures", "failure:updated", { id: occurrenceId });

    return NextResponse.json(
      {
        data: {
          id: comment.id,
          content: comment.content,
          type: comment.type,
          createdAt: comment.createdAt,
          updatedAt: comment.updatedAt,
          author: comment.author,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('❌ Error en POST /api/failure-occurrences/[id]/comments:', error);
    return NextResponse.json(
      { error: 'Error al crear comentario', detail: error.message },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/failure-occurrences/[id]/comments
 * Editar un comentario existente (solo el autor puede editar)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload || !payload.userId) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const userId = payload.userId as number;
    const companyId = payload.companyId as number;
    const occurrenceId = parseInt(params.id);

    const body = await request.json();
    const validationResult = updateCommentSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Datos inválidos' },
        { status: 400 }
      );
    }

    const { commentId, content } = validationResult.data;

    // Verify the comment exists and belongs to this user
    const existingComment = await prisma.failureOccurrenceComment.findFirst({
      where: { id: commentId, authorId: userId },
    });

    if (!existingComment) {
      return NextResponse.json(
        { error: 'Comentario no encontrado o no tenés permiso para editarlo' },
        { status: 404 }
      );
    }

    const updated = await prisma.failureOccurrenceComment.update({
      where: { id: commentId },
      data: { content },
      include: {
        author: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    // Pusher realtime trigger
    triggerCompanyEvent(companyId, "failures", "failure:updated", { id: occurrenceId });

    return NextResponse.json({
      data: {
        id: updated.id,
        content: updated.content,
        type: updated.type,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
        author: updated.author,
      },
    });
  } catch (error: any) {
    console.error('❌ Error en PATCH /api/failure-occurrences/[id]/comments:', error);
    return NextResponse.json(
      { error: 'Error al editar comentario', detail: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/failure-occurrences/[id]/comments
 * Eliminar un comentario (solo el autor puede eliminar)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload || !payload.userId) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const userId = payload.userId as number;
    const companyId = payload.companyId as number;
    const occurrenceId = parseInt(params.id);

    const body = await request.json();
    const validationResult = deleteCommentSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Datos inválidos' },
        { status: 400 }
      );
    }

    const { commentId } = validationResult.data;

    // Verify the comment exists and belongs to this user
    const existingComment = await prisma.failureOccurrenceComment.findFirst({
      where: { id: commentId, authorId: userId },
    });

    if (!existingComment) {
      return NextResponse.json(
        { error: 'Comentario no encontrado o no tenés permiso para eliminarlo' },
        { status: 404 }
      );
    }

    await prisma.failureOccurrenceComment.delete({
      where: { id: commentId },
    });

    // Pusher realtime trigger
    triggerCompanyEvent(companyId, "failures", "failure:updated", { id: occurrenceId });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('❌ Error en DELETE /api/failure-occurrences/[id]/comments:', error);
    return NextResponse.json(
      { error: 'Error al eliminar comentario', detail: error.message },
      { status: 500 }
    );
  }
}
