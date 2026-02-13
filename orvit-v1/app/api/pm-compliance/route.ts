import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/pm-compliance
 * Get PM (Preventive Maintenance) compliance metrics
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = parseInt(searchParams.get('companyId') || '0');
    const areaId = searchParams.get('areaId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!companyId) {
      return NextResponse.json({ error: 'Company ID required' }, { status: 400 });
    }

    const start = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const end = endDate ? new Date(endDate) : new Date();

    // Get PM executions
    const executions = await prisma.$queryRaw<any[]>`
      SELECT
        ce."id",
        ce."checklistId",
        ce."executionDate",
        ce."status",
        mc."name" as "checklistName",
        mc."frequency",
        m."name" as "machineName",
        m."areaId"
      FROM "ChecklistExecution" ce
      JOIN "MaintenanceChecklist" mc ON ce."checklistId" = mc."id"
      LEFT JOIN "Machine" m ON mc."machineId" = m."id"
      WHERE mc."companyId" = ${companyId}
      AND ce."executionDate" BETWEEN ${start} AND ${end}
      ${areaId ? prisma.$queryRaw`AND m."areaId" = ${parseInt(areaId)}` : prisma.$queryRaw``}
      ORDER BY ce."executionDate" DESC
    `;

    // Calculate compliance metrics
    const totalScheduled = await prisma.maintenanceChecklist.count({
      where: {
        companyId,
        isActive: true,
        nextDueDate: { lte: end },
      },
    });

    const completedOnTime = executions.filter((e) => e.status === 'completed').length;
    const completedLate = executions.filter((e) => e.status === 'completed_late').length;
    const skipped = executions.filter((e) => e.status === 'skipped').length;
    const overdue = await prisma.maintenanceChecklist.count({
      where: {
        companyId,
        isActive: true,
        nextDueDate: { lt: new Date() },
      },
    });

    const complianceRate = totalScheduled > 0
      ? Math.round(((completedOnTime + completedLate) / totalScheduled) * 100)
      : 100;

    const onTimeRate = totalScheduled > 0
      ? Math.round((completedOnTime / totalScheduled) * 100)
      : 100;

    // Group by area
    const byArea = await prisma.$queryRaw<any[]>`
      SELECT
        a."id" as "areaId",
        a."name" as "areaName",
        COUNT(DISTINCT mc."id") as "totalPMs",
        COUNT(DISTINCT CASE WHEN ce."status" = 'completed' THEN ce."id" END) as "completedOnTime",
        COUNT(DISTINCT CASE WHEN mc."nextDueDate" < NOW() THEN mc."id" END) as "overdue"
      FROM "Area" a
      LEFT JOIN "Machine" m ON m."areaId" = a."id"
      LEFT JOIN "MaintenanceChecklist" mc ON mc."machineId" = m."id" AND mc."isActive" = true
      LEFT JOIN "ChecklistExecution" ce ON ce."checklistId" = mc."id"
        AND ce."executionDate" BETWEEN ${start} AND ${end}
      WHERE a."companyId" = ${companyId}
      GROUP BY a."id", a."name"
      ORDER BY a."name"
    `;

    // Group by frequency
    const byFrequency = await prisma.$queryRaw<any[]>`
      SELECT
        mc."frequency",
        COUNT(DISTINCT mc."id") as "total",
        COUNT(DISTINCT CASE WHEN ce."status" = 'completed' THEN ce."id" END) as "completed",
        COUNT(DISTINCT CASE WHEN mc."nextDueDate" < NOW() THEN mc."id" END) as "overdue"
      FROM "MaintenanceChecklist" mc
      LEFT JOIN "ChecklistExecution" ce ON ce."checklistId" = mc."id"
        AND ce."executionDate" BETWEEN ${start} AND ${end}
      WHERE mc."companyId" = ${companyId}
      AND mc."isActive" = true
      GROUP BY mc."frequency"
      ORDER BY mc."frequency"
    `;

    return NextResponse.json({
      period: { start, end },
      summary: {
        totalScheduled,
        completedOnTime,
        completedLate,
        skipped,
        overdue,
        complianceRate,
        onTimeRate,
      },
      byArea,
      byFrequency,
      recentExecutions: executions.slice(0, 20),
    });
  } catch (error: any) {
    console.error('Error fetching PM compliance:', error);
    return NextResponse.json({ error: 'Error fetching PM compliance' }, { status: 500 });
  }
}

/**
 * POST /api/pm-compliance
 * Record a PM execution
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      checklistId,
      executionDate,
      status, // ON_TIME, EARLY, LATE, SKIPPED
      skipReason,
      skipApprovedById,
      skipNotes,
      executedById,
      companyId,
    } = body;

    if (!checklistId || !executionDate || !status) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // For SKIPPED status, require approval
    if (status === 'SKIPPED' && !skipApprovedById) {
      return NextResponse.json({
        error: 'Skipped PM requires approval',
      }, { status: 400 });
    }

    await prisma.$executeRaw`
      INSERT INTO "PMExecution" (
        "checklistId", "scheduledDate", "executedDate", "status",
        "skipReason", "skipApprovedById", "skipNotes", "executedById", "companyId"
      ) VALUES (
        ${checklistId}, ${new Date(executionDate)},
        ${status !== 'SKIPPED' ? new Date(executionDate) : null},
        ${status}, ${skipReason || null}, ${skipApprovedById || null},
        ${skipNotes || null}, ${executedById || null}, ${companyId}
      )
    `;

    // Update next due date on checklist
    if (status !== 'SKIPPED') {
      const checklist = await prisma.maintenanceChecklist.findUnique({
        where: { id: checklistId },
        select: { frequency: true },
      });

      if (checklist) {
        const nextDue = calculateNextDueDate(new Date(executionDate), checklist.frequency);
        await prisma.maintenanceChecklist.update({
          where: { id: checklistId },
          data: { nextDueDate: nextDue },
        });
      }
    }

    return NextResponse.json({ success: true, message: 'PM execution recorded' });
  } catch (error: any) {
    console.error('Error recording PM execution:', error);
    return NextResponse.json({ error: 'Error recording PM execution' }, { status: 500 });
  }
}

function calculateNextDueDate(lastExecution: Date, frequency: string): Date {
  const next = new Date(lastExecution);

  switch (frequency.toLowerCase()) {
    case 'daily':
      next.setDate(next.getDate() + 1);
      break;
    case 'weekly':
      next.setDate(next.getDate() + 7);
      break;
    case 'biweekly':
      next.setDate(next.getDate() + 14);
      break;
    case 'monthly':
      next.setMonth(next.getMonth() + 1);
      break;
    case 'quarterly':
      next.setMonth(next.getMonth() + 3);
      break;
    case 'semiannual':
      next.setMonth(next.getMonth() + 6);
      break;
    case 'annual':
      next.setFullYear(next.getFullYear() + 1);
      break;
    default:
      next.setMonth(next.getMonth() + 1);
  }

  return next;
}
