import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { LOTOStatus, AuditAction } from '@prisma/client';
import { requirePermission } from '@/lib/auth/shared-helpers';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET: Get a single LOTO execution by ID
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { user, error } = await requirePermission('loto.view');
    if (error) return error;

    const execution = await prisma.lOTOExecution.findUnique({
      where: { id: parseInt(id) },
      include: {
        procedure: {
          include: {
            machine: { select: { id: true, name: true, serialNumber: true } },
          },
        },
        workOrder: { select: { id: true, title: true, status: true } },
        ptw: { select: { id: true, number: true, title: true, status: true } },
        lockedBy: { select: { id: true, name: true, email: true } },
        unlockedBy: { select: { id: true, name: true, email: true } },
        zeroEnergyVerifiedBy: { select: { id: true, name: true, email: true } },
      },
    });

    if (!execution) {
      return NextResponse.json({ error: 'Ejecución LOTO no encontrada' }, { status: 404 });
    }

    return NextResponse.json(execution);
  } catch (error) {
    console.error('Error fetching LOTO execution:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// PATCH: Update LOTO execution (verify zero energy, unlock)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { action, ...updateData } = body;

    // Determine required permission based on action
    let permissionCheck;
    if (action === 'verify_zero_energy') {
      permissionCheck = await requirePermission('loto.verify_zero_energy');
    } else if (action === 'unlock' || action === 'partial_unlock') {
      permissionCheck = await requirePermission('loto.release');
    } else {
      permissionCheck = await requirePermission('loto.execute');
    }
    if (permissionCheck.error) return permissionCheck.error;

    const execution = await prisma.lOTOExecution.findUnique({
      where: { id: parseInt(id) },
      include: {
        procedure: { select: { name: true } },
        workOrder: { select: { id: true, title: true } },
      },
    });

    if (!execution) {
      return NextResponse.json({ error: 'Ejecución LOTO no encontrada' }, { status: 404 });
    }

    const userId = permissionCheck.user!.id;
    let data: any = {};
    let auditAction: AuditAction = AuditAction.UPDATE;

    switch (action) {
      case 'verify_zero_energy':
        // Verify zero energy state
        if (execution.status !== LOTOStatus.LOCKED) {
          return NextResponse.json(
            { error: 'Solo se puede verificar energía cero en un LOTO bloqueado' },
            { status: 400 }
          );
        }
        if (execution.zeroEnergyVerified) {
          return NextResponse.json(
            { error: 'La verificación de energía cero ya fue realizada' },
            { status: 400 }
          );
        }
        // Zero energy verification should be done by a different person than the one who locked
        if (execution.lockedById === userId) {
          return NextResponse.json(
            { error: 'La verificación de energía cero debe ser realizada por una persona diferente al que bloqueó' },
            { status: 403 }
          );
        }
        data = {
          zeroEnergyVerified: true,
          zeroEnergyVerifiedById: userId,
          zeroEnergyVerifiedAt: new Date(),
          verificationNotes: updateData.verificationNotes || null,
        };
        auditAction = AuditAction.UPDATE;
        break;

      case 'partial_unlock':
        // Partial unlock (some locks removed but not all)
        if (execution.status !== LOTOStatus.LOCKED) {
          return NextResponse.json(
            { error: 'Solo se puede desbloquear parcialmente un LOTO bloqueado' },
            { status: 400 }
          );
        }
        data = {
          status: LOTOStatus.PARTIAL,
          unlockDetails: updateData.unlockDetails || [],
          notes: updateData.notes ? `${execution.notes || ''}\n${updateData.notes}` : execution.notes,
        };
        auditAction = AuditAction.UNLOCK_LOTO;
        break;

      case 'unlock':
        // Full unlock
        if (execution.status === LOTOStatus.UNLOCKED) {
          return NextResponse.json(
            { error: 'El LOTO ya está desbloqueado' },
            { status: 400 }
          );
        }
        // Must verify zero energy before unlock
        if (!execution.zeroEnergyVerified) {
          return NextResponse.json(
            { error: 'Debe verificar energía cero antes de desbloquear' },
            { status: 400 }
          );
        }
        // Unlock should be done by the person who locked (or supervisor override)
        // For now, we allow anyone with permission to unlock
        data = {
          status: LOTOStatus.UNLOCKED,
          unlockedById: userId,
          unlockedAt: new Date(),
          unlockDetails: updateData.unlockDetails || [],
          notes: updateData.notes ? `${execution.notes || ''}\n${updateData.notes}` : execution.notes,
        };
        auditAction = AuditAction.UNLOCK_LOTO;
        break;

      case 'add_notes':
        // Just add notes to execution
        data = {
          notes: updateData.notes ? `${execution.notes || ''}\n${updateData.notes}` : execution.notes,
        };
        break;

      default:
        return NextResponse.json(
          { error: 'Acción no válida' },
          { status: 400 }
        );
    }

    const updatedExecution = await prisma.lOTOExecution.update({
      where: { id: parseInt(id) },
      data,
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
    });

    // If fully unlocked, update work order lotoBlocked status
    if (action === 'unlock' && execution.workOrderId) {
      // Check if there are any other active LOTOs for this work order
      const remainingActiveLOTOs = await prisma.lOTOExecution.count({
        where: {
          workOrderId: execution.workOrderId,
          id: { not: execution.id },
          status: { not: LOTOStatus.UNLOCKED },
        },
      });

      if (remainingActiveLOTOs === 0) {
        await prisma.workOrder.update({
          where: { id: execution.workOrderId },
          data: { lotoBlocked: false },
        });
      }
    }

    // Log the action in audit log
    await prisma.auditLog.create({
      data: {
        entityType: 'LOTOExecution',
        entityId: execution.id,
        action: auditAction,
        oldValue: { status: execution.status, zeroEnergyVerified: execution.zeroEnergyVerified },
        newValue: { status: updatedExecution.status, zeroEnergyVerified: updatedExecution.zeroEnergyVerified, action },
        summary: `LOTO ${action} for WO #${execution.workOrderId}`,
        performedById: userId,
        companyId: execution.companyId,
      },
    });

    return NextResponse.json(updatedExecution);
  } catch (error) {
    console.error('Error updating LOTO execution:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
