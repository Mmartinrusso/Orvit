import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * POST /api/mobile/quick-report
 * Creates a quick failure report from mobile (minimal fields)
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      companyId,
      machineId,
      reportedById,
      description,
      symptoms,
      priority,
      imageUrls,
      voiceNoteUrl,
      location,
    } = body;

    if (!companyId || !machineId || !reportedById || !description) {
      return NextResponse.json(
        { error: 'companyId, machineId, reportedById, and description required' },
        { status: 400 }
      );
    }

    // Get machine info
    const machine = await prisma.machine.findUnique({
      where: { id: machineId },
      select: { name: true, areaId: true, sectorId: true },
    });

    if (!machine) {
      return NextResponse.json({ error: 'Machine not found' }, { status: 404 });
    }

    // Create failure occurrence
    const failure = await prisma.failureOccurrence.create({
      data: {
        companyId,
        machineId,
        reportedById,
        description,
        symptoms: symptoms || [],
        status: 'OPEN',
        reportedAt: new Date(),
        // Optional fields
        ...(imageUrls && { attachments: imageUrls }),
        ...(location && { reportLocation: location }),
      },
    });

    // Create work order automatically
    const workOrder = await prisma.workOrder.create({
      data: {
        companyId,
        machineId,
        failureId: failure.id,
        title: `Falla en ${machine.name}: ${description.substring(0, 50)}`,
        description,
        type: 'CORRECTIVE',
        priority: priority || 'P3',
        status: 'PENDING',
        createdById: reportedById,
        areaId: machine.areaId,
        sectorId: machine.sectorId,
      },
    });

    return NextResponse.json({
      success: true,
      failureId: failure.id,
      workOrderId: workOrder.id,
      message: 'Reporte creado exitosamente',
    });
  } catch (error) {
    console.error('Error creating quick report:', error);
    return NextResponse.json(
      { error: 'Error creating report' },
      { status: 500 }
    );
  }
}
