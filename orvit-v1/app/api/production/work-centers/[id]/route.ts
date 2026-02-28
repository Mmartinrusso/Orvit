import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth/shared-helpers';
import { PRODUCCION_PERMISSIONS } from '@/lib/permissions';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// Schema de validación para actualización
const WorkCenterUpdateSchema = z.object({
  code: z.string().min(1, 'El código es requerido').optional(),
  name: z.string().min(1, 'El nombre es requerido').optional(),
  type: z.string().min(1, 'El tipo es requerido').optional(),
  description: z.string().optional().nullable(),
  parentId: z.number().optional().nullable(),
  theoreticalCapacity: z.number().optional().nullable(),
  capacityUnit: z.string().optional().nullable(),
  standardCycleSeconds: z.number().optional().nullable(),
  standardSetupMinutes: z.number().optional().nullable(),
  status: z.enum(['ACTIVE', 'MAINTENANCE', 'INACTIVE']).optional(),
  machineId: z.number().optional().nullable(),
  lineId: z.string().optional().nullable(),
});

interface RouteParams {
  params: { id: string };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { user, error } = await requirePermission(PRODUCCION_PERMISSIONS.CONFIG.WORK_CENTERS);
    if (error) return error;

    const workCenterId = parseInt(params.id);
    if (isNaN(workCenterId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const workCenter = await prisma.workCenter.findFirst({
      where: {
        id: workCenterId,
        companyId: user!.companyId,
      },
      include: {
        parent: true,
        children: true,
        machine: {
          select: {
            id: true,
            name: true,
            nickname: true,
            status: true,
          },
        },
        line: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        productionOrders: {
          where: {
            status: { in: ['DRAFT', 'RELEASED', 'IN_PROGRESS'] },
          },
          take: 5,
          orderBy: { plannedStartDate: 'asc' },
        },
      },
    });

    if (!workCenter) {
      return NextResponse.json({ error: 'Centro de trabajo no encontrado' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      workCenter,
    });
  } catch (error) {
    console.error('Error fetching work center:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { user, error } = await requirePermission(PRODUCCION_PERMISSIONS.CONFIG.WORK_CENTERS);
    if (error) return error;

    const workCenterId = parseInt(params.id);
    if (isNaN(workCenterId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    // Verificar que el centro de trabajo existe y pertenece a la empresa
    const existingWorkCenter = await prisma.workCenter.findFirst({
      where: {
        id: workCenterId,
        companyId: user!.companyId,
      },
    });

    if (!existingWorkCenter) {
      return NextResponse.json({ error: 'Centro de trabajo no encontrado' }, { status: 404 });
    }

    const body = await request.json();
    const validatedData = WorkCenterUpdateSchema.parse(body);

    // Si se está actualizando el código, verificar que no exista otro con el mismo código
    if (validatedData.code && validatedData.code !== existingWorkCenter.code) {
      const duplicateCode = await prisma.workCenter.findFirst({
        where: {
          companyId: user!.companyId,
          code: validatedData.code,
          id: { not: workCenterId },
        },
      });

      if (duplicateCode) {
        return NextResponse.json(
          { error: 'Ya existe un centro de trabajo con ese código' },
          { status: 400 }
        );
      }
    }

    // Evitar ciclos en la jerarquía
    if (validatedData.parentId) {
      if (validatedData.parentId === workCenterId) {
        return NextResponse.json(
          { error: 'Un centro de trabajo no puede ser su propio padre' },
          { status: 400 }
        );
      }

      // Verificar que el nuevo padre no sea un descendiente
      const isDescendant = await checkIsDescendant(workCenterId, validatedData.parentId, user!.companyId);
      if (isDescendant) {
        return NextResponse.json(
          { error: 'No se puede asignar un descendiente como padre (ciclo detectado)' },
          { status: 400 }
        );
      }
    }

    const workCenter = await prisma.workCenter.update({
      where: { id: workCenterId },
      data: {
        ...validatedData,
        theoreticalCapacity: validatedData.theoreticalCapacity ?? undefined,
      },
      include: {
        parent: true,
        machine: {
          select: {
            id: true,
            name: true,
            nickname: true,
          },
        },
        line: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      workCenter,
    });
  } catch (error) {
    console.error('Error updating work center:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Datos de entrada inválidos', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { user, error } = await requirePermission(PRODUCCION_PERMISSIONS.CONFIG.WORK_CENTERS);
    if (error) return error;

    const workCenterId = parseInt(params.id);
    if (isNaN(workCenterId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    // Verificar que el centro de trabajo existe y pertenece a la empresa
    const existingWorkCenter = await prisma.workCenter.findFirst({
      where: {
        id: workCenterId,
        companyId: user!.companyId,
      },
      include: {
        children: true,
      },
    });

    if (!existingWorkCenter) {
      return NextResponse.json({ error: 'Centro de trabajo no encontrado' }, { status: 404 });
    }

    // Verificar si tiene hijos
    if (existingWorkCenter.children.length > 0) {
      return NextResponse.json(
        { error: 'No se puede eliminar un centro de trabajo con sub-centros. Elimine primero los sub-centros.' },
        { status: 400 }
      );
    }

    // Verificar si hay datos asociados
    const hasRelatedData = await prisma.productionOrder.findFirst({
      where: { workCenterId },
    });

    if (hasRelatedData) {
      // En lugar de eliminar, desactivar
      await prisma.workCenter.update({
        where: { id: workCenterId },
        data: { status: 'INACTIVE' },
      });

      return NextResponse.json({
        success: true,
        message: 'Centro de trabajo desactivado (tiene datos asociados)',
        deactivated: true,
      });
    }

    // Si no hay datos asociados, eliminar
    await prisma.workCenter.delete({
      where: { id: workCenterId },
    });

    return NextResponse.json({
      success: true,
      message: 'Centro de trabajo eliminado',
      deleted: true,
    });
  } catch (error) {
    console.error('Error deleting work center:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// Función auxiliar para verificar si un centro de trabajo es descendiente de otro
async function checkIsDescendant(parentId: number, potentialDescendantId: number, companyId: number): Promise<boolean> {
  const children = await prisma.workCenter.findMany({
    where: {
      parentId,
      companyId,
    },
    select: { id: true },
  });

  for (const child of children) {
    if (child.id === potentialDescendantId) {
      return true;
    }
    const isDescendant = await checkIsDescendant(child.id, potentialDescendantId, companyId);
    if (isDescendant) {
      return true;
    }
  }

  return false;
}
