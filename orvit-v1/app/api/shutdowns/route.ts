import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = parseInt(searchParams.get('companyId') || '0');
    const status = searchParams.get('status');
    const year = searchParams.get('year');

    if (!companyId) {
      return NextResponse.json({ error: 'Company ID required' }, { status: 400 });
    }

    const shutdowns = await prisma.$queryRaw`
      SELECT
        s.*,
        u.name as "managerName",
        (
          SELECT COUNT(*)
          FROM "ShutdownPackage" sp
          WHERE sp."shutdownId" = s.id
        ) as "packageCount",
        (
          SELECT COUNT(*)
          FROM "ShutdownPackage" sp
          WHERE sp."shutdownId" = s.id AND sp.status = 'COMPLETED'
        ) as "completedPackages"
      FROM "Shutdown" s
      LEFT JOIN "User" u ON s."managerId" = u.id
      WHERE s."companyId" = ${companyId}
      ${status ? prisma.$queryRaw`AND s.status = ${status}` : prisma.$queryRaw``}
      ${year ? prisma.$queryRaw`AND EXTRACT(YEAR FROM s."plannedStart") = ${parseInt(year)}` : prisma.$queryRaw``}
      ORDER BY s."plannedStart" DESC
    `.catch(() => []);

    // Calculate summary
    const summary = {
      total: (shutdowns as any[]).length,
      planning: (shutdowns as any[]).filter((s: any) => s.status === 'PLANNING').length,
      approved: (shutdowns as any[]).filter((s: any) => s.status === 'APPROVED').length,
      inProgress: (shutdowns as any[]).filter((s: any) => s.status === 'IN_PROGRESS').length,
      completed: (shutdowns as any[]).filter((s: any) => s.status === 'COMPLETED').length,
    };

    return NextResponse.json({ shutdowns, summary });
  } catch (error) {
    console.error('Error fetching shutdowns:', error);
    return NextResponse.json(
      { error: 'Error fetching shutdowns' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      companyId,
      name,
      code,
      sectorIds,
      machineIds,
      plannedStart,
      plannedEnd,
      budgetLabor,
      budgetParts,
      budgetContractors,
      managerId,
    } = body;

    if (!companyId || !name || !plannedStart || !plannedEnd || !managerId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Generate unique code
    const shutdownCode = code || `SD-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase()}`;

    await prisma.$executeRaw`
      INSERT INTO "Shutdown" (
        "name", "code", "sectorIds", "machineIds", "plannedStart", "plannedEnd",
        "budgetLabor", "budgetParts", "budgetContractors", "status", "managerId", "companyId", "createdAt"
      ) VALUES (
        ${name}, ${shutdownCode}, ${JSON.stringify(sectorIds || [])}::jsonb, ${JSON.stringify(machineIds || [])}::jsonb,
        ${new Date(plannedStart)}, ${new Date(plannedEnd)},
        ${budgetLabor || 0}, ${budgetParts || 0}, ${budgetContractors || 0},
        'PLANNING', ${managerId}, ${companyId}, NOW()
      )
    `;

    return NextResponse.json({
      success: true,
      code: shutdownCode,
      message: 'Parada programada creada exitosamente',
    });
  } catch (error) {
    console.error('Error creating shutdown:', error);
    return NextResponse.json(
      { error: 'Error creating shutdown' },
      { status: 500 }
    );
  }
}
