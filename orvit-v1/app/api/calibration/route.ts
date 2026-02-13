import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getIntParam, getStringParam } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

// GET: List calibrations
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
    const companyId = getIntParam(searchParams, 'companyId');
    const status = getStringParam(searchParams, 'status');
    const machineId = getIntParam(searchParams, 'machineId');

    if (!companyId) {
      return NextResponse.json({ error: 'companyId requerido' }, { status: 400 });
    }

    const where: any = { companyId };
    if (status && status !== 'all') where.status = status;
    if (machineId) where.machineId = machineId;

    const calibrations = await prisma.$queryRaw`
      SELECT
        c.*,
        m.name as machine_name,
        u.name as calibrated_by_name
      FROM "Calibration" c
      LEFT JOIN "Machine" m ON c."machineId" = m.id
      LEFT JOIN "User" u ON c."calibratedById" = u.id
      WHERE c."companyId" = ${companyId}
      ${status && status !== 'all' ? Prisma.sql`AND c.status = ${status}` : Prisma.empty}
      ${machineId ? Prisma.sql`AND c."machineId" = ${machineId}` : Prisma.empty}
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
      instrumentName,
      instrumentSerial,
      calibrationType,
      frequencyDays,
      standardUsed,
      toleranceMin,
      toleranceMax,
    } = body;

    if (!companyId || !machineId || !instrumentName) {
      return NextResponse.json(
        { error: 'companyId, machineId e instrumentName son requeridos' },
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
