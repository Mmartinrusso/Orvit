import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { LOTOStatus, AuditAction } from '@prisma/client';
import { requirePermission } from '@/lib/auth/shared-helpers';

export const dynamic = 'force-dynamic';

// GET: List LOTO executions
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requirePermission('loto.view');
    if (error) return error;

    const companyId = user!.companyId;
    const { searchParams } = new URL(request.url);
    const workOrderId = searchParams.get('workOrderId');
    const ptwId = searchParams.get('ptwId');
    const status = searchParams.get('status') as LOTOStatus | null;
    const procedureId = searchParams.get('procedureId');

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
    const { user, error } = await requirePermission('loto.execute');
    if (error) return error;

    const companyId = user!.companyId;
    const body = await request.json();
    const {
      procedureId,
      workOrderId,
      ptwId,
      lockDetails,
      notes,
    } = body;

    if (!procedureId) {
      return NextResponse.json(
        { error: 'Falta campo requerido: procedureId' },
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

    // Check for duplicate active LOTO on same work order (only if workOrderId provided)
    if (workOrderId) {
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

    const userId = user!.id;

    const execution = await prisma.lOTOExecution.create({
      data: {
        companyId,
        procedureId,
        workOrderId: workOrderId || null,
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

    // Update work order lotoBlocked flag if linked
    if (workOrderId) {
      await prisma.workOrder.update({
        where: { id: workOrderId },
        data: { lotoBlocked: true },
      });
    }

    // Log the execution in audit log
    await prisma.auditLog.create({
      data: {
        entityType: 'LOTOExecution',
        entityId: execution.id,
        action: AuditAction.LOCK_LOTO,
        newValue: {
          procedureId,
          workOrderId: workOrderId || null,
          ptwId,
          lockDetails,
        },
        summary: `LOTO locked: ${procedure.name}${workOrderId ? ` (OT #${workOrderId})` : ''}`,
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
