/**
 * API: /api/ideas/[id]/status
 *
 * PUT - Cambiar estado de idea (supervisores/admin)
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
 * PUT /api/ideas/[id]/status
 * Cambiar estado de una idea
 *
 * Body:
 * - status: new status
 * - reviewNotes: notes for review
 * - implementationNotes: notes for implementation
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

    // Only admin roles can change idea status
    const actor = await prisma.user.findUnique({
      where: { id: userId },
      select: { systemRole: true },
    });
    const adminRoles = ['ADMIN', 'SUPERADMIN', 'ADMIN_ENTERPRISE'];
    if (!actor || !adminRoles.includes(actor.systemRole ?? '')) {
      return NextResponse.json(
        { error: 'Sin permisos para cambiar el estado de ideas' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { status, reviewNotes, implementationNotes } = body;

    // Valid statuses
    const validStatuses = [
      'NEW',
      'UNDER_REVIEW',
      'APPROVED',
      'IN_PROGRESS',
      'IMPLEMENTED',
      'REJECTED',
      'ARCHIVED'
    ];

    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Estado inválido. Válidos: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
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

    // Build update data based on new status
    const updateData: any = { status };

    // Update reviewer info when entering review
    if (status === 'UNDER_REVIEW' || status === 'APPROVED' || status === 'REJECTED') {
      updateData.reviewedById = userId;
      updateData.reviewedAt = new Date();
      if (reviewNotes) {
        updateData.reviewNotes = reviewNotes;
      }
    }

    // Update implementer info when implemented
    if (status === 'IMPLEMENTED') {
      updateData.implementedById = userId;
      updateData.implementedAt = new Date();
      if (implementationNotes) {
        updateData.implementationNotes = implementationNotes;
      }
    }

    const updatedIdea = await prisma.idea.update({
      where: { id: ideaId },
      data: updateData,
      include: {
        machine: {
          select: { id: true, name: true }
        },
        createdBy: {
          select: { id: true, name: true, email: true }
        },
        reviewedBy: {
          select: { id: true, name: true }
        },
        implementedBy: {
          select: { id: true, name: true }
        }
      }
    });

    // Notify creator about status change
    try {
      if (existingIdea.createdById !== userId) {
        await prisma.notification.create({
          data: {
            userId: existingIdea.createdById,
            companyId,
            title: `Estado de idea actualizado`,
            message: `Tu idea "${existingIdea.title}" cambió a: ${status}`,
            type: 'SYSTEM',
            link: `/mantenimiento/ideas?ideaId=${ideaId}`
          }
        });
      }
    } catch (notifyError) {
      console.error('Error notifying creator:', notifyError);
    }

    return NextResponse.json(updatedIdea);
  } catch (error) {
    console.error('Error en PUT /api/ideas/[id]/status:', error);
    return NextResponse.json(
      { error: 'Error al cambiar estado' },
      { status: 500 }
    );
  }
}
