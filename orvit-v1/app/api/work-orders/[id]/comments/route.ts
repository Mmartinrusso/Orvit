import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withGuards } from '@/lib/middleware/withGuards';
import { validateRequest } from '@/lib/validations/helpers';
import { CreateWorkOrderCommentSchema } from '@/lib/validations/work-orders';

// GET /api/work-orders/[id]/comments
export const GET = withGuards(async (request: NextRequest, { user, params: _p }, routeContext) => {
  const { params } = routeContext!;
  try {
    const { id } = params;

    if (!id || isNaN(Number(id))) {
      return NextResponse.json({ error: 'ID de orden de trabajo inválido' }, { status: 400 });
    }

    // Verificar que la orden existe
    const workOrder = await prisma.workOrder.findUnique({
      where: { id: Number(id) },
    });

    if (!workOrder) {
      return NextResponse.json({ error: 'Orden de trabajo no encontrada' }, { status: 404 });
    }

    // Obtener comentarios de la base de datos
    const comments = await prisma.workOrderComment.findMany({
      where: { workOrderId: Number(id) },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc', // Más recientes primero
      },
    });

    // Formatear comentarios para el frontend
    const formattedComments = comments.map((comment) => ({
      id: comment.id,
      content: comment.content,
      type: comment.type || 'comment',
      author: comment.author
        ? {
            id: comment.author.id,
            name: comment.author.name,
            email: comment.author.email,
          }
        : {
            id: 0,
            name: 'Sistema',
            email: 'system@empresa.com',
          },
      createdAt: comment.createdAt,
      workOrderId: comment.workOrderId,
    }));

    return NextResponse.json(formattedComments);
  } catch (error) {
    console.error('Error en GET /api/work-orders/[id]/comments:', error);
    return NextResponse.json({ error: 'Error al obtener comentarios' }, { status: 500 });
  }
}, { requiredPermissions: ['work_orders.view'], permissionMode: 'any' });

// POST /api/work-orders/[id]/comments
export const POST = withGuards(async (request: NextRequest, { user, params: _p }, routeContext) => {
  const { params } = routeContext!;
  try {
    const { id } = params;
    const body = await request.json();

    if (!id || isNaN(Number(id))) {
      return NextResponse.json({ error: 'ID de orden de trabajo inválido' }, { status: 400 });
    }

    const { type = 'comment' } = body;
    const validation = validateRequest(CreateWorkOrderCommentSchema, body);
    if (!validation.success) return validation.response;

    const { content, authorId } = validation.data;

    // Verificar que la orden existe
    const workOrder = await prisma.workOrder.findUnique({
      where: { id: Number(id) },
    });

    if (!workOrder) {
      return NextResponse.json({ error: 'Orden de trabajo no encontrada' }, { status: 404 });
    }

    // Verificar que el autor existe
    const author = await prisma.user.findUnique({
      where: { id: Number(authorId) },
      select: { id: true, name: true, email: true },
    });

    if (!author) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    // Crear el comentario en la base de datos
    const newComment = await prisma.workOrderComment.create({
      data: {
        content: content.trim(),
        type: type || 'comment',
        workOrderId: Number(id),
        authorId: Number(authorId),
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

    // @Mentions: notificar a usuarios mencionados (fire-and-forget)
    const mentionMatches = content.match(/@([\w\s]+?)(?=\s|$|[^a-záéíóúüñ\s])/gi);
    if (mentionMatches && mentionMatches.length > 0) {
      const mentionedNames = [...new Set(mentionMatches.map(m => m.slice(1).trim()))];
      prisma.user.findMany({
        where: {
          name: { in: mentionedNames, mode: 'insensitive' },
          companies: { some: { companyId: workOrder.companyId } },
          id: { not: Number(authorId) },
        },
        select: { id: true },
      }).then(mentionedUsers =>
        Promise.all(mentionedUsers.map(u =>
          prisma.notification.create({
            data: {
              type: 'task_commented',
              title: 'Te mencionaron en un comentario',
              message: `${author.name} te mencionó en la OT #${id}: "${content.slice(0, 100)}${content.length > 100 ? '…' : ''}"`,
              userId: u.id,
              companyId: workOrder.companyId,
              priority: 'MEDIUM',
              metadata: { workOrderId: Number(id), commentId: newComment.id, authorId: Number(authorId) },
            }
          })
        ))
      ).catch(() => {});
    }

    // Formatear respuesta para el frontend
    const formattedComment = {
      id: newComment.id,
      content: newComment.content,
      type: newComment.type || 'comment',
      author: {
        id: newComment.author?.id || 0,
        name: newComment.author?.name || 'Sistema',
        email: newComment.author?.email || 'system@empresa.com',
      },
      createdAt: newComment.createdAt,
      workOrderId: newComment.workOrderId,
    };

    return NextResponse.json(formattedComment, { status: 201 });
  } catch (error) {
    console.error('Error en POST /api/work-orders/[id]/comments:', error);
    return NextResponse.json({ error: 'Error al crear comentario' }, { status: 500 });
  }
}, { requiredPermissions: ['work_orders.view'], permissionMode: 'any' });
