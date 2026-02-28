import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/shared-helpers';

export const dynamic = 'force-dynamic';

/**
 * GET /api/asset-lifecycle
 * Get asset lifecycle events
 */
export async function GET(request: Request) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const companyId = user!.companyId;
    const machineId = searchParams.get('machineId');
    const eventType = searchParams.get('eventType');

    const events = await prisma.$queryRaw`
      SELECT
        ale.*,
        m."name" as "machineName",
        u."name" as "performedByName"
      FROM "AssetLifecycleEvent" ale
      LEFT JOIN "Machine" m ON ale."machineId" = m."id"
      LEFT JOIN "User" u ON ale."performedById" = u."id"
      WHERE ale."companyId" = ${companyId}
      ${machineId ? prisma.$queryRaw`AND ale."machineId" = ${parseInt(machineId)}` : prisma.$queryRaw``}
      ${eventType ? prisma.$queryRaw`AND ale."eventType" = ${eventType}` : prisma.$queryRaw``}
      ORDER BY ale."eventDate" DESC
      LIMIT 100
    `;

    return NextResponse.json({ events });
  } catch (error: any) {
    if (error.code === '42P01') {
      return NextResponse.json({ events: [], message: 'Table not yet created' });
    }
    console.error('Error fetching lifecycle events:', error);
    return NextResponse.json({ error: 'Error fetching lifecycle events' }, { status: 500 });
  }
}

/**
 * POST /api/asset-lifecycle
 * Record a new lifecycle event
 */
export async function POST(request: Request) {
  try {
    const { user, error } = await requireAuth();
    if (error) return error;

    const body = await request.json();
    const {
      machineId,
      eventType,
      eventDate,
      cost,
      supplierName,
      workOrderId,
      description,
      performedById,
      fromLocationId,
      toLocationId,
    } = body;

    const companyId = user!.companyId;

    if (!machineId || !eventType || !eventDate) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    await prisma.$executeRaw`
      INSERT INTO "AssetLifecycleEvent" (
        "companyId", "machineId", "eventType", "eventDate",
        "cost", "supplierName", "workOrderId", "description",
        "performedById", "fromLocationId", "toLocationId", "createdAt"
      ) VALUES (
        ${companyId}, ${machineId}, ${eventType}, ${new Date(eventDate)},
        ${cost || null}, ${supplierName || null}, ${workOrderId || null},
        ${description || null}, ${performedById}, ${fromLocationId || null},
        ${toLocationId || null}, NOW()
      )
    `;

    return NextResponse.json({ success: true, message: 'Lifecycle event recorded' });
  } catch (error: any) {
    console.error('Error creating lifecycle event:', error);
    return NextResponse.json({ error: 'Error creating lifecycle event' }, { status: 500 });
  }
}
