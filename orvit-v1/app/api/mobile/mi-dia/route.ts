// API Route for Mobile "Mi Día" View
// GET /api/mobile/mi-dia - Get today's tasks, work orders, and alerts for the current user

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { startOfDay, endOfDay, addDays, isSameDay } from 'date-fns';

export const dynamic = 'force-dynamic';

interface DayTask {
  id: number;
  type: 'task' | 'fixed_task' | 'work_order' | 'checklist';
  title: string;
  description?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: string;
  scheduledTime?: string;
  dueDate?: string;
  machine?: {
    id: number;
    name: string;
  };
  estimatedDuration?: number;
  progress?: number;
  requiresLOTO?: boolean;
  requiresPTW?: boolean;
  skillWarnings?: string[];
}

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const dateStr = searchParams.get('date');
    const companyId = payload.companyId;
    const userId = payload.userId;

    // Target date (today by default)
    const targetDate = dateStr ? new Date(dateStr) : new Date();
    const dayStart = startOfDay(targetDate);
    const dayEnd = endOfDay(targetDate);
    const isToday = isSameDay(targetDate, new Date());

    const tasks: DayTask[] = [];

    // 1. Get fixed tasks scheduled for today (based on day of week or date)
    const dayOfWeek = targetDate.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();

    const fixedTasks = await prisma.fixedTask.findMany({
      where: {
        companyId: Number(companyId),
        isActive: true,
        OR: [
          { assignedToId: userId },
          { assignedToId: null }, // Unassigned tasks visible to all
        ],
        // Check if scheduled for this day
        OR: [
          { frequency: 'DAILY' },
          {
            frequency: 'WEEKLY',
            scheduledDays: { has: dayOfWeek },
          },
          {
            frequency: 'MONTHLY',
            scheduledDay: targetDate.getDate(),
          },
        ],
      },
      include: {
        machine: {
          select: { id: true, name: true },
        },
      },
    });

    for (const ft of fixedTasks) {
      tasks.push({
        id: ft.id,
        type: 'fixed_task',
        title: ft.name,
        description: ft.description || undefined,
        priority: (ft.priority?.toLowerCase() || 'medium') as DayTask['priority'],
        status: 'pending',
        scheduledTime: ft.scheduledTime || undefined,
        machine: ft.machine ? { id: ft.machine.id, name: ft.machine.name } : undefined,
        estimatedDuration: ft.estimatedDuration || undefined,
      });
    }

    // 2. Get regular tasks assigned to user for today
    const regularTasks = await prisma.task.findMany({
      where: {
        companyId: Number(companyId),
        assignedToId: userId,
        status: { in: ['pending', 'in_progress'] },
        OR: [
          { scheduledDate: { gte: dayStart, lte: dayEnd } },
          { dueDate: { gte: dayStart, lte: dayEnd } },
        ],
      },
      include: {
        machine: {
          select: { id: true, name: true },
        },
      },
    });

    for (const t of regularTasks) {
      tasks.push({
        id: t.id,
        type: 'task',
        title: t.name,
        description: t.description || undefined,
        priority: (t.priority?.toLowerCase() || 'medium') as DayTask['priority'],
        status: t.status,
        dueDate: t.dueDate?.toISOString(),
        machine: t.machine ? { id: t.machine.id, name: t.machine.name } : undefined,
      });
    }

    // 3. Get work orders assigned to user
    const workOrders = await prisma.workOrder.findMany({
      where: {
        companyId: Number(companyId),
        OR: [
          { assignedToId: userId },
          { createdById: userId },
        ],
        status: { in: ['pending', 'in_progress', 'approved'] },
        OR: [
          { startDate: { gte: dayStart, lte: dayEnd } },
          { dueDate: { gte: dayStart, lte: dayEnd } },
          {
            status: 'in_progress',
            startDate: { lte: dayEnd },
          },
        ],
      },
      include: {
        machine: {
          select: { id: true, name: true },
        },
        checklist: {
          select: { id: true, name: true },
        },
      },
    });

    for (const wo of workOrders) {
      tasks.push({
        id: wo.id,
        type: 'work_order',
        title: wo.title,
        description: wo.description || undefined,
        priority: (wo.priority?.toLowerCase() || 'medium') as DayTask['priority'],
        status: wo.status,
        dueDate: wo.dueDate?.toISOString(),
        machine: wo.machine ? { id: wo.machine.id, name: wo.machine.name } : undefined,
        requiresLOTO: wo.lotoRequired || false,
        requiresPTW: wo.ptwRequired || false,
        progress: wo.progress || 0,
      });
    }

    // 4. Get active LOTO executions for user
    const activeLOTOs = await prisma.lOTOExecution.findMany({
      where: {
        lockedById: userId,
        status: 'LOCKED',
      },
      include: {
        procedure: {
          include: {
            machine: {
              select: { id: true, name: true },
            },
          },
        },
        workOrder: {
          select: { id: true, title: true },
        },
      },
    });

    // 5. Get active PTW permits for user
    const activePTWs = await prisma.permitToWork.findMany({
      where: {
        companyId: Number(companyId),
        requestedById: userId,
        status: 'ACTIVE',
      },
      include: {
        machine: {
          select: { id: true, name: true },
        },
      },
    });

    // 6. Get upcoming tasks (next 2 days)
    const upcomingStart = addDays(dayEnd, 1);
    const upcomingEnd = addDays(dayEnd, 2);

    const upcomingTasks = await prisma.task.findMany({
      where: {
        companyId: Number(companyId),
        assignedToId: userId,
        status: 'pending',
        dueDate: { gte: upcomingStart, lte: upcomingEnd },
      },
      select: {
        id: true,
        name: true,
        dueDate: true,
        priority: true,
      },
      take: 5,
    });

    // Calculate summary
    const summary = {
      totalTasks: tasks.length,
      completed: tasks.filter(t => t.status === 'completed').length,
      inProgress: tasks.filter(t => t.status === 'in_progress').length,
      pending: tasks.filter(t => t.status === 'pending' || t.status === 'approved').length,
      highPriority: tasks.filter(t => t.priority === 'high' || t.priority === 'urgent').length,
      activeLOTOs: activeLOTOs.length,
      activePTWs: activePTWs.length,
    };

    // Sort tasks by priority and status
    const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
    const statusOrder = { in_progress: 0, pending: 1, approved: 1, completed: 2 };

    tasks.sort((a, b) => {
      // In progress first
      const statusDiff = (statusOrder[a.status as keyof typeof statusOrder] || 1) -
                         (statusOrder[b.status as keyof typeof statusOrder] || 1);
      if (statusDiff !== 0) return statusDiff;

      // Then by priority
      return (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2);
    });

    return NextResponse.json({
      date: targetDate.toISOString(),
      isToday,
      tasks,
      activeLOTOs: activeLOTOs.map(l => ({
        id: l.id,
        machineName: l.procedure.machine?.name || 'Desconocido',
        procedureName: l.procedure.name,
        workOrderTitle: l.workOrder?.title,
        lockedAt: l.lockedAt?.toISOString(),
      })),
      activePTWs: activePTWs.map(p => ({
        id: p.id,
        type: p.type,
        machineName: p.machine?.name || 'Desconocido',
        validUntil: p.validUntil?.toISOString(),
      })),
      upcomingTasks,
      summary,
    });
  } catch (error) {
    console.error('Error fetching mi-dia data:', error);
    return NextResponse.json({ error: 'Error al obtener datos del día' }, { status: 500 });
  }
}
