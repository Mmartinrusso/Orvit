import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth/shared-helpers';
import { PRODUCCION_PERMISSIONS } from '@/lib/permissions';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// Schema de validación para actualización
const ReasonCodeUpdateSchema = z.object({
  code: z.string().min(1, 'El código es requerido').optional(),
  name: z.string().min(1, 'El nombre es requerido').optional(),
  type: z.enum(['DOWNTIME', 'SCRAP', 'REWORK', 'QUALITY_HOLD']).optional(),
  parentId: z.number().optional().nullable(),
  requiresNote: z.boolean().optional(),
  triggersMaintenance: z.boolean().optional(),
  affectsOEE: z.boolean().optional(),
  sortOrder: z.number().optional(),
  isActive: z.boolean().optional(),
});

interface RouteParams {
  params: { id: string };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { user, error } = await requirePermission(PRODUCCION_PERMISSIONS.CONFIG.REASON_CODES);
    if (error) return error;

    const reasonCodeId = parseInt(params.id);
    if (isNaN(reasonCodeId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const reasonCode = await prisma.productionReasonCode.findFirst({
      where: {
        id: reasonCodeId,
        companyId: user!.companyId,
      },
      include: {
        parent: true,
        children: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    if (!reasonCode) {
      return NextResponse.json({ error: 'Código de motivo no encontrado' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      reasonCode,
    });
  } catch (error) {
    console.error('Error fetching reason code:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { user, error } = await requirePermission(PRODUCCION_PERMISSIONS.CONFIG.REASON_CODES);
    if (error) return error;

    const reasonCodeId = parseInt(params.id);
    if (isNaN(reasonCodeId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    // Verificar que el código de motivo existe y pertenece a la empresa
    const existingCode = await prisma.productionReasonCode.findFirst({
      where: {
        id: reasonCodeId,
        companyId: user!.companyId,
      },
      include: {
        children: true,
      },
    });

    if (!existingCode) {
      return NextResponse.json({ error: 'Código de motivo no encontrado' }, { status: 404 });
    }

    const body = await request.json();
    const validatedData = ReasonCodeUpdateSchema.parse(body);

    // Si se está actualizando el código, verificar que no exista otro con el mismo código
    if (validatedData.code && validatedData.code !== existingCode.code) {
      const duplicateCode = await prisma.productionReasonCode.findFirst({
        where: {
          companyId: user!.companyId,
          code: validatedData.code,
          id: { not: reasonCodeId },
        },
      });

      if (duplicateCode) {
        return NextResponse.json(
          { error: 'Ya existe un código de motivo con ese código' },
          { status: 400 }
        );
      }
    }

    // Si se cambia el tipo y tiene hijos, no permitir
    if (validatedData.type && validatedData.type !== existingCode.type && existingCode.children.length > 0) {
      return NextResponse.json(
        { error: 'No se puede cambiar el tipo de un código que tiene sub-códigos' },
        { status: 400 }
      );
    }

    // Si se cambia el padre, verificar que no cree ciclo y que sea del mismo tipo
    if (validatedData.parentId !== undefined) {
      if (validatedData.parentId === reasonCodeId) {
        return NextResponse.json(
          { error: 'Un código no puede ser su propio padre' },
          { status: 400 }
        );
      }

      if (validatedData.parentId) {
        const parent = await prisma.productionReasonCode.findFirst({
          where: {
            id: validatedData.parentId,
            companyId: user!.companyId,
          },
        });

        if (!parent) {
          return NextResponse.json(
            { error: 'Código padre no encontrado' },
            { status: 400 }
          );
        }

        const targetType = validatedData.type || existingCode.type;
        if (parent.type !== targetType) {
          return NextResponse.json(
            { error: 'El código hijo debe ser del mismo tipo que el padre' },
            { status: 400 }
          );
        }

        // Verificar que el nuevo padre no sea un descendiente
        const isDescendant = await checkIsDescendant(reasonCodeId, validatedData.parentId, user!.companyId);
        if (isDescendant) {
          return NextResponse.json(
            { error: 'No se puede asignar un descendiente como padre (ciclo detectado)' },
            { status: 400 }
          );
        }
      }
    }

    const reasonCode = await prisma.productionReasonCode.update({
      where: { id: reasonCodeId },
      data: validatedData,
      include: {
        parent: true,
      },
    });

    return NextResponse.json({
      success: true,
      reasonCode,
    });
  } catch (error) {
    console.error('Error updating reason code:', error);

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
    const { user, error } = await requirePermission(PRODUCCION_PERMISSIONS.CONFIG.REASON_CODES);
    if (error) return error;

    const reasonCodeId = parseInt(params.id);
    if (isNaN(reasonCodeId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    // Verificar que el código de motivo existe y pertenece a la empresa
    const existingCode = await prisma.productionReasonCode.findFirst({
      where: {
        id: reasonCodeId,
        companyId: user!.companyId,
      },
      include: {
        children: true,
      },
    });

    if (!existingCode) {
      return NextResponse.json({ error: 'Código de motivo no encontrado' }, { status: 404 });
    }

    // Verificar si tiene hijos
    if (existingCode.children.length > 0) {
      return NextResponse.json(
        { error: 'No se puede eliminar un código con sub-códigos. Elimine primero los sub-códigos.' },
        { status: 400 }
      );
    }

    // Verificar si hay datos asociados (paradas o defectos)
    const [hasDowntimes, hasDefects] = await Promise.all([
      prisma.productionDowntime.findFirst({
        where: { reasonCodeId },
      }),
      prisma.productionDefect.findFirst({
        where: { reasonCodeId },
      }),
    ]);

    if (hasDowntimes || hasDefects) {
      // En lugar de eliminar, desactivar
      await prisma.productionReasonCode.update({
        where: { id: reasonCodeId },
        data: { isActive: false },
      });

      return NextResponse.json({
        success: true,
        message: 'Código de motivo desactivado (tiene datos asociados)',
        deactivated: true,
      });
    }

    // Si no hay datos asociados, eliminar
    await prisma.productionReasonCode.delete({
      where: { id: reasonCodeId },
    });

    return NextResponse.json({
      success: true,
      message: 'Código de motivo eliminado',
      deleted: true,
    });
  } catch (error) {
    console.error('Error deleting reason code:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// Función auxiliar para verificar si un código es descendiente de otro
async function checkIsDescendant(parentId: number, potentialDescendantId: number, companyId: number): Promise<boolean> {
  const children = await prisma.productionReasonCode.findMany({
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
