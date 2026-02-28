import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/shared-helpers';

export const dynamic = 'force-dynamic';

/**
 * GET /api/asset-lifecycle/tco
 * Get TCO (Total Cost of Ownership) for assets
 */
export async function GET(request: Request) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const companyId = user!.companyId;
    const machineId = searchParams.get('machineId');

    if (machineId) {
      // Get TCO for specific machine
      const tcoSnapshots = await prisma.$queryRaw`
        SELECT * FROM "AssetTCOSnapshot"
        WHERE "machineId" = ${parseInt(machineId)}
        ORDER BY "periodEnd" DESC
        LIMIT 12
      `;

      // Calculate current period TCO
      const currentTCO = await calculateMachineTCO(parseInt(machineId), companyId);

      return NextResponse.json({
        machineId: parseInt(machineId),
        currentTCO,
        historicalSnapshots: tcoSnapshots,
      });
    }

    // Get TCO summary for all machines
    const tcoSummary = await prisma.$queryRaw`
      SELECT
        m."id",
        m."name",
        m."acquisitionCost",
        COALESCE(SUM(mcb."laborCost"), 0) as "totalLaborCost",
        COALESCE(SUM(mcb."sparePartsCost"), 0) as "totalPartsCost",
        COALESCE(SUM(mcb."thirdPartyCost"), 0) as "totalThirdPartyCost",
        COALESCE(SUM(mcb."totalCost"), 0) as "totalMaintenanceCost",
        COUNT(DISTINCT wo."id") as "workOrderCount"
      FROM "Machine" m
      LEFT JOIN "MaintenanceCostBreakdown" mcb ON mcb."machineId" = m."id"
      LEFT JOIN "WorkOrder" wo ON wo."machineId" = m."id"
      WHERE m."companyId" = ${companyId}
      AND m."isActive" = true
      GROUP BY m."id", m."name", m."acquisitionCost"
      ORDER BY "totalMaintenanceCost" DESC
      LIMIT 50
    `;

    return NextResponse.json({ tcoSummary });
  } catch (error: any) {
    if (error.code === '42P01') {
      return NextResponse.json({ tcoSummary: [], message: 'Table not yet created' });
    }
    console.error('Error fetching TCO:', error);
    return NextResponse.json({ error: 'Error fetching TCO' }, { status: 500 });
  }
}

/**
 * POST /api/asset-lifecycle/tco
 * Calculate and store TCO snapshot
 */
export async function POST(request: Request) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    const body = await request.json();
    const { machineId, periodStart, periodEnd } = body;
    const companyId = user!.companyId;

    if (!machineId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const tco = await calculateMachineTCO(machineId, companyId, periodStart, periodEnd);

    // Store snapshot
    await prisma.$executeRaw`
      INSERT INTO "AssetTCOSnapshot" (
        "companyId", "machineId", "periodStart", "periodEnd",
        "acquisitionCost", "maintenanceCost", "operatingCost",
        "downtimeCost", "thirdPartyCost", "totalCost",
        "costPerHour", "calculatedAt"
      ) VALUES (
        ${companyId}, ${machineId},
        ${new Date(periodStart || new Date(new Date().getFullYear(), 0, 1))},
        ${new Date(periodEnd || new Date())},
        ${tco.acquisitionCost || 0}, ${tco.maintenanceCost || 0},
        ${tco.operatingCost || 0}, ${tco.downtimeCost || 0},
        ${tco.thirdPartyCost || 0}, ${tco.totalCost || 0},
        ${tco.costPerHour || null}, NOW()
      )
    `;

    return NextResponse.json({ success: true, tco });
  } catch (error: any) {
    console.error('Error calculating TCO:', error);
    return NextResponse.json({ error: 'Error calculating TCO' }, { status: 500 });
  }
}

async function calculateMachineTCO(
  machineId: number,
  companyId: number,
  periodStart?: string,
  periodEnd?: string
) {
  const startDate = periodStart ? new Date(periodStart) : new Date(new Date().getFullYear(), 0, 1);
  const endDate = periodEnd ? new Date(periodEnd) : new Date();

  // Get acquisition cost
  const machine = await prisma.machine.findUnique({
    where: { id: machineId },
    select: { acquisitionCost: true, operatingHoursPerDay: true },
  });

  // Get maintenance costs
  const maintenanceCosts = await prisma.$queryRaw<any[]>`
    SELECT
      COALESCE(SUM("laborCost"), 0) as "laborCost",
      COALESCE(SUM("sparePartsCost"), 0) as "partsCost",
      COALESCE(SUM("thirdPartyCost"), 0) as "thirdPartyCost"
    FROM "MaintenanceCostBreakdown"
    WHERE "machineId" = ${machineId}
    AND "createdAt" BETWEEN ${startDate} AND ${endDate}
  `;

  // Get downtime costs (assuming $100/hour downtime cost)
  const downtimeLogs = await prisma.$queryRaw<any[]>`
    SELECT
      COALESCE(SUM(EXTRACT(EPOCH FROM ("endTime" - "startTime")) / 3600), 0) as "totalHours"
    FROM "DowntimeLog"
    WHERE "machineId" = ${machineId}
    AND "startTime" BETWEEN ${startDate} AND ${endDate}
  `;

  const costs = maintenanceCosts[0] || { laborCost: 0, partsCost: 0, thirdPartyCost: 0 };
  const downtimeHours = parseFloat(downtimeLogs[0]?.totalHours || 0);
  const downtimeCostRate = 100; // $100/hour - should be configurable

  const maintenanceCost = parseFloat(costs.laborCost) + parseFloat(costs.partsCost);
  const downtimeCost = downtimeHours * downtimeCostRate;
  const thirdPartyCost = parseFloat(costs.thirdPartyCost);

  const totalCost =
    (parseFloat(String(machine?.acquisitionCost || 0)) || 0) +
    maintenanceCost +
    downtimeCost +
    thirdPartyCost;

  // Calculate cost per hour
  const daysInPeriod = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const operatingHours = daysInPeriod * (machine?.operatingHoursPerDay || 8);
  const costPerHour = operatingHours > 0 ? totalCost / operatingHours : null;

  return {
    acquisitionCost: parseFloat(String(machine?.acquisitionCost || 0)) || 0,
    maintenanceCost,
    operatingCost: 0, // Would need energy data
    downtimeCost,
    thirdPartyCost,
    totalCost,
    costPerHour,
    downtimeHours,
  };
}
