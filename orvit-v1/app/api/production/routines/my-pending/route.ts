import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { JWT_SECRET } from '@/lib/auth';

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

// GET /api/production/routines/my-pending - Get pending routines for current employee
export async function GET(request: Request) {
  try {
    const { userId, companyId } = await getUserFromToken();
    const { searchParams } = new URL(request.url);

    const sectorId = searchParams.get('sectorId');

    if (!sectorId) {
      return NextResponse.json(
        { success: false, error: 'sectorId es requerido' },
        { status: 400 }
      );
    }

    const parsedSectorId = parseInt(sectorId);

    // Get active templates for this sector
    const templates = await prisma.productionRoutineTemplate.findMany({
      where: {
        companyId,
        sectorId: parsedSectorId,
        isActive: true,
      },
      select: {
        id: true,
        code: true,
        name: true,
        type: true,
        frequency: true,
        items: true,
        maxCompletionTimeMinutes: true,
        workCenter: { select: { id: true, name: true, code: true } },
      },
      orderBy: { name: 'asc' },
    });

    // Get today's date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get today's completed executions for this user
    const completedToday = await prisma.productionRoutine.findMany({
      where: {
        companyId,
        executedById: userId,
        status: 'COMPLETED',
        date: { gte: today, lt: tomorrow },
      },
      select: {
        templateId: true,
        executedAt: true,
      },
    });

    // Get active drafts for this user
    const draftsInProgress = await prisma.productionRoutine.findMany({
      where: {
        companyId,
        executedById: userId,
        status: 'DRAFT',
      },
      select: {
        id: true,
        templateId: true,
        startedAt: true,
        updatedAt: true,
        responses: true,
      },
    });

    const completedTemplateIds = new Set(completedToday.map(c => c.templateId));
    const draftsByTemplate = new Map(draftsInProgress.map(d => [d.templateId, d]));

    const now = Date.now();

    // Build status for each template
    const routines = templates.map(template => {
      const isCompleted = completedTemplateIds.has(template.id);
      const draft = draftsByTemplate.get(template.id);

      // Calculate total items for progress
      const itemsData = template.items as any;
      let totalItems = 0;
      if (itemsData && typeof itemsData === 'object') {
        const items = 'items' in itemsData && Array.isArray(itemsData.items)
          ? itemsData.items
          : Array.isArray(itemsData) ? itemsData : [];
        totalItems = items.filter((i: any) => !i.disabled).length;
      }

      let status: 'COMPLETED' | 'IN_PROGRESS' | 'PENDING' = 'PENDING';
      let draftId: number | null = null;
      let progress = { completed: 0, total: totalItems, percentage: 0 };
      let minutesSinceStarted: number | null = null;
      let isOverdue = false;

      if (isCompleted) {
        status = 'COMPLETED';
        progress = { completed: totalItems, total: totalItems, percentage: 100 };
      } else if (draft) {
        status = 'IN_PROGRESS';
        draftId = draft.id;

        // Calculate progress
        const responses = (draft.responses as any[]) || [];
        const completedItems = responses.filter(r => {
          if (!r.inputs || !Array.isArray(r.inputs)) return false;
          return r.inputs.some((inp: any) => inp.value !== null && inp.value !== '' && inp.value !== undefined);
        }).length;
        progress = {
          completed: completedItems,
          total: totalItems,
          percentage: totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0,
        };

        minutesSinceStarted = Math.round((now - new Date(draft.startedAt).getTime()) / (1000 * 60));
        if (template.maxCompletionTimeMinutes) {
          isOverdue = minutesSinceStarted > template.maxCompletionTimeMinutes;
        }
      }

      return {
        templateId: template.id,
        code: template.code,
        name: template.name,
        type: template.type,
        frequency: template.frequency,
        workCenter: template.workCenter,
        maxCompletionTimeMinutes: template.maxCompletionTimeMinutes,
        status,
        draftId,
        progress,
        minutesSinceStarted,
        isOverdue,
      };
    });

    // Sort: IN_PROGRESS first, PENDING second, COMPLETED last
    const statusOrder = { IN_PROGRESS: 0, PENDING: 1, COMPLETED: 2 };
    routines.sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);

    const summary = {
      total: routines.length,
      completed: routines.filter(r => r.status === 'COMPLETED').length,
      inProgress: routines.filter(r => r.status === 'IN_PROGRESS').length,
      pending: routines.filter(r => r.status === 'PENDING').length,
    };

    return NextResponse.json({ success: true, routines, summary });
  } catch (error) {
    console.error('Error fetching pending routines:', error);
    return NextResponse.json(
      { success: false, error: 'Error al obtener rutinas pendientes' },
      { status: 500 }
    );
  }
}
