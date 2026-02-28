import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/shared-helpers';

export const dynamic = 'force-dynamic';

/**
 * GET /api/mobile/my-day
 * Returns the technician's daily view with prioritized tasks
 */
export async function GET(request: Request) {
  const { error } = await requireAuth();
  if (error) return error;

  try {
    const { searchParams } = new URL(request.url);
    const userId = parseInt(searchParams.get('userId') || '0');
    const companyId = parseInt(searchParams.get('companyId') || '0');

    if (!userId || !companyId) {
      return NextResponse.json(
        { error: 'userId and companyId required' },
        { status: 400 }
      );
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get assigned work orders
    const workOrders = await prisma.workOrder.findMany({
      where: {
        companyId,
        assignedToId: userId,
        status: { in: ['PENDING', 'IN_PROGRESS', 'WAITING'] },
      },
      include: {
        machine: {
          select: { id: true, name: true, location: true },
        },
        failure: {
          select: { id: true, symptoms: true },
        },
      },
      orderBy: [
        { priority: 'asc' },
        { dueDate: 'asc' },
      ],
      take: 20,
    });

    // Get pending preventive maintenance checklists
    const checklists = await prisma.maintenanceChecklist.findMany({
      where: {
        companyId,
        isActive: true,
        nextDueDate: { lte: tomorrow },
        machine: {
          // Filter by machines the user can access
          isActive: true,
        },
      },
      include: {
        machine: {
          select: { id: true, name: true, location: true },
        },
      },
      orderBy: { nextDueDate: 'asc' },
      take: 10,
    });

    // Build tasks array
    const tasks = [
      ...workOrders.map(wo => ({
        type: 'WORK_ORDER' as const,
        id: wo.id,
        title: wo.title || `OT #${wo.id}`,
        priority: wo.priority || 'P3',
        machineId: wo.machineId,
        machineName: wo.machine?.name || 'Sin máquina',
        location: wo.machine?.location || '',
        status: wo.status,
        slaStatus: getSlaStatus(wo.dueDate, wo.completedAt),
        estimatedMinutes: (wo.estimatedHours || 1) * 60,
        dueDate: wo.dueDate?.toISOString(),
        createdAt: wo.createdAt.toISOString(),
      })),
      ...checklists.map(cl => ({
        type: 'PM' as const,
        id: cl.id,
        title: cl.name,
        priority: 'P3' as const,
        machineId: cl.machineId,
        machineName: cl.machine?.name || 'Sin máquina',
        location: cl.machine?.location || '',
        status: 'PENDING',
        slaStatus: getSlaStatus(cl.nextDueDate, null),
        estimatedMinutes: cl.estimatedDuration || 30,
        dueDate: cl.nextDueDate?.toISOString(),
        createdAt: cl.createdAt.toISOString(),
      })),
    ];

    // Sort by priority and SLA status
    tasks.sort((a, b) => {
      // P1 first
      const priorityOrder: Record<string, number> = { P1: 1, P2: 2, P3: 3, P4: 4 };
      const pa = priorityOrder[a.priority] || 3;
      const pb = priorityOrder[b.priority] || 3;
      if (pa !== pb) return pa - pb;

      // Then by SLA status
      const slaOrder: Record<string, number> = { BREACHED: 1, AT_RISK: 2, OK: 3 };
      const sa = slaOrder[a.slaStatus] || 3;
      const sb = slaOrder[b.slaStatus] || 3;
      return sa - sb;
    });

    // Calculate summary
    const summary = {
      totalTasks: tasks.length,
      workOrders: workOrders.length,
      preventiveMaintenance: checklists.length,
      atRisk: tasks.filter(t => t.slaStatus === 'AT_RISK').length,
      breached: tasks.filter(t => t.slaStatus === 'BREACHED').length,
      p1Count: tasks.filter(t => t.priority === 'P1').length,
      p2Count: tasks.filter(t => t.priority === 'P2').length,
    };

    return NextResponse.json({
      date: today.toISOString(),
      userId,
      tasks,
      summary,
    });
  } catch (error) {
    console.error('Error fetching my day:', error);
    return NextResponse.json(
      { error: 'Error fetching daily view' },
      { status: 500 }
    );
  }
}

function getSlaStatus(dueDate: Date | null, completedAt: Date | null): 'OK' | 'AT_RISK' | 'BREACHED' {
  if (!dueDate) return 'OK';
  if (completedAt) return 'OK';

  const now = new Date();
  const due = new Date(dueDate);
  const hoursUntilDue = (due.getTime() - now.getTime()) / (1000 * 60 * 60);

  if (hoursUntilDue < 0) return 'BREACHED';
  if (hoursUntilDue < 4) return 'AT_RISK';
  return 'OK';
}
