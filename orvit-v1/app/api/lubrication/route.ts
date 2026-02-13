import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET: List lubrication points and schedules
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const companyId = parseInt(searchParams.get('companyId') || '0');
    const machineId = searchParams.get('machineId');
    const view = searchParams.get('view') || 'points'; // points, schedules, executions

    if (!companyId) {
      return NextResponse.json({ error: 'companyId requerido' }, { status: 400 });
    }

    if (view === 'points') {
      const points = await prisma.$queryRaw`
        SELECT
          lp.*,
          m.name as machine_name,
          (SELECT COUNT(*) FROM "LubricationExecution" le WHERE le."lubricationPointId" = lp.id) as execution_count,
          (SELECT MAX("executedAt") FROM "LubricationExecution" le WHERE le."lubricationPointId" = lp.id) as last_execution
        FROM "LubricationPoint" lp
        LEFT JOIN "Machine" m ON lp."machineId" = m.id
        WHERE lp."companyId" = ${companyId}
        ${machineId ? prisma.$queryRaw`AND lp."machineId" = ${parseInt(machineId)}` : prisma.$queryRaw``}
        ORDER BY m.name, lp.name
      `;
      return NextResponse.json({ points });
    }

    if (view === 'schedules') {
      const schedules = await prisma.$queryRaw`
        SELECT
          ls.*,
          lp.name as point_name,
          lp."lubricantType",
          m.name as machine_name,
          u.name as completed_by_name
        FROM "LubricationSchedule" ls
        JOIN "LubricationPoint" lp ON ls."lubricationPointId" = lp.id
        LEFT JOIN "Machine" m ON lp."machineId" = m.id
        LEFT JOIN "User" u ON ls."completedById" = u.id
        WHERE lp."companyId" = ${companyId}
        ORDER BY ls."scheduledDate" ASC
        LIMIT 100
      `;
      return NextResponse.json({ schedules });
    }

    if (view === 'executions') {
      const executions = await prisma.$queryRaw`
        SELECT
          le.*,
          lp.name as point_name,
          m.name as machine_name,
          u.name as executed_by_name
        FROM "LubricationExecution" le
        JOIN "LubricationPoint" lp ON le."lubricationPointId" = lp.id
        LEFT JOIN "Machine" m ON lp."machineId" = m.id
        LEFT JOIN "User" u ON le."executedById" = u.id
        WHERE lp."companyId" = ${companyId}
        ORDER BY le."executedAt" DESC
        LIMIT 100
      `;
      return NextResponse.json({ executions });
    }

    return NextResponse.json({ error: 'Vista no válida' }, { status: 400 });
  } catch (error) {
    console.error('Error fetching lubrication data:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// POST: Create lubrication point
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const body = await request.json();
    const {
      companyId,
      machineId,
      componentId,
      name,
      location,
      lubricantType,
      lubricantBrand,
      quantity,
      quantityUnit,
      method,
      frequencyHours,
      frequencyDays,
      instructions,
    } = body;

    if (!companyId || !machineId || !name || !lubricantType) {
      return NextResponse.json(
        { error: 'companyId, machineId, name y lubricantType son requeridos' },
        { status: 400 }
      );
    }

    await prisma.$executeRaw`
      INSERT INTO "LubricationPoint" (
        "machineId", "componentId", "name", "location", "lubricantType",
        "lubricantBrand", "quantity", "quantityUnit", "method",
        "frequencyHours", "frequencyDays", "instructions", "companyId",
        "createdAt", "updatedAt"
      ) VALUES (
        ${machineId}, ${componentId || null}, ${name}, ${location || null}, ${lubricantType},
        ${lubricantBrand || null}, ${quantity || null}, ${quantityUnit || 'ml'}, ${method || 'MANUAL'},
        ${frequencyHours || null}, ${frequencyDays || null}, ${instructions || null}, ${companyId},
        NOW(), NOW()
      )
    `;

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error('Error creating lubrication point:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
