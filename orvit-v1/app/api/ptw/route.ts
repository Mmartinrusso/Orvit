import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { PTWType, PTWStatus } from '@prisma/client';
import { requirePermission } from '@/lib/auth/shared-helpers';

export const dynamic = 'force-dynamic';

// Generate unique PTW number
async function generatePTWNumber(companyId: number): Promise<string> {
  const year = new Date().getFullYear();
  const lastPTW = await prisma.permitToWork.findFirst({
    where: {
      companyId,
      number: { startsWith: `PTW-${year}-` },
    },
    orderBy: { number: 'desc' },
  });

  let sequence = 1;
  if (lastPTW) {
    const lastNumber = parseInt(lastPTW.number.split('-')[2], 10);
    sequence = lastNumber + 1;
  }

  return `PTW-${year}-${sequence.toString().padStart(4, '0')}`;
}

// GET: List all PTW for a company
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requirePermission('ptw.view');
    if (error) return error;

    const companyId = user!.companyId;
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as PTWStatus | null;
    const type = searchParams.get('type') as PTWType | null;
    const workOrderId = searchParams.get('workOrderId');
    const machineId = searchParams.get('machineId');

    const where: any = { companyId };
    if (status) where.status = status;
    if (type) where.type = type;
    if (workOrderId) where.workOrderId = parseInt(workOrderId);
    if (machineId) where.machineId = parseInt(machineId);

    const permits = await prisma.permitToWork.findMany({
      where,
      include: {
        workOrder: { select: { id: true, title: true } },
        machine: { select: { id: true, name: true } },
        sector: { select: { id: true, name: true } },
        requestedBy: { select: { id: true, name: true } },
        approvedBy: { select: { id: true, name: true } },
        closedBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(permits);
  } catch (error) {
    console.error('Error fetching PTW:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// POST: Create a new PTW
export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requirePermission('ptw.create');
    if (error) return error;

    const companyId = user!.companyId;
    const body = await request.json();
    const {
      type,
      workOrderId,
      machineId,
      sectorId,
      title,
      description,
      workLocation,
      hazardsIdentified,
      controlMeasures,
      requiredPPE,
      emergencyProcedures,
      emergencyContacts,
      validFrom,
      validTo,
    } = body;

    if (!type || !title || !description || !validFrom || !validTo) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos: companyId, type, title, description, validFrom, validTo' },
        { status: 400 }
      );
    }

    // Generate unique PTW number
    const number = await generatePTWNumber(companyId);

    const permit = await prisma.permitToWork.create({
      data: {
        number,
        type,
        status: PTWStatus.DRAFT,
        companyId,
        workOrderId: workOrderId || null,
        machineId: machineId || null,
        sectorId: sectorId || null,
        title,
        description,
        workLocation: workLocation || null,
        hazardsIdentified: hazardsIdentified || [],
        controlMeasures: controlMeasures || [],
        requiredPPE: requiredPPE || [],
        emergencyProcedures: emergencyProcedures || null,
        emergencyContacts: emergencyContacts || [],
        validFrom: new Date(validFrom),
        validTo: new Date(validTo),
        requestedById: user!.id,
      },
      include: {
        workOrder: { select: { id: true, title: true } },
        machine: { select: { id: true, name: true } },
        sector: { select: { id: true, name: true } },
        requestedBy: { select: { id: true, name: true } },
      },
    });

    // Log the creation in audit log
    await prisma.auditLog.create({
      data: {
        entityType: 'PermitToWork',
        entityId: permit.id,
        action: 'CREATE',
        newValue: { number: permit.number, type: permit.type, title: permit.title },
        performedById: user!.id,
        companyId,
      },
    });

    return NextResponse.json(permit, { status: 201 });
  } catch (error) {
    console.error('Error creating PTW:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
