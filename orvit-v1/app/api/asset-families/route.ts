import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/shared-helpers';

export const dynamic = 'force-dynamic';

/**
 * GET /api/asset-families
 * Get asset families (groups of similar machines)
 */
export async function GET(request: Request) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    const companyId = user!.companyId;

    const families = await prisma.$queryRaw<any[]>`
      SELECT
        af.*,
        COUNT(DISTINCT m."id") as "machineCount",
        ARRAY_AGG(DISTINCT m."name") FILTER (WHERE m."name" IS NOT NULL) as "machineNames"
      FROM "AssetFamily" af
      LEFT JOIN "Machine" m ON m."familyId" = af."id"
      WHERE af."companyId" = ${companyId}
      GROUP BY af."id"
      ORDER BY af."name"
    `;

    return NextResponse.json({ families });
  } catch (error: any) {
    if (error.code === '42P01') {
      return NextResponse.json({ families: [], message: 'Table not yet created' });
    }
    console.error('Error fetching asset families:', error);
    return NextResponse.json({ error: 'Error fetching asset families' }, { status: 500 });
  }
}

/**
 * POST /api/asset-families
 * Create a new asset family
 */
export async function POST(request: Request) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    const body = await request.json();
    const { name, description, checklistIds } = body;
    const companyId = user!.companyId;

    if (!name) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    await prisma.$executeRaw`
      INSERT INTO "AssetFamily" (
        "companyId", "name", "description", "checklistIds", "createdAt"
      ) VALUES (
        ${companyId}, ${name}, ${description || null},
        ${JSON.stringify(checklistIds || [])}::jsonb, NOW()
      )
    `;

    return NextResponse.json({ success: true, message: 'Asset family created' });
  } catch (error: any) {
    console.error('Error creating asset family:', error);
    return NextResponse.json({ error: 'Error creating asset family' }, { status: 500 });
  }
}

/**
 * PATCH /api/asset-families
 * Assign machines to a family
 */
export async function PATCH(request: Request) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    const body = await request.json();
    const { familyId, machineIds, action } = body;

    if (!familyId || !machineIds || !Array.isArray(machineIds)) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (action === 'assign') {
      await prisma.machine.updateMany({
        where: { id: { in: machineIds } },
        data: { familyId },
      });
    } else if (action === 'unassign') {
      await prisma.machine.updateMany({
        where: { id: { in: machineIds } },
        data: { familyId: null },
      });
    }

    return NextResponse.json({ success: true, message: `Machines ${action}ed` });
  } catch (error: any) {
    console.error('Error updating family assignments:', error);
    return NextResponse.json({ error: 'Error updating family assignments' }, { status: 500 });
  }
}
