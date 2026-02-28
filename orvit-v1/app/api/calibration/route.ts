import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { requirePermission } from '@/lib/auth/shared-helpers';

export const dynamic = 'force-dynamic';

// GET: List calibrations
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requirePermission('calibration.view');
    if (error) return error;

    const companyId = user!.companyId;
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const machineId = searchParams.get('machineId');

    const statusCondition = status && status !== 'all'
      ? Prisma.sql`AND c.status = ${status}`
      : Prisma.sql``;
    const machineCondition = machineId
      ? Prisma.sql`AND c."machineId" = ${parseInt(machineId)}`
      : Prisma.sql``;

    const calibrations = await prisma.$queryRaw`
      SELECT
        c.*,
        m.name as machine_name,
        u.name as calibrated_by_name
      FROM "Calibration" c
      LEFT JOIN "Machine" m ON c."machineId" = m.id
      LEFT JOIN "User" u ON c."calibratedById" = u.id
      WHERE c."companyId" = ${companyId}
      ${statusCondition}
      ${machineCondition}
      ORDER BY c."nextCalibrationDate" ASC NULLS LAST
    `;

    // Get summary counts
    const summary = await prisma.$queryRaw`
      SELECT
        COUNT(*) FILTER (WHERE status = 'PENDING') as pending,
        COUNT(*) FILTER (WHERE status = 'COMPLETED') as completed,
        COUNT(*) FILTER (WHERE status = 'OVERDUE') as overdue,
        COUNT(*) FILTER (WHERE status = 'FAILED') as failed,
        COUNT(*) as total
      FROM "Calibration"
      WHERE "companyId" = ${companyId}
    `;

    return NextResponse.json({ calibrations, summary: (summary as any[])[0] || {} });
  } catch (error) {
    console.error('Error fetching calibrations:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// POST: Create calibration
export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requirePermission('calibration.create');
    if (error) return error;

    const companyId = user!.companyId;
    const body = await request.json();
    const {
      machineId,
      componentId,
      instrumentName,
      instrumentSerial,
      calibrationType,
      frequencyDays,
      standardUsed,
      toleranceMin,
      toleranceMax,
    } = body;

    if (!machineId || !instrumentName) {
      return NextResponse.json(
        { error: 'machineId e instrumentName son requeridos' },
        { status: 400 }
      );
    }

    // Generate calibration number
    const year = new Date().getFullYear();
    const countResult = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count FROM "Calibration"
      WHERE "companyId" = ${companyId}
      AND EXTRACT(YEAR FROM "createdAt") = ${year}
    `;
    const count = Number(countResult[0]?.count || 0);
    const calibrationNumber = `CAL-${year}-${String(count + 1).padStart(4, '0')}`;

    // Calculate next calibration date
    const nextCalibrationDate = new Date();
    nextCalibrationDate.setDate(nextCalibrationDate.getDate() + (frequencyDays || 365));

    await prisma.$executeRaw`
      INSERT INTO "Calibration" (
        "calibrationNumber", "machineId", "componentId", "instrumentName",
        "instrumentSerial", "calibrationType", "frequencyDays", "status",
        "nextCalibrationDate", "dueDate", "standardUsed", "toleranceMin",
        "toleranceMax", "companyId", "createdAt", "updatedAt"
      ) VALUES (
        ${calibrationNumber}, ${machineId}, ${componentId || null}, ${instrumentName},
        ${instrumentSerial || null}, ${calibrationType || 'INTERNAL'}, ${frequencyDays || 365}, 'PENDING',
        ${nextCalibrationDate}, ${nextCalibrationDate}, ${standardUsed || null}, ${toleranceMin || null},
        ${toleranceMax || null}, ${companyId}, NOW(), NOW()
      )
    `;

    return NextResponse.json({ success: true, calibrationNumber }, { status: 201 });
  } catch (error) {
    console.error('Error creating calibration:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// PUT: Update calibration (edit, execute, approve)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, action } = body;

    if (!id) {
      return NextResponse.json({ error: 'id es requerido' }, { status: 400 });
    }

    // Determine required permission based on action
    let permissionName = 'calibration.edit';
    if (action === 'execute') permissionName = 'calibration.execute';
    else if (action === 'approve') permissionName = 'calibration.approve';

    const { user, error } = await requirePermission(permissionName);
    if (error) return error;

    const companyId = user!.companyId;

    // Verify ownership
    const existing = await prisma.$queryRaw<{ id: number }[]>`
      SELECT id FROM "Calibration" WHERE id = ${id} AND "companyId" = ${companyId}
    `;
    if (!existing.length) {
      return NextResponse.json({ error: 'Calibración no encontrada' }, { status: 404 });
    }

    if (action === 'execute') {
      const { result, measurementBefore, measurementAfter, notes } = body;

      await prisma.$executeRaw`
        UPDATE "Calibration" SET
          status = 'COMPLETED',
          result = ${result || 'PASS'},
          "measurementBefore" = ${measurementBefore || null},
          "measurementAfter" = ${measurementAfter || null},
          "calibratedById" = ${user!.id},
          "lastCalibrationDate" = NOW(),
          notes = ${notes || null},
          "updatedAt" = NOW()
        WHERE id = ${id} AND "companyId" = ${companyId}
      `;

      // Calculate next calibration date
      const calData = await prisma.$queryRaw<{ frequencyDays: number }[]>`
        SELECT "frequencyDays" FROM "Calibration" WHERE id = ${id}
      `;
      if (calData[0]?.frequencyDays) {
        const nextDate = new Date();
        nextDate.setDate(nextDate.getDate() + calData[0].frequencyDays);
        await prisma.$executeRaw`
          UPDATE "Calibration" SET
            "nextCalibrationDate" = ${nextDate},
            "dueDate" = ${nextDate}
          WHERE id = ${id}
        `;
      }

      return NextResponse.json({ success: true });
    }

    if (action === 'approve') {
      const { approved, approvalNotes } = body;

      await prisma.$executeRaw`
        UPDATE "Calibration" SET
          "approvedById" = ${user!.id},
          "approvedAt" = NOW(),
          "approvalStatus" = ${approved ? 'APPROVED' : 'REJECTED'},
          "approvalNotes" = ${approvalNotes || null},
          "updatedAt" = NOW()
        WHERE id = ${id} AND "companyId" = ${companyId}
      `;

      return NextResponse.json({ success: true });
    }

    // Default: edit
    const {
      instrumentName,
      instrumentSerial,
      calibrationType,
      frequencyDays,
      standardUsed,
      toleranceMin,
      toleranceMax,
    } = body;

    await prisma.$executeRaw`
      UPDATE "Calibration" SET
        "instrumentName" = COALESCE(${instrumentName || null}, "instrumentName"),
        "instrumentSerial" = ${instrumentSerial || null},
        "calibrationType" = COALESCE(${calibrationType || null}, "calibrationType"),
        "frequencyDays" = COALESCE(${frequencyDays || null}, "frequencyDays"),
        "standardUsed" = ${standardUsed || null},
        "toleranceMin" = ${toleranceMin || null},
        "toleranceMax" = ${toleranceMax || null},
        "updatedAt" = NOW()
      WHERE id = ${id} AND "companyId" = ${companyId}
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating calibration:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// DELETE: Delete calibration
export async function DELETE(request: NextRequest) {
  try {
    const { user, error } = await requirePermission('calibration.delete');
    if (error) return error;

    const companyId = user!.companyId;
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id es requerido' }, { status: 400 });
    }

    // Verify ownership
    const existing = await prisma.$queryRaw<{ id: number }[]>`
      SELECT id FROM "Calibration" WHERE id = ${parseInt(id)} AND "companyId" = ${companyId}
    `;
    if (!existing.length) {
      return NextResponse.json({ error: 'Calibración no encontrada' }, { status: 404 });
    }

    await prisma.$executeRaw`
      DELETE FROM "Calibration" WHERE id = ${parseInt(id)} AND "companyId" = ${companyId}
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting calibration:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
