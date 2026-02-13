import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserAndCompany } from '@/lib/costs-auth';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const ResourceTypeUpdateSchema = z.object({
  code: z.string().min(1).max(50).optional(),
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional().nullable(),
  config: z.object({
    requiresPhotos: z.boolean().optional(),
    hasCapacity: z.boolean().optional(),
    hasOrder: z.boolean().optional(),
  }).optional().nullable(),
  uomCode: z.string().optional().nullable(),
  attributesSchema: z.record(z.object({
    type: z.enum(['text', 'number', 'select', 'boolean']),
    label: z.string(),
    required: z.boolean().optional(),
    options: z.array(z.string()).optional(),
    unit: z.string().optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    default: z.any().optional(),
  })).optional().nullable(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await getUserAndCompany();
    if (!auth || !auth.companyId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const id = parseInt(params.id);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const resourceType = await prisma.productionResourceType.findFirst({
      where: { id, companyId: auth.companyId },
      include: {
        resources: {
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!resourceType) {
      return NextResponse.json(
        { error: 'Tipo de recurso no encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      resourceType,
    });
  } catch (error) {
    console.error('Error fetching resource type:', error);
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
    const auth = await getUserAndCompany();
    if (!auth || !auth.companyId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const id = parseInt(params.id);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const existing = await prisma.productionResourceType.findFirst({
      where: { id, companyId: auth.companyId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Tipo de recurso no encontrado' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validatedData = ResourceTypeUpdateSchema.parse(body);

    // Si se está cambiando el código, verificar que no exista otro
    if (validatedData.code && validatedData.code.toUpperCase() !== existing.code) {
      const duplicate = await prisma.productionResourceType.findUnique({
        where: {
          companyId_code: {
            companyId: auth.companyId,
            code: validatedData.code.toUpperCase(),
          },
        },
      });

      if (duplicate) {
        return NextResponse.json(
          { error: 'Ya existe un tipo de recurso con ese código' },
          { status: 400 }
        );
      }
    }

    const resourceType = await prisma.productionResourceType.update({
      where: { id },
      data: {
        code: validatedData.code ? validatedData.code.toUpperCase() : undefined,
        name: validatedData.name,
        description: validatedData.description,
        config: validatedData.config !== undefined ? validatedData.config : undefined,
        uomCode: validatedData.uomCode !== undefined ? validatedData.uomCode : undefined,
        attributesSchema: validatedData.attributesSchema !== undefined ? validatedData.attributesSchema : undefined,
      },
    });

    return NextResponse.json({
      success: true,
      resourceType,
    });
  } catch (error) {
    console.error('Error updating resource type:', error);

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
    const auth = await getUserAndCompany();
    if (!auth || !auth.companyId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const id = parseInt(params.id);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const existing = await prisma.productionResourceType.findFirst({
      where: { id, companyId: auth.companyId },
      include: { _count: { select: { resources: true } } },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Tipo de recurso no encontrado' },
        { status: 404 }
      );
    }

    // Verificar que no tenga recursos asociados
    if (existing._count.resources > 0) {
      return NextResponse.json(
        { error: `No se puede eliminar: tiene ${existing._count.resources} recurso(s) asociado(s)` },
        { status: 400 }
      );
    }

    await prisma.productionResourceType.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'Tipo de recurso eliminado',
    });
  } catch (error) {
    console.error('Error deleting resource type:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
