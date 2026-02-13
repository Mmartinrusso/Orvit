import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET: Get a single LOTO procedure by ID
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const procedure = await prisma.lOTOProcedure.findUnique({
      where: { id: parseInt(id) },
      include: {
        machine: { select: { id: true, name: true, serialNumber: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        approvedBy: { select: { id: true, name: true, email: true } },
        executions: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: {
            lockedBy: { select: { id: true, name: true } },
            unlockedBy: { select: { id: true, name: true } },
            workOrder: { select: { id: true, title: true } },
          },
        },
      },
    });

    if (!procedure) {
      return NextResponse.json({ error: 'Procedimiento LOTO no encontrado' }, { status: 404 });
    }

    return NextResponse.json(procedure);
  } catch (error) {
    console.error('Error fetching LOTO procedure:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// PATCH: Update LOTO procedure or perform actions (approve, deactivate)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
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
    const { action, ...updateData } = body;

    const procedure = await prisma.lOTOProcedure.findUnique({
      where: { id: parseInt(id) },
    });

    if (!procedure) {
      return NextResponse.json({ error: 'Procedimiento LOTO no encontrado' }, { status: 404 });
    }

    const userId = payload.userId as number;
    let data: any = {};
    let auditAction = 'UPDATE';

    switch (action) {
      case 'approve':
        // Approve procedure
        if (procedure.isApproved) {
          return NextResponse.json(
            { error: 'El procedimiento ya está aprobado' },
            { status: 400 }
          );
        }
        // Cannot approve own procedure
        if (procedure.createdById === userId) {
          return NextResponse.json(
            { error: 'No puede aprobar un procedimiento que usted creó' },
            { status: 403 }
          );
        }
        data = {
          isApproved: true,
          approvedById: userId,
          approvedAt: new Date(),
        };
        auditAction = 'APPROVE';
        break;

      case 'deactivate':
        // Deactivate procedure
        if (!procedure.isActive) {
          return NextResponse.json(
            { error: 'El procedimiento ya está desactivado' },
            { status: 400 }
          );
        }
        data = { isActive: false };
        auditAction = 'STATUS_CHANGE';
        break;

      case 'activate':
        // Activate procedure
        if (procedure.isActive) {
          return NextResponse.json(
            { error: 'El procedimiento ya está activo' },
            { status: 400 }
          );
        }
        data = { isActive: true };
        auditAction = 'STATUS_CHANGE';
        break;

      case 'new_version':
        // Create a new version (increment version number)
        data = {
          version: procedure.version + 1,
          isApproved: false, // New version needs re-approval
          approvedById: null,
          approvedAt: null,
        };
        auditAction = 'UPDATE';
        break;

      default:
        // Regular update (only if not approved, or create new version)
        if (procedure.isApproved && !updateData.forceNewVersion) {
          return NextResponse.json(
            { error: 'No se puede editar un procedimiento aprobado. Cree una nueva versión.' },
            { status: 400 }
          );
        }
        const allowedFields = [
          'name', 'description', 'energySources', 'lockoutSteps',
          'verificationSteps', 'restorationSteps', 'verificationMethod',
          'requiredPPE', 'estimatedMinutes', 'warnings', 'specialConsiderations',
        ];
        for (const field of allowedFields) {
          if (updateData[field] !== undefined) {
            data[field] = updateData[field];
          }
        }
        // If editing approved procedure, create new version
        if (procedure.isApproved && updateData.forceNewVersion) {
          data.version = procedure.version + 1;
          data.isApproved = false;
          data.approvedById = null;
          data.approvedAt = null;
        }
    }

    const updatedProcedure = await prisma.lOTOProcedure.update({
      where: { id: parseInt(id) },
      data,
      include: {
        machine: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        approvedBy: { select: { id: true, name: true } },
      },
    });

    // Log the action in audit log
    await prisma.auditLog.create({
      data: {
        entityType: 'LOTOProcedure',
        entityId: procedure.id,
        action: auditAction as any,
        oldValue: { isApproved: procedure.isApproved, isActive: procedure.isActive, version: procedure.version },
        newValue: { isApproved: updatedProcedure.isApproved, isActive: updatedProcedure.isActive, version: updatedProcedure.version },
        summary: `LOTO Procedure ${procedure.name}: ${action || 'updated'}`,
        performedById: userId,
        companyId: procedure.companyId,
      },
    });

    return NextResponse.json(updatedProcedure);
  } catch (error) {
    console.error('Error updating LOTO procedure:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// DELETE: Delete a LOTO procedure (only if never used)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const procedure = await prisma.lOTOProcedure.findUnique({
      where: { id: parseInt(id) },
      include: { _count: { select: { executions: true } } },
    });

    if (!procedure) {
      return NextResponse.json({ error: 'Procedimiento LOTO no encontrado' }, { status: 404 });
    }

    // Cannot delete if there are executions
    if (procedure._count.executions > 0) {
      return NextResponse.json(
        { error: 'No se puede eliminar un procedimiento que ha sido ejecutado. Desactívelo en su lugar.' },
        { status: 400 }
      );
    }

    await prisma.lOTOProcedure.delete({
      where: { id: parseInt(id) },
    });

    // Log the deletion in audit log
    await prisma.auditLog.create({
      data: {
        entityType: 'LOTOProcedure',
        entityId: procedure.id,
        action: 'DELETE',
        oldValue: { name: procedure.name, machineId: procedure.machineId },
        performedById: payload.userId as number,
        companyId: procedure.companyId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting LOTO procedure:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
