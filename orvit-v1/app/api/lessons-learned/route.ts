import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = parseInt(searchParams.get('companyId') || '0');
    const status = searchParams.get('status');
    const category = searchParams.get('category');
    const machineId = searchParams.get('machineId');

    if (!companyId) {
      return NextResponse.json({ error: 'Company ID required' }, { status: 400 });
    }

    const lessons = await prisma.$queryRaw`
      SELECT
        ll.*,
        wo.title as "workOrderTitle",
        fo.description as "failureDescription",
        u.name as "createdByName",
        m.name as "machineName"
      FROM "LessonLearned" ll
      LEFT JOIN "WorkOrder" wo ON ll."workOrderId" = wo.id
      LEFT JOIN "FailureOccurrence" fo ON ll."failureOccurrenceId" = fo.id
      LEFT JOIN "User" u ON ll."createdById" = u.id
      LEFT JOIN "Machine" m ON wo."machineId" = m.id OR fo."machineId" = m.id
      WHERE ll."companyId" = ${companyId}
      ${status ? prisma.$queryRaw`AND ll.status = ${status}` : prisma.$queryRaw``}
      ${category ? prisma.$queryRaw`AND ll.category = ${category}` : prisma.$queryRaw``}
      ${machineId ? prisma.$queryRaw`AND (wo."machineId" = ${parseInt(machineId)} OR fo."machineId" = ${parseInt(machineId)})` : prisma.$queryRaw``}
      ORDER BY ll."createdAt" DESC
    `.catch(() => []);

    const summary = {
      total: (lessons as any[]).length,
      draft: (lessons as any[]).filter((l: any) => l.status === 'DRAFT').length,
      approved: (lessons as any[]).filter((l: any) => l.status === 'APPROVED').length,
      published: (lessons as any[]).filter((l: any) => l.status === 'PUBLISHED').length,
      byCategory: {
        technical: (lessons as any[]).filter((l: any) => l.category === 'TECHNICAL').length,
        process: (lessons as any[]).filter((l: any) => l.category === 'PROCESS').length,
        safety: (lessons as any[]).filter((l: any) => l.category === 'SAFETY').length,
        quality: (lessons as any[]).filter((l: any) => l.category === 'QUALITY').length,
      },
    };

    return NextResponse.json({ lessons, summary });
  } catch (error) {
    console.error('Error fetching lessons learned:', error);
    return NextResponse.json(
      { error: 'Error fetching lessons learned' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      companyId,
      workOrderId,
      failureOccurrenceId,
      title,
      description,
      rootCause,
      whatWorked,
      whatDidnt,
      recommendation,
      category,
      tags,
      createdById,
    } = body;

    if (!companyId || !title || !description || !recommendation || !createdById) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    await prisma.$executeRaw`
      INSERT INTO "LessonLearned" (
        "workOrderId", "failureOccurrenceId", "title", "description",
        "rootCause", "whatWorked", "whatDidnt", "recommendation",
        "category", "tags", "status", "createdById", "companyId", "createdAt"
      ) VALUES (
        ${workOrderId}, ${failureOccurrenceId}, ${title}, ${description},
        ${rootCause}, ${whatWorked}, ${whatDidnt}, ${recommendation},
        ${category || 'TECHNICAL'}, ${JSON.stringify(tags || [])}::jsonb, 'DRAFT', ${createdById}, ${companyId}, NOW()
      )
    `;

    return NextResponse.json({
      success: true,
      message: 'Lección aprendida creada exitosamente',
    });
  } catch (error) {
    console.error('Error creating lesson learned:', error);
    return NextResponse.json(
      { error: 'Error creating lesson learned' },
      { status: 500 }
    );
  }
}
