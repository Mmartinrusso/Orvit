import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = parseInt(searchParams.get('companyId') || '0');
    const machineId = searchParams.get('machineId');
    const view = searchParams.get('view') || 'points'; // points, readings, rounds

    if (!companyId) {
      return NextResponse.json({ error: 'Company ID required' }, { status: 400 });
    }

    if (view === 'points') {
      const points = await prisma.$queryRaw`
        SELECT
          mp.*,
          m.name as "machineName",
          (
            SELECT COUNT(*)
            FROM "MeasuringPointReading" mpr
            WHERE mpr."pointId" = mp.id
          ) as "readingCount",
          (
            SELECT mpr.value
            FROM "MeasuringPointReading" mpr
            WHERE mpr."pointId" = mp.id
            ORDER BY mpr."readAt" DESC
            LIMIT 1
          ) as "lastValue",
          (
            SELECT mpr.status
            FROM "MeasuringPointReading" mpr
            WHERE mpr."pointId" = mp.id
            ORDER BY mpr."readAt" DESC
            LIMIT 1
          ) as "lastStatus"
        FROM "MeasuringPoint" mp
        LEFT JOIN "Machine" m ON mp."machineId" = m.id
        WHERE mp."companyId" = ${companyId}
        ${machineId ? prisma.$queryRaw`AND mp."machineId" = ${parseInt(machineId)}` : prisma.$queryRaw``}
        AND mp."isActive" = true
        ORDER BY m.name, mp.name
      `.catch(() => []);

      const summary = {
        total: (points as any[]).length,
        critical: (points as any[]).filter((p: any) => p.lastStatus === 'CRITICAL').length,
        warning: (points as any[]).filter((p: any) => p.lastStatus === 'WARNING').length,
        normal: (points as any[]).filter((p: any) => p.lastStatus === 'OK' || !p.lastStatus).length,
      };

      return NextResponse.json({ points, summary });
    }

    if (view === 'rounds') {
      const rounds = await prisma.$queryRaw`
        SELECT
          ir.*,
          s.name as "sectorName",
          (
            SELECT COUNT(*)
            FROM "InspectionRoundExecution" ire
            WHERE ire."roundId" = ir.id
          ) as "executionCount",
          (
            SELECT ire."completedAt"
            FROM "InspectionRoundExecution" ire
            WHERE ire."roundId" = ir.id
            ORDER BY ire."completedAt" DESC
            LIMIT 1
          ) as "lastExecutedAt"
        FROM "InspectionRound" ir
        LEFT JOIN "Sector" s ON ir."sectorId" = s.id
        WHERE ir."companyId" = ${companyId}
        AND ir."isActive" = true
        ORDER BY ir.name
      `.catch(() => []);

      return NextResponse.json({ rounds });
    }

    return NextResponse.json({ error: 'Invalid view parameter' }, { status: 400 });
  } catch (error) {
    console.error('Error fetching measuring points:', error);
    return NextResponse.json(
      { error: 'Error fetching measuring points' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      companyId,
      machineId,
      componentId,
      name,
      code,
      measurementType,
      unit,
      normalMin,
      normalMax,
      warningMin,
      warningMax,
      criticalMin,
      criticalMax,
      readingFrequencyHours,
    } = body;

    if (!companyId || !machineId || !name || !measurementType || !unit) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    await prisma.$executeRaw`
      INSERT INTO "MeasuringPoint" (
        "machineId", "componentId", "name", "code", "measurementType", "unit",
        "normalMin", "normalMax", "warningMin", "warningMax", "criticalMin", "criticalMax",
        "readingFrequencyHours", "isActive", "companyId", "createdAt"
      ) VALUES (
        ${machineId}, ${componentId}, ${name}, ${code}, ${measurementType}, ${unit},
        ${normalMin}, ${normalMax}, ${warningMin}, ${warningMax}, ${criticalMin}, ${criticalMax},
        ${readingFrequencyHours}, true, ${companyId}, NOW()
      )
    `;

    return NextResponse.json({
      success: true,
      message: 'Punto de medición creado exitosamente',
    });
  } catch (error) {
    console.error('Error creating measuring point:', error);
    return NextResponse.json(
      { error: 'Error creating measuring point' },
      { status: 500 }
    );
  }
}
