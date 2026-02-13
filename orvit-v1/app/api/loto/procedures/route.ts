import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET: List all LOTO procedures for a company
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
    const isActive = searchParams.get('isActive');
    const isApproved = searchParams.get('isApproved');

    if (!companyId) {
      return NextResponse.json({ error: 'companyId requerido' }, { status: 400 });
    }

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

    if (!companyId || !machineId || !name) {
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
        createdById: payload.userId as number,
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
        performedById: payload.userId as number,
        companyId,
      },
    });

    return NextResponse.json(procedure, { status: 201 });
  } catch (error) {
    console.error('Error creating LOTO procedure:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
