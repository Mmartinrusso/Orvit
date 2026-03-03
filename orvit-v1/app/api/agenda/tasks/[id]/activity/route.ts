import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromToken } from '@/lib/tasks/auth-helper';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/agenda/tasks/[id]/activity — Historial de actividad de una tarea
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = await params;
    const taskId = parseInt(id);
    if (isNaN(taskId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    // Verificar acceso a la tarea
    const task = await prisma.agendaTask.findUnique({
      where: { id: taskId },
      select: { createdById: true, assignedToUserId: true, isCompanyVisible: true, companyId: true },
    });

    if (!task) {
      return NextResponse.json({ error: 'Tarea no encontrada' }, { status: 404 });
    }

    const userCompanyIds = [
      ...(user.ownedCompanies ?? []).map((c: any) => c.id),
      ...(user.companies ?? []).map((c: any) => c.companyId),
    ];
    const canAccess =
      task.createdById === user.id ||
      task.assignedToUserId === user.id ||
      task.isCompanyVisible ||
      userCompanyIds.includes(task.companyId);

    if (!canAccess) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    // Obtener eventos de actividad
    const events = await prisma.activityEvent.findMany({
      where: {
        entityType: 'AGENDA_TASK',
        entityId: taskId,
        companyId: task.companyId,
      },
      include: {
        performedBy: {
          select: { id: true, name: true, avatar: true },
        },
      },
      orderBy: { occurredAt: 'desc' },
      take: 50,
    });

    return NextResponse.json(
      events.map((e) => ({
        id: e.id,
        eventType: e.eventType,
        description: e.description,
        previousValue: e.previousValue,
        newValue: e.newValue,
        metadata: e.metadata,
        performedBy: e.performedBy,
        occurredAt: e.occurredAt.toISOString(),
      }))
    );
  } catch (error) {
    console.error('[API] Error fetching task activity:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
