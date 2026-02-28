import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth/shared-helpers';
import { PRODUCCION_PERMISSIONS } from '@/lib/permissions';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const ResourceTypeSchema = z.object({
  code: z.string().min(1, 'El código es requerido').max(50),
  name: z.string().min(1, 'El nombre es requerido').max(255),
  description: z.string().optional().nullable(),
  config: z.object({
    requiresPhotos: z.boolean().optional(),
    hasCapacity: z.boolean().optional(),
    hasOrder: z.boolean().optional(),
  }).optional().nullable(),
  uomCode: z.string().optional().nullable(), // "m", "tn", "m3"
  attributesSchema: z.record(z.object({
    type: z.enum(['text', 'number', 'select', 'boolean']),
    label: z.string(),
    required: z.boolean().optional(),
    options: z.array(z.string()).optional(), // For select type
    unit: z.string().optional(), // For number type
    min: z.number().optional(),
    max: z.number().optional(),
    default: z.any().optional(),
  })).optional().nullable(),
});

export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requirePermission(PRODUCCION_PERMISSIONS.CONFIG.VIEW);
    if (error) return error;

    const resourceTypes = await prisma.productionResourceType.findMany({
      where: { companyId: user!.companyId },
      include: {
        _count: {
          select: { resources: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({
      success: true,
      resourceTypes,
    });
  } catch (error) {
    console.error('Error fetching resource types:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requirePermission(PRODUCCION_PERMISSIONS.CONFIG.EDIT);
    if (error) return error;

    const body = await request.json();
    const validatedData = ResourceTypeSchema.parse(body);

    // Verificar si ya existe un tipo con el mismo código
    const existing = await prisma.productionResourceType.findUnique({
      where: {
        companyId_code: {
          companyId: user!.companyId,
          code: validatedData.code.toUpperCase(),
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Ya existe un tipo de recurso con ese código' },
        { status: 400 }
      );
    }

    const resourceType = await prisma.productionResourceType.create({
      data: {
        code: validatedData.code.toUpperCase(),
        name: validatedData.name,
        description: validatedData.description,
        config: validatedData.config ?? undefined,
        uomCode: validatedData.uomCode,
        attributesSchema: validatedData.attributesSchema ?? undefined,
        companyId: user!.companyId,
      },
    });

    return NextResponse.json({
      success: true,
      resourceType,
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating resource type:', error);

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
