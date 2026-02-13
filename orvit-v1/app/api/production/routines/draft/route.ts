import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { JWT_SECRET } from '@/lib/auth';
import { validateRequest } from '@/lib/validations/helpers';
import { CreateRoutineDraftSchema, UpdateRoutineDraftSchema } from '@/lib/validations/production';

export const dynamic = 'force-dynamic';

const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

async function getUserFromToken() {
  const token = cookies().get('token')?.value;
  if (!token) throw new Error('No token provided');
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);
    return { userId: payload.userId as number, companyId: payload.companyId as number };
  } catch {
    throw new Error('Invalid token');
  }
}

// GET /api/production/routines/draft - Get active drafts (in progress routines)
export async function GET(request: Request) {
  try {
    const { companyId } = await getUserFromToken();
    const { searchParams } = new URL(request.url);
    const templateId = searchParams.get('templateId');
    const userId = searchParams.get('userId');

    const where: any = {
      companyId,
      status: 'DRAFT',
    };

    if (templateId) where.templateId = parseInt(templateId);
    if (userId) where.executedById = parseInt(userId);

    const drafts = await prisma.productionRoutine.findMany({
      where,
      include: {
        template: {
          select: {
            id: true, code: true, name: true, items: true,
            maxCompletionTimeMinutes: true, sectorId: true,
            enableCompletionReminders: true,
          }
        },
        executedBy: {
          select: { id: true, name: true }
        },
      },
      orderBy: { startedAt: 'desc' },
    });

    const now = Date.now();

    // Calculate progress for each draft
    const draftsWithProgress = drafts.map(draft => {
      const responses = (draft.responses as any[]) || [];
      const templateItems = draft.template.items as any;

      // Get total items count
      let totalItems = 0;
      if (templateItems && typeof templateItems === 'object') {
        if ('items' in templateItems && Array.isArray(templateItems.items)) {
          totalItems = templateItems.items.filter((i: any) => !i.disabled).length;
        } else if (Array.isArray(templateItems)) {
          totalItems = templateItems.filter((i: any) => !i.disabled).length;
        }
      }

      // Count completed items
      const completedItems = responses.filter(r => {
        if (!r.inputs || !Array.isArray(r.inputs)) return false;
        return r.inputs.some((inp: any) => inp.value !== null && inp.value !== '' && inp.value !== undefined);
      }).length;

      // Calcular tiempos
      const minutesSinceStarted = Math.round(
        (now - new Date(draft.startedAt).getTime()) / (1000 * 60)
      );
      const minutesSinceLastActivity = draft.updatedAt
        ? Math.round((now - new Date(draft.updatedAt).getTime()) / (1000 * 60))
        : minutesSinceStarted;
      const maxMinutes = draft.template.maxCompletionTimeMinutes || 60;
      const isOverdue = minutesSinceStarted > maxMinutes;

      return {
        ...draft,
        minutesSinceStarted,
        minutesSinceLastActivity,
        isOverdue,
        progress: {
          completed: completedItems,
          total: totalItems,
          percentage: totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0,
        }
      };
    });

    return NextResponse.json({ success: true, drafts: draftsWithProgress });
  } catch (error) {
    console.error('Error fetching drafts:', error);
    return NextResponse.json(
      { success: false, error: 'Error al obtener borradores' },
      { status: 500 }
    );
  }
}

// POST /api/production/routines/draft - Create or update a draft
export async function POST(request: Request) {
  try {
    const { userId, companyId } = await getUserFromToken();
    const body = await request.json();

    // If draftId exists, update existing draft; otherwise create new one
    if (body.draftId) {
      const updateValidation = validateRequest(UpdateRoutineDraftSchema, { id: body.draftId, ...body });
      if (!updateValidation.success) return updateValidation.response;

      const { id, responses } = updateValidation.data;

      const existing = await prisma.productionRoutine.findFirst({
        where: { id, companyId, status: 'DRAFT' },
      });

      if (!existing) {
        return NextResponse.json(
          { success: false, error: 'Borrador no encontrado' },
          { status: 404 }
        );
      }

      const updated = await prisma.productionRoutine.update({
        where: { id },
        data: {
          responses: responses || [],
        },
      });

      return NextResponse.json({ success: true, draft: updated });
    }

    // Create new draft
    const createValidation = validateRequest(CreateRoutineDraftSchema, body);
    if (!createValidation.success) return createValidation.response;

    const { templateId, responses } = createValidation.data;

    const draft = await prisma.productionRoutine.create({
      data: {
        templateId,
        date: new Date(),
        status: 'DRAFT',
        startedAt: new Date(),
        responses: responses || [],
        executedById: userId,
        companyId,
      },
    });

    return NextResponse.json({ success: true, draft });
  } catch (error) {
    console.error('Error saving draft:', error);
    return NextResponse.json(
      { success: false, error: 'Error al guardar borrador' },
      { status: 500 }
    );
  }
}

// DELETE /api/production/routines/draft - Delete a draft
export async function DELETE(request: Request) {
  try {
    const { companyId } = await getUserFromToken();
    const { searchParams } = new URL(request.url);
    const draftId = searchParams.get('id');

    if (!draftId) {
      return NextResponse.json(
        { success: false, error: 'id es requerido' },
        { status: 400 }
      );
    }

    const existing = await prisma.productionRoutine.findFirst({
      where: { id: parseInt(draftId), companyId, status: 'DRAFT' },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Borrador no encontrado' },
        { status: 404 }
      );
    }

    await prisma.productionRoutine.delete({
      where: { id: parseInt(draftId) },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting draft:', error);
    return NextResponse.json(
      { success: false, error: 'Error al eliminar borrador' },
      { status: 500 }
    );
  }
}
