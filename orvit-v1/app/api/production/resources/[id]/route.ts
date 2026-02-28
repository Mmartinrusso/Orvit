import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth/shared-helpers';
import { PRODUCCION_PERMISSIONS } from '@/lib/permissions';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const ResourceUpdateSchema = z.object({
  code: z.string().min(1).max(50).optional(),
  name: z.string().min(1).max(255).optional(),
  resourceTypeId: z.number().int().positive().optional(),
  workCenterId: z.number().int().positive().optional().nullable(),
  metadata: z.record(z.any()).optional().nullable(),
  status: z.enum(['ACTIVE', 'MAINTENANCE', 'INACTIVE']).optional(),
  order: z.number().int().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await requirePermission(PRODUCCION_PERMISSIONS.CONFIG.VIEW);
    if (error) return error;

    const id = parseInt(params.id);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const resource = await prisma.productionResource.findFirst({
      where: { id, companyId: user!.companyId },
      include: {
        resourceType: true,
        workCenter: {
          select: { id: true, code: true, name: true, type: true },
        },
      },
    });

    if (!resource) {
      return NextResponse.json(
        { error: 'Recurso no encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      resource,
    });
  } catch (error) {
    console.error('Error fetching resource:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await requirePermission(PRODUCCION_PERMISSIONS.CONFIG.EDIT);
    if (error) return error;

    const id = parseInt(params.id);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const existing = await prisma.productionResource.findFirst({
      where: { id, companyId: user!.companyId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Recurso no encontrado' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validatedData = ResourceUpdateSchema.parse(body);

    // Si se cambia el código, verificar que no exista otro
    if (validatedData.code && validatedData.code.toUpperCase() !== existing.code) {
      const duplicate = await prisma.productionResource.findUnique({
        where: {
          companyId_code: {
            companyId: user!.companyId,
            code: validatedData.code.toUpperCase(),
          },
        },
      });

      if (duplicate) {
        return NextResponse.json(
          { error: 'Ya existe un recurso con ese código' },
          { status: 400 }
        );
      }
    }

    // Verificar resourceType si se cambia
    if (validatedData.resourceTypeId) {
      const resourceType = await prisma.productionResourceType.findFirst({
        where: {
          id: validatedData.resourceTypeId,
          companyId: user!.companyId,
        },
      });

      if (!resourceType) {
        return NextResponse.json(
          { error: 'Tipo de recurso no encontrado' },
          { status: 400 }
        );
      }
    }

    // Verificar workCenter si se especifica
    if (validatedData.workCenterId) {
      const workCenter = await prisma.workCenter.findFirst({
        where: {
          id: validatedData.workCenterId,
          companyId: user!.companyId,
        },
      });

      if (!workCenter) {
        return NextResponse.json(
          { error: 'Centro de trabajo no encontrado' },
          { status: 400 }
        );
      }
    }

    const resource = await prisma.productionResource.update({
      where: { id },
      data: {
        code: validatedData.code ? validatedData.code.toUpperCase() : undefined,
        name: validatedData.name,
        resourceTypeId: validatedData.resourceTypeId,
        workCenterId: validatedData.workCenterId,
        metadata: validatedData.metadata !== undefined ? validatedData.metadata : undefined,
        status: validatedData.status,
        order: validatedData.order,
      },
      include: {
        resourceType: {
          select: { id: true, code: true, name: true },
        },
        workCenter: {
          select: { id: true, code: true, name: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      resource,
    });
  } catch (error) {
    console.error('Error updating resource:', error);

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

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await requirePermission(PRODUCCION_PERMISSIONS.CONFIG.EDIT);
    if (error) return error;

    const id = parseInt(params.id);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const existing = await prisma.productionResource.findFirst({
      where: { id, companyId: user!.companyId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Recurso no encontrado' },
        { status: 404 }
      );
    }

    await prisma.productionResource.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'Recurso eliminado',
    });
  } catch (error) {
    console.error('Error deleting resource:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
