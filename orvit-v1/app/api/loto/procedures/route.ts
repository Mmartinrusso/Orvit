import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth/shared-helpers';

export const dynamic = 'force-dynamic';

// GET: List all LOTO procedures for a company
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requirePermission('loto.view');
    if (error) return error;

    const companyId = user!.companyId;
    const { searchParams } = new URL(request.url);
    const machineId = searchParams.get('machineId');
    const isActive = searchParams.get('isActive');
    const isApproved = searchParams.get('isApproved');

    const where: any = { companyId };
    if (machineId) where.machineId = parseInt(machineId);
    if (isActive !== null) where.isActive = isActive === 'true';
    if (isApproved !== null) where.isApproved = isApproved === 'true';

    const procedures = await prisma.lOTOProcedure.findMany({
      where,
      include: {
        machine: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        approvedBy: { select: { id: true, name: true } },
        _count: { select: { executions: true } },
      },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });

    return NextResponse.json(procedures);
  } catch (error) {
    console.error('Error fetching LOTO procedures:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// POST: Create a new LOTO procedure
export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requirePermission('loto.procedures.create');
    if (error) return error;

    const companyId = user!.companyId;
    const body = await request.json();
    const {
      machineId,
      name,
      description,
      energySources,
      lockoutSteps,
      verificationSteps,
      restorationSteps,
      verificationMethod,
      requiredPPE,
      estimatedMinutes,
      warnings,
      specialConsiderations,
    } = body;

    if (!machineId || !name) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos: companyId, machineId, name' },
        { status: 400 }
      );
    }

    if (!energySources || energySources.length === 0) {
      return NextResponse.json(
        { error: 'Se requiere al menos una fuente de energía' },
        { status: 400 }
      );
    }

    const procedure = await prisma.lOTOProcedure.create({
      data: {
        companyId,
        machineId,
        name,
        description: description || null,
        energySources: energySources || [],
        lockoutSteps: lockoutSteps || [],
        verificationSteps: verificationSteps || [],
        restorationSteps: restorationSteps || [],
        verificationMethod: verificationMethod || null,
        requiredPPE: requiredPPE || [],
        estimatedMinutes: estimatedMinutes || null,
        warnings: warnings || null,
        specialConsiderations: specialConsiderations || null,
        createdById: user!.id,
      },
      include: {
        machine: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });

    // Log the creation in audit log
    await prisma.auditLog.create({
      data: {
        entityType: 'LOTOProcedure',
        entityId: procedure.id,
        action: 'CREATE',
        newValue: { name: procedure.name, machineId: procedure.machineId },
        performedById: user!.id,
        companyId,
      },
    });

    return NextResponse.json(procedure, { status: 201 });
  } catch (error) {
    console.error('Error creating LOTO procedure:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
