import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { LOTOStatus, AuditAction } from '@prisma/client';

export const dynamic = 'force-dynamic';

// GET: List LOTO executions
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
    const workOrderId = searchParams.get('workOrderId');
    const ptwId = searchParams.get('ptwId');
    const status = searchParams.get('status') as LOTOStatus | null;
    const procedureId = searchParams.get('procedureId');

    if (!companyId) {
      return NextResponse.json({ error: 'companyId requerido' }, { status: 400 });
    }

    const where: any = { companyId };
    if (workOrderId) where.workOrderId = parseInt(workOrderId);
    if (ptwId) where.ptwId = parseInt(ptwId);
    if (status) where.status = status;
    if (procedureId) where.procedureId = parseInt(procedureId);

    const executions = await prisma.lOTOExecution.findMany({
      where,
      include: {
        procedure: {
          select: { id: true, name: true, machine: { select: { id: true, name: true } } },
        },
        workOrder: { select: { id: true, title: true } },
        ptw: { select: { id: true, number: true, title: true } },
        lockedBy: { select: { id: true, name: true } },
        unlockedBy: { select: { id: true, name: true } },
        zeroEnergyVerifiedBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(executions);
  } catch (error) {
    console.error('Error fetching LOTO executions:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// POST: Create a new LOTO execution (lock)
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
      procedureId,
      workOrderId,
      ptwId,
      lockDetails,
      notes,
    } = body;

    if (!companyId || !procedureId || !workOrderId) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos: companyId, procedureId, workOrderId' },
        { status: 400 }
      );
    }

    // Verify procedure exists and is approved
    const procedure = await prisma.lOTOProcedure.findUnique({
      where: { id: procedureId },
    });

    if (!procedure) {
      return NextResponse.json({ error: 'Procedimiento LOTO no encontrado' }, { status: 404 });
    }

    if (!procedure.isApproved) {
      return NextResponse.json(
        { error: 'No se puede ejecutar un procedimiento LOTO no aprobado' },
        { status: 400 }
      );
    }

    if (!procedure.isActive) {
      return NextResponse.json(
        { error: 'No se puede ejecutar un procedimiento LOTO desactivado' },
        { status: 400 }
      );
    }

    // Check if there's already an active LOTO for this work order
    const existingLOTO = await prisma.lOTOExecution.findFirst({
      where: {
        workOrderId,
        status: { not: LOTOStatus.UNLOCKED },
      },
    });

    if (existingLOTO) {
      return NextResponse.json(
        { error: 'Ya existe un LOTO activo para esta orden de trabajo' },
        { status: 400 }
      );
    }

    // If PTW is specified, verify it's active
    if (ptwId) {
      const ptw = await prisma.permitToWork.findUnique({
        where: { id: ptwId },
      });
      if (!ptw || ptw.status !== 'ACTIVE') {
        return NextResponse.json(
          { error: 'El PTW especificado no está activo' },
          { status: 400 }
        );
      }
    }

    const userId = payload.userId as number;

    const execution = await prisma.lOTOExecution.create({
      data: {
        companyId,
        procedureId,
        workOrderId,
        ptwId: ptwId || null,
        status: LOTOStatus.LOCKED,
        lockedById: userId,
        lockedAt: new Date(),
        lockDetails: lockDetails || [],
        notes: notes || null,
      },
      include: {
        procedure: {
          select: { id: true, name: true, machine: { select: { id: true, name: true } } },
        },
        workOrder: { select: { id: true, title: true } },
        ptw: { select: { id: true, number: true, title: true } },
        lockedBy: { select: { id: true, name: true } },
      },
    });

    // Update work order to indicate LOTO is active
    await prisma.workOrder.update({
      where: { id: workOrderId },
      data: { lotoBlocked: true },
    });

    // Log the execution in audit log
    await prisma.auditLog.create({
      data: {
        entityType: 'LOTOExecution',
        entityId: execution.id,
        action: AuditAction.LOCK_LOTO,
        newValue: {
          procedureId,
          workOrderId,
          ptwId,
          lockDetails,
        },
        summary: `LOTO locked for WO #${workOrderId}`,
        performedById: userId,
        companyId,
      },
    });

    return NextResponse.json(execution, { status: 201 });
  } catch (error) {
    console.error('Error creating LOTO execution:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
