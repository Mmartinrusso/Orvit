import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth/shared-helpers';
import { PRODUCCION_PERMISSIONS } from '@/lib/permissions';
import { validateRequest } from '@/lib/validations/helpers';
import { UpdateDailySessionSchema } from '@/lib/validations/daily-sessions';

export const dynamic = 'force-dynamic';

const VALID_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['SUBMITTED'],
  SUBMITTED: ['APPROVED', 'DRAFT'], // Can reject back to DRAFT
  APPROVED: ['LOCKED'],
};

// PUT /api/production/daily-sessions/[id] - Update session (status transitions, notes)
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await requirePermission(PRODUCCION_PERMISSIONS.PARTES.EDIT);
    if (error) return error;
    const companyId = user!.companyId;
    const userId = user!.id;
    const id = parseInt(params.id);
    const body = await request.json();

    const validation = validateRequest(UpdateDailySessionSchema, body);
    if (!validation.success) return validation.response;

    const existing = await prisma.dailyProductionSession.findFirst({
      where: { id, companyId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Sesión no encontrada' },
        { status: 404 }
      );
    }

    const data: any = {};
    const validatedBody = validation.data;

    // Handle status transitions
    if (validatedBody.status && validatedBody.status !== existing.status) {
      const allowed = VALID_TRANSITIONS[existing.status] || [];
      if (!allowed.includes(validatedBody.status)) {
        return NextResponse.json(
          { success: false, error: `No se puede pasar de ${existing.status} a ${validatedBody.status}` },
          { status: 400 }
        );
      }

      data.status = validatedBody.status;

      if (validatedBody.status === 'SUBMITTED') {
        data.submittedAt = new Date();
        data.submittedById = userId;
      } else if (validatedBody.status === 'APPROVED') {
        data.approvedAt = new Date();
        data.approvedById = userId;
      } else if (validatedBody.status === 'LOCKED') {
        data.lockedAt = new Date();
      }
    }

    if (validatedBody.notes !== undefined) {
      data.notes = validatedBody.notes;
    }

    const session = await prisma.dailyProductionSession.update({
      where: { id },
      data,
      include: {
        sector: { select: { id: true, name: true } },
        shift: { select: { id: true, name: true, code: true } },
        submittedBy: { select: { id: true, name: true } },
        approvedBy: { select: { id: true, name: true } },
        entries: {
          include: {
            product: {
              select: {
                id: true, name: true, code: true, unit: true,
                recipeId: true,
                recipe: { select: { id: true, name: true } },
              },
            },
            registeredBy: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    return NextResponse.json({ success: true, session });
  } catch (error) {
    console.error('Error updating daily production session:', error);
    return NextResponse.json(
      { success: false, error: 'Error al actualizar sesión' },
      { status: 500 }
    );
  }
}
