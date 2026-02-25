/**
 * API: /api/ideas/[id]/comment
 *
 * GET - Listar comentarios
 * POST - Agregar comentario
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/ideas/[id]/comment
 * Listar comentarios de una idea
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
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
    const ideaId = parseInt(id);

    if (isNaN(ideaId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    // Verify idea exists and belongs to company
    const idea = await prisma.idea.findFirst({
      where: { id: ideaId, companyId },
      select: { id: true }
    });

    if (!idea) {
      return NextResponse.json(
        { error: 'Idea no encontrada' },
        { status: 404 }
      );
    }

    const comments = await prisma.ideaComment.findMany({
      where: { ideaId },
      include: {
        user: {
          select: { id: true, name: true, avatar: true }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    return NextResponse.json(comments);
  } catch (error) {
    console.error('Error en GET /api/ideas/[id]/comment:', error);
    return NextResponse.json(
      { error: 'Error al obtener comentarios' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/ideas/[id]/comment
 * Agregar comentario a una idea
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
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
    const ideaId = parseInt(id);

    if (isNaN(ideaId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const body = await request.json();
    const { content } = body;

    if (!content || content.trim().length === 0) {
      return NextResponse.json(
        { error: 'El contenido es requerido' },
        { status: 400 }
      );
    }

    if (content.trim().length > 2000) {
      return NextResponse.json(
        { error: 'El comentario no puede superar los 2000 caracteres' },
        { status: 400 }
      );
    }

    // Verify idea exists and belongs to company
    const idea = await prisma.idea.findFirst({
      where: { id: ideaId, companyId },
      select: { id: true }
    });

    if (!idea) {
      return NextResponse.json(
        { error: 'Idea no encontrada' },
        { status: 404 }
      );
    }

    const comment = await prisma.ideaComment.create({
      data: {
        ideaId,
        userId,
        content: content.trim()
      },
      include: {
        user: {
          select: { id: true, name: true, avatar: true }
        }
      }
    });

    return NextResponse.json(comment, { status: 201 });
  } catch (error) {
    console.error('Error en POST /api/ideas/[id]/comment:', error);
    return NextResponse.json(
      { error: 'Error al agregar comentario' },
      { status: 500 }
    );
  }
}
