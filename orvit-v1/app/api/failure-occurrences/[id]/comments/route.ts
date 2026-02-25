/**
 * API: /api/failure-occurrences/[id]/comments
 *
 * GET - Lista de comentarios de una falla (via WorkOrder asociado)
 * POST - Crear nuevo comentario
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

/**
 * Schema para crear comentario
 */
const createCommentSchema = z.object({
  content: z.string().min(1, 'El comentario no puede estar vacío').max(2000),
  type: z.enum(['comment', 'update', 'issue']).optional().default('comment'),
  mentions: z.array(z.number().int().positive()).optional(), // IDs de usuarios mencionados
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
    // 1. Verificar autenticación
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

    // 2. Obtener la falla para conseguir el workOrderId
    const occurrence = await prisma.failureOccurrence.findFirst({
      where: {
        id: occurrenceId,
        companyId,
      },
      select: {
        id: true,
        failureId: true, // Este es el workOrderId
      },
    });

    if (!occurrence) {
      return NextResponse.json(
        { error: 'Falla no encontrada' },
        { status: 404 }
      );
    }

    // 3. Obtener comentarios del WorkOrder asociado
    const comments = await prisma.workOrderComment.findMany({
      where: {
        workOrderId: occurrence.failureId,
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
      orderBy: {
        createdAt: 'asc',
      },
    });

    // 4. Transformar respuesta
    const transformedComments = comments.map((comment) => ({
      id: comment.id,
      content: comment.content,
      type: comment.type,
      createdAt: comment.createdAt,
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
    // Si es error de columna/tabla no existente, retornar vacío
    if (error?.code === 'P2010' || error?.code === 'P2022' || error?.message?.includes('column') || error?.message?.includes('does not exist') || error?.message?.includes('relation')) {
      console.warn('⚠️ Columnas de failure_occurrences faltan. Ejecutar: npx prisma db push');
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
    // 1. Verificar autenticación
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

    // 2. Parsear y validar body
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

    // 3. Obtener la falla para conseguir el workOrderId
    const occurrence = await prisma.failureOccurrence.findFirst({
      where: {
        id: occurrenceId,
        companyId,
      },
      select: {
        id: true,
        failureId: true, // Este es el workOrderId
        title: true,
      },
    });

    if (!occurrence) {
      return NextResponse.json(
        { error: 'Falla no encontrada' },
        { status: 404 }
      );
    }

    // 4. Crear comentario en el WorkOrder asociado
    const comment = await prisma.workOrderComment.create({
      data: {
        workOrderId: occurrence.failureId,
        content: data.content,
        type: data.type,
        authorId: userId,
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

    // 5. Si hay menciones, crear notificaciones para cada usuario mencionado
    if (data.mentions && data.mentions.length > 0) {
      const authorName = comment.author?.name || 'Alguien';
      const mentionNotifications = data.mentions
        .filter((mentionedUserId: number) => mentionedUserId !== userId) // No notificar al autor
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

      // Fire-and-forget
      Promise.all(mentionNotifications).catch(() => {});
    }

    console.log(`💬 Comentario creado en falla ${occurrenceId}:`, comment.id);

    return NextResponse.json(
      {
        data: {
          id: comment.id,
          content: comment.content,
          type: comment.type,
          createdAt: comment.createdAt,
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
