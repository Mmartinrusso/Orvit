import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth/shared-helpers';
import { PRODUCCION_PERMISSIONS } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

// GET /api/production/dashboard/employee - All-in-one employee dashboard data
export async function GET(request: Request) {
  try {
    const { user, error } = await requirePermission(PRODUCCION_PERMISSIONS.DASHBOARD_VIEW);
    if (error) return error;
    const userId = user!.id;
    const companyId = user!.companyId;
    const { searchParams } = new URL(request.url);

    const sectorId = searchParams.get('sectorId');

    if (!sectorId) {
      return NextResponse.json(
        { success: false, error: 'sectorId es requerido' },
        { status: 400 }
      );
    }

    const parsedSectorId = parseInt(sectorId);

    // Today's date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // --- ROUTINES ---
    const [templates, completedToday, draftsInProgress] = await Promise.all([
      prisma.productionRoutineTemplate.findMany({
        where: { companyId, sectorId: parsedSectorId, isActive: true },
        select: {
          id: true, code: true, name: true, type: true, frequency: true,
          items: true, maxCompletionTimeMinutes: true,
          workCenter: { select: { id: true, name: true } },
        },
      }),
      prisma.productionRoutine.findMany({
        where: { companyId, executedById: userId, status: 'COMPLETED', date: { gte: today, lt: tomorrow } },
        select: { templateId: true, executedAt: true },
      }),
      prisma.productionRoutine.findMany({
        where: { companyId, executedById: userId, status: 'DRAFT' },
        select: { id: true, templateId: true, startedAt: true, responses: true },
      }),
    ]);

    const completedTemplateIds = new Set(completedToday.map(c => c.templateId));
    const draftsByTemplate = new Map(draftsInProgress.map(d => [d.templateId, d]));
    const now = Date.now();

    const routines = templates.map(template => {
      const isCompleted = completedTemplateIds.has(template.id);
      const draft = draftsByTemplate.get(template.id);

      const itemsData = template.items as any;
      let totalItems = 0;
      if (itemsData && typeof itemsData === 'object') {
        const items = 'items' in itemsData && Array.isArray(itemsData.items)
          ? itemsData.items : Array.isArray(itemsData) ? itemsData : [];
        totalItems = items.filter((i: any) => !i.disabled).length;
      }

      let status: 'COMPLETED' | 'IN_PROGRESS' | 'PENDING' = 'PENDING';
      let draftId: number | null = null;
      let progress = { completed: 0, total: totalItems, percentage: 0 };

      if (isCompleted) {
        status = 'COMPLETED';
        progress = { completed: totalItems, total: totalItems, percentage: 100 };
      } else if (draft) {
        status = 'IN_PROGRESS';
        draftId = draft.id;
        const responses = (draft.responses as any[]) || [];
        const completedItems = responses.filter(r =>
          r.inputs?.some((inp: any) => inp.value !== null && inp.value !== '' && inp.value !== undefined)
        ).length;
        progress = {
          completed: completedItems, total: totalItems,
          percentage: totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0,
        };
      }

      return {
        templateId: template.id, code: template.code, name: template.name,
        type: template.type, workCenter: template.workCenter,
        status, draftId, progress,
      };
    });

    const statusOrder: Record<string, number> = { IN_PROGRESS: 0, PENDING: 1, COMPLETED: 2 };
    routines.sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);

    const routineSummary = {
      total: routines.length,
      completed: routines.filter(r => r.status === 'COMPLETED').length,
      inProgress: routines.filter(r => r.status === 'IN_PROGRESS').length,
      pending: routines.filter(r => r.status === 'PENDING').length,
    };

    // --- PRODUCTION TODAY ---
    const todayDate = new Date(today);
    const productionSession = await prisma.dailyProductionSession.findFirst({
      where: {
        companyId,
        sectorId: parsedSectorId,
        productionDate: todayDate,
      },
      include: {
        entries: {
          select: { quantity: true, scrapQuantity: true, productId: true },
        },
      },
    });

    const productionSummary = {
      hasSession: !!productionSession,
      sessionId: productionSession?.id || null,
      sessionStatus: productionSession?.status || null,
      totalQuantity: productionSession?.entries.reduce((s, e) => s + Number(e.quantity), 0) || 0,
      totalScrap: productionSession?.entries.reduce((s, e) => s + Number(e.scrapQuantity), 0) || 0,
      productsLoaded: productionSession?.entries.length || 0,
    };

    // --- RECENT ACTIVITY ---
    const recentActivity = await prisma.productionRoutine.findMany({
      where: { companyId, executedById: userId },
      select: {
        id: true, status: true, executedAt: true, startedAt: true,
        template: { select: { name: true, type: true } },
      },
      orderBy: { executedAt: 'desc' },
      take: 5,
    });

    // --- SHIFTS ---
    const shifts = await prisma.workShift.findMany({
      where: { companyId, isActive: true },
      select: { id: true, name: true, code: true, type: true, startTime: true, endTime: true },
      orderBy: { startTime: 'asc' },
    });

    // Detect current shift
    const currentTime = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
    const currentShift = shifts.find(s => {
      if (s.startTime <= s.endTime) {
        return currentTime >= s.startTime && currentTime < s.endTime;
      }
      return currentTime >= s.startTime || currentTime < s.endTime;
    });

    return NextResponse.json({
      success: true,
      routines,
      routineSummary,
      productionSummary,
      recentActivity,
      shifts,
      currentShift: currentShift || null,
    });
  } catch (error) {
    console.error('Error fetching employee dashboard:', error);
    return NextResponse.json(
      { success: false, error: 'Error al obtener datos del dashboard' },
      { status: 500 }
    );
  }
}
