import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { PTWStatus, AuditAction } from '@prisma/client';
import { requirePermission, requireAnyPermission } from '@/lib/auth/shared-helpers';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET: Get a single PTW by ID
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { user, error } = await requirePermission('ptw.view');
    if (error) return error;

    const permit = await prisma.permitToWork.findUnique({
      where: { id: parseInt(id) },
      include: {
        workOrder: { select: { id: true, title: true, status: true } },
        machine: { select: { id: true, name: true } },
        sector: { select: { id: true, name: true } },
        requestedBy: { select: { id: true, name: true, email: true } },
        approvedBy: { select: { id: true, name: true, email: true } },
        rejectedBy: { select: { id: true, name: true, email: true } },
        activatedBy: { select: { id: true, name: true, email: true } },
        suspendedBy: { select: { id: true, name: true, email: true } },
        resumedBy: { select: { id: true, name: true, email: true } },
        closedBy: { select: { id: true, name: true, email: true } },
        finalVerifiedBy: { select: { id: true, name: true, email: true } },
        ppeVerifiedBy: { select: { id: true, name: true, email: true } },
        lotoExecutions: {
          include: {
            procedure: { select: { id: true, name: true } },
            lockedBy: { select: { id: true, name: true } },
            unlockedBy: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!permit) {
      return NextResponse.json({ error: 'PTW no encontrado' }, { status: 404 });
    }

    return NextResponse.json(permit);
  } catch (error) {
    console.error('Error fetching PTW:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// PATCH: Update PTW or perform actions (approve, reject, activate, suspend, close)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { action } = body;

    // Determine required permission based on action
    let permissionCheck;
    if (action === 'approve') {
      permissionCheck = await requirePermission('ptw.approve');
    } else if (action === 'reject') {
      permissionCheck = await requirePermission('ptw.reject');
    } else if (action === 'activate') {
      permissionCheck = await requirePermission('ptw.activate');
    } else if (action === 'suspend' || action === 'resume') {
      permissionCheck = await requirePermission('ptw.suspend');
    } else if (action === 'close') {
      permissionCheck = await requirePermission('ptw.close');
    } else if (action === 'verify_ppe') {
      permissionCheck = await requirePermission('ptw.verify');
    } else if (action === 'submit') {
      permissionCheck = await requirePermission('ptw.edit');
    } else {
      permissionCheck = await requirePermission('ptw.edit');
    }
    if (permissionCheck.error) return permissionCheck.error;
    const user = permissionCheck.user!;
    const { action: _action, ...updateData } = body;

    const permit = await prisma.permitToWork.findUnique({
      where: { id: parseInt(id) },
    });

    if (!permit) {
      return NextResponse.json({ error: 'PTW no encontrado' }, { status: 404 });
    }

    const userId = user.id;
    let auditAction: AuditAction = AuditAction.UPDATE;
    let data: any = {};

    switch (action) {
      case 'submit':
        // Submit for approval
        if (permit.status !== PTWStatus.DRAFT) {
          return NextResponse.json(
            { error: 'Solo se puede enviar a aprobación un PTW en borrador' },
            { status: 400 }
          );
        }
        data = { status: PTWStatus.PENDING_APPROVAL };
        auditAction = AuditAction.STATUS_CHANGE;
        break;

      case 'approve':
        // Approve PTW
        if (permit.status !== PTWStatus.PENDING_APPROVAL) {
          return NextResponse.json(
            { error: 'Solo se puede aprobar un PTW pendiente de aprobación' },
            { status: 400 }
          );
        }
        // Segregation of duties: approver cannot be the requester
        if (permit.requestedById === userId) {
          return NextResponse.json(
            { error: 'El solicitante no puede aprobar su propio PTW' },
            { status: 403 }
          );
        }
        data = {
          status: PTWStatus.APPROVED,
          approvedById: userId,
          approvedAt: new Date(),
          approvalNotes: updateData.approvalNotes || null,
        };
        auditAction = AuditAction.APPROVE_PTW;
        break;

      case 'reject':
        // Reject PTW
        if (permit.status !== PTWStatus.PENDING_APPROVAL) {
          return NextResponse.json(
            { error: 'Solo se puede rechazar un PTW pendiente de aprobación' },
            { status: 400 }
          );
        }
        if (!updateData.rejectionReason) {
          return NextResponse.json(
            { error: 'Se requiere un motivo de rechazo' },
            { status: 400 }
          );
        }
        data = {
          status: PTWStatus.CANCELLED,
          rejectedById: userId,
          rejectedAt: new Date(),
          rejectionReason: updateData.rejectionReason,
        };
        auditAction = AuditAction.REJECT;
        break;

      case 'activate':
        // Activate PTW (start work)
        if (permit.status !== PTWStatus.APPROVED) {
          return NextResponse.json(
            { error: 'Solo se puede activar un PTW aprobado' },
            { status: 400 }
          );
        }
        // Check validity period
        const now = new Date();
        if (now < permit.validFrom || now > permit.validTo) {
          return NextResponse.json(
            { error: 'El PTW está fuera de su período de validez' },
            { status: 400 }
          );
        }
        data = {
          status: PTWStatus.ACTIVE,
          activatedById: userId,
          activatedAt: new Date(),
        };
        auditAction = AuditAction.STATUS_CHANGE;
        break;

      case 'suspend':
        // Suspend PTW temporarily
        if (permit.status !== PTWStatus.ACTIVE) {
          return NextResponse.json(
            { error: 'Solo se puede suspender un PTW activo' },
            { status: 400 }
          );
        }
        if (!updateData.suspensionReason) {
          return NextResponse.json(
            { error: 'Se requiere un motivo de suspensión' },
            { status: 400 }
          );
        }
        data = {
          status: PTWStatus.SUSPENDED,
          suspendedById: userId,
          suspendedAt: new Date(),
          suspensionReason: updateData.suspensionReason,
        };
        auditAction = AuditAction.STATUS_CHANGE;
        break;

      case 'resume':
        // Resume suspended PTW
        if (permit.status !== PTWStatus.SUSPENDED) {
          return NextResponse.json(
            { error: 'Solo se puede reanudar un PTW suspendido' },
            { status: 400 }
          );
        }
        data = {
          status: PTWStatus.ACTIVE,
          resumedById: userId,
          resumedAt: new Date(),
        };
        auditAction = AuditAction.STATUS_CHANGE;
        break;

      case 'close':
        // Close PTW
        if (permit.status !== PTWStatus.ACTIVE && permit.status !== PTWStatus.SUSPENDED) {
          return NextResponse.json(
            { error: 'Solo se puede cerrar un PTW activo o suspendido' },
            { status: 400 }
          );
        }
        // Check if there are active LOTO executions
        const activeLOTOs = await prisma.lOTOExecution.count({
          where: {
            ptwId: permit.id,
            status: { not: 'UNLOCKED' },
          },
        });
        if (activeLOTOs > 0) {
          return NextResponse.json(
            { error: 'No se puede cerrar el PTW mientras hay LOTO activos' },
            { status: 400 }
          );
        }
        data = {
          status: PTWStatus.CLOSED,
          closedById: userId,
          closedAt: new Date(),
          closeNotes: updateData.closeNotes || null,
          workCompletedSuccessfully: updateData.workCompletedSuccessfully ?? true,
          finalVerificationChecklist: updateData.finalVerificationChecklist || [],
          finalVerifiedById: userId,
          finalVerifiedAt: new Date(),
        };
        auditAction = AuditAction.CLOSE_PTW;
        break;

      case 'verify_ppe':
        // Verify PPE
        data = {
          ppeVerifiedById: userId,
          ppeVerifiedAt: new Date(),
        };
        break;

      default:
        // Regular update (only allowed for DRAFT status)
        if (permit.status !== PTWStatus.DRAFT) {
          return NextResponse.json(
            { error: 'Solo se puede editar un PTW en borrador' },
            { status: 400 }
          );
        }
        const allowedFields = [
          'type', 'title', 'description', 'workLocation',
          'hazardsIdentified', 'controlMeasures', 'requiredPPE',
          'emergencyProcedures', 'emergencyContacts',
          'validFrom', 'validTo', 'workOrderId', 'machineId', 'sectorId',
        ];
        for (const field of allowedFields) {
          if (updateData[field] !== undefined) {
            data[field] = field === 'validFrom' || field === 'validTo'
              ? new Date(updateData[field])
              : updateData[field];
          }
        }
    }

    const updatedPermit = await prisma.permitToWork.update({
      where: { id: parseInt(id) },
      data,
      include: {
        workOrder: { select: { id: true, title: true } },
        machine: { select: { id: true, name: true } },
        sector: { select: { id: true, name: true } },
        requestedBy: { select: { id: true, name: true } },
        approvedBy: { select: { id: true, name: true } },
        closedBy: { select: { id: true, name: true } },
      },
    });

    // Log the action in audit log
    await prisma.auditLog.create({
      data: {
        entityType: 'PermitToWork',
        entityId: permit.id,
        action: auditAction,
        oldValue: { status: permit.status },
        newValue: { status: updatedPermit.status, action },
        summary: `PTW ${permit.number}: ${action || 'updated'}`,
        performedById: userId,
        companyId: permit.companyId,
      },
    });

    return NextResponse.json(updatedPermit);
  } catch (error) {
    console.error('Error updating PTW:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// DELETE: Delete a PTW (only DRAFT or CANCELLED)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { user, error } = await requirePermission('ptw.delete');
    if (error) return error;

    const permit = await prisma.permitToWork.findUnique({
      where: { id: parseInt(id) },
    });

    if (!permit) {
      return NextResponse.json({ error: 'PTW no encontrado' }, { status: 404 });
    }

    if (permit.status !== PTWStatus.DRAFT && permit.status !== PTWStatus.CANCELLED) {
      return NextResponse.json(
        { error: 'Solo se pueden eliminar PTW en borrador o cancelados' },
        { status: 400 }
      );
    }

    await prisma.permitToWork.delete({
      where: { id: parseInt(id) },
    });

    // Log the deletion in audit log
    await prisma.auditLog.create({
      data: {
        entityType: 'PermitToWork',
        entityId: permit.id,
        action: AuditAction.DELETE,
        oldValue: { number: permit.number, title: permit.title },
        performedById: user!.id,
        companyId: permit.companyId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting PTW:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
