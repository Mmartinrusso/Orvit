import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { requirePermission } from '@/lib/auth/shared-helpers';

export const dynamic = 'force-dynamic';

// GET: List lubrication points and schedules
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requirePermission('lubrication.view');
    if (error) return error;

    const companyId = user!.companyId;
    const { searchParams } = new URL(request.url);
    const machineId = searchParams.get('machineId');
    const view = searchParams.get('view') || 'points'; // points, schedules, executions

    if (view === 'points') {
      const machineCondition = machineId
        ? Prisma.sql`AND lp."machineId" = ${parseInt(machineId)}`
        : Prisma.sql``;
      const points = await prisma.$queryRaw`
        SELECT
          lp.*,
          m.name as machine_name,
          (SELECT COUNT(*) FROM "LubricationExecution" le WHERE le."lubricationPointId" = lp.id) as execution_count,
          (SELECT MAX("executedAt") FROM "LubricationExecution" le WHERE le."lubricationPointId" = lp.id) as last_execution
        FROM "LubricationPoint" lp
        LEFT JOIN "Machine" m ON lp."machineId" = m.id
        WHERE lp."companyId" = ${companyId}
        ${machineCondition}
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
    const { user, error } = await requirePermission('lubrication.create');
    if (error) return error;

    const companyId = user!.companyId;
    const body = await request.json();
    const {
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

    if (!machineId || !name || !lubricantType) {
      return NextResponse.json(
        { error: 'machineId, name y lubricantType son requeridos' },
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

// PUT: Update lubrication point
export async function PUT(request: NextRequest) {
  try {
    const { user, error } = await requirePermission('lubrication.edit');
    if (error) return error;

    const companyId = user!.companyId;
    const body = await request.json();
    const {
      id,
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

    if (!id) {
      return NextResponse.json({ error: 'id es requerido' }, { status: 400 });
    }

    // Verify ownership
    const existing = await prisma.$queryRaw<{ id: number }[]>`
      SELECT id FROM "LubricationPoint" WHERE id = ${id} AND "companyId" = ${companyId}
    `;
    if (!existing.length) {
      return NextResponse.json({ error: 'Punto de lubricación no encontrado' }, { status: 404 });
    }

    await prisma.$executeRaw`
      UPDATE "LubricationPoint" SET
        "name" = COALESCE(${name || null}, "name"),
        "location" = ${location || null},
        "lubricantType" = COALESCE(${lubricantType || null}, "lubricantType"),
        "lubricantBrand" = ${lubricantBrand || null},
        "quantity" = ${quantity || null},
        "quantityUnit" = COALESCE(${quantityUnit || null}, "quantityUnit"),
        "method" = COALESCE(${method || null}, "method"),
        "frequencyHours" = ${frequencyHours || null},
        "frequencyDays" = ${frequencyDays || null},
        "instructions" = ${instructions || null},
        "updatedAt" = NOW()
      WHERE id = ${id} AND "companyId" = ${companyId}
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating lubrication point:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// DELETE: Delete lubrication point
export async function DELETE(request: NextRequest) {
  try {
    const { user, error } = await requirePermission('lubrication.delete');
    if (error) return error;

    const companyId = user!.companyId;
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id es requerido' }, { status: 400 });
    }

    // Verify ownership
    const existing = await prisma.$queryRaw<{ id: number }[]>`
      SELECT id FROM "LubricationPoint" WHERE id = ${parseInt(id)} AND "companyId" = ${companyId}
    `;
    if (!existing.length) {
      return NextResponse.json({ error: 'Punto de lubricación no encontrado' }, { status: 404 });
    }

    // Delete related executions first
    await prisma.$executeRaw`
      DELETE FROM "LubricationExecution" WHERE "lubricationPointId" = ${parseInt(id)}
    `;
    // Delete related schedules
    await prisma.$executeRaw`
      DELETE FROM "LubricationSchedule" WHERE "lubricationPointId" = ${parseInt(id)}
    `;
    // Delete the point
    await prisma.$executeRaw`
      DELETE FROM "LubricationPoint" WHERE id = ${parseInt(id)} AND "companyId" = ${companyId}
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting lubrication point:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
