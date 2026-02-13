/**
 * API: /api/ideas/[id]
 *
 * GET - Obtener detalle de idea
 * PUT - Actualizar idea
 * DELETE - Eliminar idea
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
 * GET /api/ideas/[id]
 * Obtener detalle de una idea
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
    const userId = payload.userId as number;
    const ideaId = parseInt(id);

    if (isNaN(ideaId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const idea = await prisma.idea.findFirst({
      where: {
        id: ideaId,
        companyId
      },
      include: {
        machine: {
          select: { id: true, name: true }
        },
        component: {
          select: { id: true, name: true }
        },
        failureOccurrence: {
          select: { id: true, title: true, status: true }
        },
        workOrder: {
          select: { id: true, title: true, status: true }
        },
        createdBy: {
          select: { id: true, name: true, email: true, avatar: true }
        },
        reviewedBy: {
          select: { id: true, name: true }
        },
        implementedBy: {
          select: { id: true, name: true }
        },
        comments: {
          include: {
            user: {
              select: { id: true, name: true, avatar: true }
            }
          },
          orderBy: { createdAt: 'desc' }
        },
        votes: {
          include: {
            user: {
              select: { id: true, name: true }
            }
          }
        }
      }
    });

    if (!idea) {
      return NextResponse.json(
        { error: 'Idea no encontrada' },
        { status: 404 }
      );
    }

    // Add computed fields
    const response = {
      ...idea,
      voteCount: idea.votes.length,
      hasVoted: idea.votes.some(v => v.userId === userId)
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error en GET /api/ideas/[id]:', error);
    return NextResponse.json(
      { error: 'Error al obtener idea' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/ideas/[id]
 * Actualizar idea
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
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

    // Verify idea exists and belongs to company
    const existingIdea = await prisma.idea.findFirst({
      where: { id: ideaId, companyId }
    });

    if (!existingIdea) {
      return NextResponse.json(
        { error: 'Idea no encontrada' },
        { status: 404 }
      );
    }

    // Only creator or admin can edit (simple check)
    if (existingIdea.createdById !== userId) {
      // TODO: Add admin role check
    }

    const body = await request.json();
    const {
      title,
      description,
      category,
      priority,
      tags,
      attachments
    } = body;

    // Build update data
    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (category !== undefined) updateData.category = category;
    if (priority !== undefined) updateData.priority = priority;
    if (tags !== undefined) updateData.tags = tags;
    if (attachments !== undefined) updateData.attachments = attachments;

    const updatedIdea = await prisma.idea.update({
      where: { id: ideaId },
      data: updateData,
      include: {
        machine: {
          select: { id: true, name: true }
        },
        createdBy: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    return NextResponse.json(updatedIdea);
  } catch (error) {
    console.error('Error en PUT /api/ideas/[id]:', error);
    return NextResponse.json(
      { error: 'Error al actualizar idea' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/ideas/[id]
 * Eliminar idea
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
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

    // Verify idea exists and belongs to company
    const existingIdea = await prisma.idea.findFirst({
      where: { id: ideaId, companyId }
    });

    if (!existingIdea) {
      return NextResponse.json(
        { error: 'Idea no encontrada' },
        { status: 404 }
      );
    }

    // Only creator or admin can delete
    if (existingIdea.createdById !== userId) {
      // TODO: Add admin role check
      return NextResponse.json(
        { error: 'No tienes permisos para eliminar esta idea' },
        { status: 403 }
      );
    }

    await prisma.idea.delete({
      where: { id: ideaId }
    });

    return NextResponse.json({ success: true, message: 'Idea eliminada' });
  } catch (error) {
    console.error('Error en DELETE /api/ideas/[id]:', error);
    return NextResponse.json(
      { error: 'Error al eliminar idea' },
      { status: 500 }
    );
  }
}
