import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

interface OfflineAction {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  timestamp: string;
}

/**
 * POST /api/mobile/sync
 * Syncs offline queue items from mobile device
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { companyId, userId, actions } = body as {
      companyId: number;
      userId: number;
      actions: OfflineAction[];
    };

    if (!companyId || !userId || !actions) {
      return NextResponse.json(
        { error: 'companyId, userId, and actions required' },
        { status: 400 }
      );
    }

    const results: { actionId: string; success: boolean; error?: string; resultId?: number }[] = [];

    for (const action of actions) {
      try {
        const result = await processAction(action, companyId, userId);
        results.push({ actionId: action.id, success: true, resultId: result });
      } catch (error) {
        results.push({
          actionId: action.id,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    return NextResponse.json({
      success: true,
      synced: successCount,
      failed: failCount,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error syncing:', error);
    return NextResponse.json(
      { error: 'Error syncing data' },
      { status: 500 }
    );
  }
}

async function processAction(
  action: OfflineAction,
  companyId: number,
  userId: number
): Promise<number | undefined> {
  const { type, payload } = action;

  switch (type) {
    case 'CREATE_FAILURE': {
      const failure = await prisma.failureOccurrence.create({
        data: {
          companyId,
          machineId: payload.machineId as number,
          reportedById: userId,
          description: payload.description as string,
          symptoms: (payload.symptoms as string[]) || [],
          status: 'OPEN',
          reportedAt: new Date(action.timestamp),
        },
      });
      return failure.id;
    }

    case 'UPDATE_WO_STATUS': {
      await prisma.workOrder.update({
        where: { id: payload.workOrderId as number },
        data: {
          status: payload.status as string,
          ...(payload.status === 'IN_PROGRESS' && { startDate: new Date() }),
          ...(payload.status === 'COMPLETED' && { completedAt: new Date() }),
        },
      });
      return payload.workOrderId as number;
    }

    case 'ADD_WORK_LOG': {
      const log = await prisma.workLog.create({
        data: {
          workOrderId: payload.workOrderId as number,
          userId,
          description: payload.description as string,
          duration: payload.duration as number,
          loggedAt: new Date(action.timestamp),
        },
      });
      return log.id;
    }

    case 'COMPLETE_CHECKLIST': {
      const execution = await prisma.checklistExecution.create({
        data: {
          checklistId: payload.checklistId as number,
          executedById: userId,
          executedAt: new Date(action.timestamp),
          results: payload.results as object,
          status: 'COMPLETED',
          companyId,
        },
      });
      return execution.id;
    }

    case 'ADD_READING': {
      // For condition monitoring readings
      const reading = await prisma.$executeRaw`
        INSERT INTO "ConditionReading" ("monitorId", "value", "status", "readingAt", "recordedById", "source")
        VALUES (${payload.monitorId}, ${payload.value}, ${payload.status || 'NORMAL'}, ${new Date(action.timestamp)}, ${userId}, 'MOBILE')
        RETURNING id
      `;
      return reading as number;
    }

    default:
      throw new Error(`Unknown action type: ${type}`);
  }
}

/**
 * GET /api/mobile/sync
 * Gets data that needs to be synced to mobile device
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = parseInt(searchParams.get('companyId') || '0');
    const userId = parseInt(searchParams.get('userId') || '0');
    const lastSync = searchParams.get('lastSync');

    if (!companyId || !userId) {
      return NextResponse.json(
        { error: 'companyId and userId required' },
        { status: 400 }
      );
    }

    const since = lastSync ? new Date(lastSync) : new Date(0);

    // Get updated machines
    const machines = await prisma.machine.findMany({
      where: {
        companyId,
        updatedAt: { gt: since },
      },
      select: {
        id: true,
        name: true,
        code: true,
        location: true,
        qrCode: true,
        status: true,
        healthScore: true,
      },
    });

    // Get updated work orders assigned to user
    const workOrders = await prisma.workOrder.findMany({
      where: {
        companyId,
        assignedToId: userId,
        updatedAt: { gt: since },
      },
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        machineId: true,
        dueDate: true,
      },
    });

    // Get checklists
    const checklists = await prisma.maintenanceChecklist.findMany({
      where: {
        companyId,
        isActive: true,
        updatedAt: { gt: since },
      },
      select: {
        id: true,
        name: true,
        machineId: true,
        frequency: true,
        nextDueDate: true,
        checklistData: true,
      },
    });

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      data: {
        machines,
        workOrders,
        checklists,
      },
    });
  } catch (error) {
    console.error('Error getting sync data:', error);
    return NextResponse.json(
      { error: 'Error getting sync data' },
      { status: 500 }
    );
  }
}
